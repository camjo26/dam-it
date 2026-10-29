////////////////////////////////////////////////////////////////////////////////////////////////
// Phase A: collectors and production.
//
// Each player puts their collector in one of the four resource areas on the market board, then
// a single production card is turned over. The card says what a collector in each area brings
// back that round. Nobody knows the card when they choose, which is the gamble.
////////////////////////////////////////////////////////////////////////////////////////////////

import { addLog } from './log'
import { shuffle } from './rng'
import type { GameState, ProductionCardDef, ResourceId } from './types'
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

export function allCollectorsPlaced(state: GameState): boolean {
  return state.players.every((player) => player.collectorArea !== null)
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

  // Count collectors per area so the sharing penalty can be applied.
  const occupancy = new Map<ResourceId, number>()
  for (const player of state.players) {
    if (!player.collectorArea) continue
    occupancy.set(player.collectorArea, (occupancy.get(player.collectorArea) ?? 0) + 1)
  }

  for (const player of state.players) {
    const area = player.collectorArea
    if (!area) continue
    const shared = (occupancy.get(area) ?? 1) > 1
    const penalty = shared ? state.rules.production.sharingPenalty : 0
    const gained = Math.max(
      state.rules.production.minimumYield,
      card.yields[area] - penalty,
    )

    player.resources[area] += gained
    player.stats.resourcesGained[area] += gained

    addLog(state, {
      kind: 'collect',
      playerId: player.id,
      message: `${player.name} collected ${gained} ${RESOURCE_LABELS[area]}.`,
      detail: shared
        ? `Collector in ${RESOURCE_LABELS[area]} (shared with another player, ` +
          `penalty ${penalty}).`
        : `Collector in ${RESOURCE_LABELS[area]}.`,
    })
  }
}

export function describeYields(card: ProductionCardDef): string {
  return (Object.keys(card.yields) as ResourceId[])
    .map((id) => `${RESOURCE_LABELS[id]} ${card.yields[id]}`)
    .join(', ')
}

/** Clears collectors ready for the next round, if the rules re-assign them each round. */
export function resetCollectors(state: GameState): void {
  if (!state.rules.production.reassignEachRound) return
  for (const player of state.players) player.collectorArea = null
}
