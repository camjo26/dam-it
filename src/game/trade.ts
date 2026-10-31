////////////////////////////////////////////////////////////////////////////////////////////////
// Trading between players.
//
// One player puts an offer on the table, the other answers: take it, leave it, or name terms of
// their own, which the proposer then takes or leaves. That is the whole negotiation, and it is
// deliberately only two rounds deep so a turn cannot be spent haggling.
//
// Cards are asked for by count rather than by name. A hand is secret, so you can offer a card
// you can see but you cannot name one you cannot, and the player answering chooses which of
// theirs to part with.
////////////////////////////////////////////////////////////////////////////////////////////////

import { equipmentCost } from './engine'
import type { GameRules } from './rules'
import type {
  EquipmentId,
  GameState,
  Player,
  ResourceBag,
  ResourceId,
  TradeProposal,
  TradeTerms,
} from './types'
import { EQUIPMENT_IDS, RESOURCE_IDS, RESOURCE_LABELS } from './types'

/** What one Power Card is worth in resources when weighing a deal up. */
const CARD_WORTH = 3

/** A resource nobody is short of is still worth something, but not much. */
const SPARE_RESOURCE_WORTH = 0.35

export function emptyTerms(): TradeTerms {
  return { resources: { wood: 0, stone: 0, clay: 0, reeds: 0 }, cardInstanceIds: [] }
}

export function bagTotal(bag: ResourceBag): number {
  return RESOURCE_IDS.reduce((sum, id) => sum + Math.max(0, bag[id]), 0)
}

export function describeTerms(terms: TradeTerms, cardCount?: number): string {
  const parts = RESOURCE_IDS.filter((id) => terms.resources[id] > 0).map(
    (id) => `${terms.resources[id]} ${RESOURCE_LABELS[id]}`,
  )
  const cards = cardCount ?? terms.cardInstanceIds.length
  if (cards > 0) parts.push(`${cards} Power Card${cards === 1 ? '' : 's'}`)
  return parts.length > 0 ? parts.join(', ') : 'nothing'
}

/** Full worth of a unit a player still needs, against SPARE_RESOURCE_WORTH for a surplus one. */
const NEEDED_RESOURCE_WORTH = 1

/**
 * The most of each resource this player could want at once: the biggest single requirement
 * among the things it is still allowed to build.
 *
 * This is the line between a resource a player needs and one it is merely sitting on, and it
 * has to be drawn against a holding rather than a shortfall. Scoring purely on the shortfall
 * says a player holding six stone has no use for stone at all, which would have it cheerfully
 * trade away the stone its next dam depends on.
 */
export function resourceKeep(rules: GameRules, player: Player): Record<ResourceId, number> {
  const keep: Record<ResourceId, number> = { wood: 0, stone: 0, clay: 0, reeds: 0 }
  const faction = rules.factions[player.factionId]

  for (const item of EQUIPMENT_IDS as EquipmentId[]) {
    if (!rules.equipment[item].enabled) continue
    if (faction.forbiddenEquipment.includes(item)) continue
    const cost = equipmentCost(rules, player.factionId, item)
    for (const id of RESOURCE_IDS) {
      keep[id] = Math.max(keep[id], cost[id])
    }
  }
  return keep
}

/**
 * What a bag is worth to this player if they receive it.
 *
 * Units that close a gap in something they want to build are worth full price; units beyond
 * that are a surplus they already have no use for, and are worth little.
 */
export function valueGaining(rules: GameRules, player: Player, bag: ResourceBag): number {
  const keep = resourceKeep(rules, player)
  let total = 0
  for (const id of RESOURCE_IDS) {
    const amount = Math.max(0, bag[id])
    const gap = Math.max(0, keep[id] - player.resources[id])
    const closes = Math.min(amount, gap)
    total += closes * NEEDED_RESOURCE_WORTH + (amount - closes) * SPARE_RESOURCE_WORTH
  }
  return total
}

/**
 * What a bag costs this player to give away. The mirror of valueGaining: whatever is above
 * what they need to keep goes cheap, and whatever is below it does not.
 */
export function valueGiving(rules: GameRules, player: Player, bag: ResourceBag): number {
  const keep = resourceKeep(rules, player)
  let total = 0
  for (const id of RESOURCE_IDS) {
    const amount = Math.max(0, bag[id])
    const surplus = Math.max(0, player.resources[id] - keep[id])
    const fromSurplus = Math.min(amount, surplus)
    total += fromSurplus * SPARE_RESOURCE_WORTH +
      (amount - fromSurplus) * NEEDED_RESOURCE_WORTH
  }
  return total
}

