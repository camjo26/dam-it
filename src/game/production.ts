////////////////////////////////////////////////////////////////////////////////////////////////
// Phase A: collectors and production.
//
// Each player puts their collectors in the four resource areas on the market board, then a
// single production card is turned over. The card says what one collector in each area brings
// back that round. Nobody knows the card when they choose, which is the gamble.
//
// A player has more than one collector, and may split them across two areas or stack them both
// on one. Every card pays every area at least one, so the choice is about how hard to back a
// hunch rather than whether a collector will earn anything at all.
////////////////////////////////////////////////////////////////////////////////////////////////

import { addLog } from './log'
import { shuffle } from './rng'
import type { GameState, Player, ProductionCardDef, ResourceId } from './types'
import { RESOURCE_LABELS } from './types'

export function productionCard(state: GameState, id: string): ProductionCardDef | undefined {
  return state.rules.production.cards.find((card) => card.id === id)
}

/** Reshuffles the discard pile back in when the draw pile runs out. */
function ensureProductionDraw(state: GameState): void {
  if (state.production.drawPile.length > 0) return
  if (state.production.discardPile.length === 0) return
  const [reshuffled, rng] = shuffle(state.rng, state.production.discardPile)
  state.rng = rng
  state.production.drawPile = reshuffled
  state.production.discardPile = []
  addLog(state, {
    kind: 'production-reshuffle',
    message: 'The production discard pile was shuffled back into the deck.',
  })
}

export function collectorsLeft(state: GameState, player: Player): number {
  return Math.max(0, state.rules.production.collectorsPerPlayer - player.collectors.length)
}

export function allCollectorsPlaced(state: GameState): boolean {
  return state.players.every((player) => collectorsLeft(state, player) === 0)
}

/**
 * Turns over the production card and pays everybody. Assumes every collector is placed.
 */
export function resolveProduction(state: GameState): void {
  ensureProductionDraw(state)
  const cardId = state.production.drawPile.shift() ?? null
  state.production.lastRevealedCardId = cardId
  if (cardId) state.production.discardPile.push(cardId)

  const card = cardId ? productionCard(state, cardId) : undefined
  if (!card) {
    addLog(state, {
      kind: 'production',
      message: 'No production card was available, so nobody collected this round.',
    })
    return
  }

  addLog(state, {
    kind: 'production',
    message: `Production card revealed: ${card.name}.`,
    detail: describeYields(card),
  })

  // Count collectors per area, across every player, so the sharing penalty can be applied.
  const occupancy = new Map<ResourceId, number>()
  for (const player of state.players) {
    for (const area of player.collectors) {
      occupancy.set(area, (occupancy.get(area) ?? 0) + 1)
    }
  }

  for (const player of state.players) {
    if (player.collectors.length === 0) continue
    const parts: string[] = []

    // Each collector is paid separately, so two in one area is simply paid twice.
    for (const area of player.collectors) {
      const shared = (occupancy.get(area) ?? 1) > 1
      const penalty = shared ? state.rules.production.sharingPenalty : 0
      const gained = Math.max(
        state.rules.production.minimumYield,
        card.yields[area] - penalty,
      )
      player.resources[area] += gained
      player.stats.resourcesGained[area] += gained
      parts.push(`${gained} ${RESOURCE_LABELS[area]}`)
    }

    addLog(state, {
      kind: 'collect',
      playerId: player.id,
      message: `${player.name} collected ${parts.join(' and ')}.`,
      detail: `${player.collectors.length} ` +
        `${player.collectors.length === 1 ? 'collector' : 'collectors'} in ` +
        `${describeCollectors(player)}.`,
    })
  }
}

/** "Clay and Clay" or "Wood and Reeds", as the player actually placed them. */
export function describeCollectors(player: Player): string {
  if (player.collectors.length === 0) return 'nothing'
  return player.collectors.map((area) => RESOURCE_LABELS[area]).join(' and ')
}

export function describeYields(card: ProductionCardDef): string {
  return (Object.keys(card.yields) as ResourceId[])
    .map((id) => `${RESOURCE_LABELS[id]} ${card.yields[id]}`)
    .join(', ')
}

/** Clears collectors ready for the next round, if the rules re-assign them each round. */
export function resetCollectors(state: GameState): void {
  if (!state.rules.production.reassignEachRound) return
  for (const player of state.players) player.collectors = []
}