export interface TradeVerdict {
  answer: 'accept' | 'decline' | 'counter'
  counter?: TradeTerms
  reply: string
}

/** Can this player actually hand over what the proposal asks of them? */
export function canMeet(player: Player, request: TradeProposal['request']): boolean {
  if (player.hand.length < request.cardCount) return false
  return RESOURCE_IDS.every((id) => player.resources[id] >= Math.max(0, request.resources[id]))
}

/**
 * The opponent's answer to a proposal.
 *
 * It weighs what it would receive against what it would give up, both in its own terms, and
 * takes the deal when it comes out comfortably ahead. When it does not, it tries once to find
 * terms it would accept rather than simply refusing, which is what makes haggling worth a go.
 */
export function judgeTrade(state: GameState, proposal: TradeProposal): TradeVerdict {
  const rules = state.rules
  const them = state.players.find((p) => p.id === proposal.toPlayerId)
  if (!them) return { answer: 'decline', reply: 'There is nobody there to trade with.' }

  const gain =
    valueGaining(rules, them, proposal.offer.resources) +
    proposal.offer.cardInstanceIds.length * CARD_WORTH

  const askedResources = proposal.request.resources
  const cost =
    valueGiving(rules, them, askedResources) + proposal.request.cardCount * CARD_WORTH

  const margin = rules.trade.aiAcceptMargin

  if (!canMeet(them, proposal.request)) {
    return {
      answer: 'decline',
      reply: `${them.name} cannot spare ${describeTerms(
        { resources: askedResources, cardInstanceIds: [] },
        proposal.request.cardCount,
      )}.`,
    }
  }

  if (gain >= cost * margin) {
    return { answer: 'accept', reply: `${them.name} likes the look of that.` }
  }

  // Not good enough as it stands, so try to find terms they would take: hand over less of
  // what was asked, parting with the cheapest units first and stopping while still ahead.
  const counter = emptyTerms()
  const keep = resourceKeep(rules, them)
  // Cheapest first means surplus before anything they are still short of.
  const order = [...RESOURCE_IDS].sort(
    (a, b) =>
      (them.resources[b] - keep[b]) - (them.resources[a] - keep[a]),
  )

  let countered = 0
  for (const id of order) {
    const asked = Math.max(0, Math.min(askedResources[id], them.resources[id]))
    for (let n = 0; n < asked; n += 1) {
      const unitCost = valueGiving(rules, them, {
        wood: 0, stone: 0, clay: 0, reeds: 0,
        [id]: counter.resources[id] + 1,
      } as ResourceBag) - valueGiving(rules, them, {
        wood: 0, stone: 0, clay: 0, reeds: 0,
        [id]: counter.resources[id],
      } as ResourceBag)
      if (gain < (countered + unitCost) * margin) break
      counter.resources[id] += 1
      countered += unitCost
    }
  }

  const cardsTheyWouldGive = Math.min(
    proposal.request.cardCount,
    Math.floor(Math.max(0, gain / margin - countered) / CARD_WORTH),
  )
  for (let i = 0; i < cardsTheyWouldGive && i < them.hand.length; i += 1) {
    counter.cardInstanceIds.push(them.hand[i].instanceId)
  }

  const offersAnything =
    bagTotal(counter.resources) > 0 || counter.cardInstanceIds.length > 0
  if (!offersAnything) {
    return {
      answer: 'decline',
      reply: `${them.name} does not think that is worth it, and has nothing to suggest.`,
    }
  }

  return {
    answer: 'counter',
    counter,
    reply: `${them.name} will not go that far, but offers ${describeTerms(counter)} instead.`,
  }
}

/** Hands the goods over both ways. Assumes both sides have already been checked. */
export function settleTrade(
  from: Player,
  to: Player,
  giving: TradeTerms,
  receiving: TradeTerms,
): void {
  const move = (giver: Player, taker: Player, terms: TradeTerms): void => {
    for (const id of RESOURCE_IDS) {
      const amount = Math.max(0, terms.resources[id])
      giver.resources[id] -= amount
      taker.resources[id] += amount
    }
    for (const instanceId of terms.cardInstanceIds) {
      const index = giver.hand.findIndex((c) => c.instanceId === instanceId)
      if (index < 0) continue
      const [card] = giver.hand.splice(index, 1)
      taker.hand.push(card)
    }
  }

  move(from, to, giving)
  move(to, from, receiving)
  from.stats.tradesAccepted += 1
  to.stats.tradesAccepted += 1
}
