////////////////////////////////////////////////////////////////////////////////////////////////
// Power Card effects.
//
// Card text, timing, copies and magnitude all live in the rules. This file holds only the
// mechanics, one function per card id, plus a description of what each card needs to be
// pointed at so the interface can prompt for it.
////////////////////////////////////////////////////////////////////////////////////////////////

import { adjacentCoords } from './board'
import { addLog } from './log'
import { coord, slideAnimal } from './movement'
import type {
  Animal,
  CurrentDirection,
  GameState,
  Player,
  PowerCardDef,
  ResourceId,
  Tile,
} from './types'
import { RESOURCE_LABELS } from './types'

export interface CardTarget {
  animalId?: string
  tileId?: string
  secondTileId?: string
  direction?: 'left' | 'right' | 'forward' | 'backward'
  resources?: ResourceId[]
  /** How far to move, for cards that say "up to". Defaults to the card's magnitude. */
  distance?: number
}

export interface CardRequirement {
  ownAnimal?: boolean
  enemyAnimal?: boolean
  tile?: boolean
  secondTile?: boolean
  direction?: 'sideways' | 'forward-back'
  resourceChoices?: number
  adjacentIsland?: boolean
  summary: string
}

export const CARD_REQUIREMENTS: Record<string, CardRequirement> = {
  tow: { ownAnimal: true, summary: 'Choose one of your animals to tow forward.' },
  pull: {
    enemyAnimal: true,
    direction: 'sideways',
    summary: "Choose another player's animal and a sideways direction.",
  },
  redirect: { tile: true, summary: 'Choose an occupied tile to reverse the current on.' },
  surge: { tile: true, summary: 'Choose a tile to strengthen the current on.' },
  'river-shift': {
    tile: true,
    secondTile: true,
    summary: 'Choose two river tiles to swap the hidden currents of.',
  },
  whirlpool: {
    ownAnimal: false,
    summary: 'Choose an animal that will be forced to roll its whirlpool again.',
  },
  'calm-water': { tile: true, summary: 'Choose a tile to calm.' },
  push: {
    enemyAnimal: true,
    direction: 'forward-back',
    summary: "Choose an opponent's animal to push forward or backward.",
  },
  rescue: {
    ownAnimal: true,
    adjacentIsland: true,
    summary: 'Choose one of your animals and an island next to it.',
  },
  'free-resources': {
    resourceChoices: 2,
    summary: 'Choose two different resources to gain one of each.',
  },
  'double-move': { ownAnimal: true, summary: 'Choose one of your animals to move further.' },
  'current-shield': {
    ownAnimal: true,
    summary: 'Choose one of your animals to ignore the current.',
  },
}

type CardEffect = (
  state: GameState,
  player: Player,
  card: PowerCardDef,
  target: CardTarget,
) => { ok: true; detail: string } | { ok: false; error: string }

function findAnimal(state: GameState, id: string | undefined): Animal | undefined {
  if (!id) return undefined
  return state.animals.find((a) => a.id === id && a.status !== 'finished')
}

function findTile(state: GameState, id: string | undefined): Tile | undefined {
  if (!id) return undefined
  return state.board.tiles.find((t) => t.id === id)
}

function requireOwnAnimal(
  state: GameState,
  player: Player,
  target: CardTarget,
): Animal | string {
  const animal = findAnimal(state, target.animalId)
  if (!animal) return 'Choose one of your animals that is still in play.'
  if (animal.playerId !== player.id) return 'That animal is not yours.'
  return animal
}

function requireEnemyAnimal(
  state: GameState,
  player: Player,
  target: CardTarget,
): Animal | string {
  const animal = findAnimal(state, target.animalId)
  if (!animal) return 'Choose an animal that is still in play.'
  if (animal.playerId === player.id) return 'That card targets another player\'s animal.'
  return animal
}

function addModifier(
  state: GameState,
  player: Player,
  tile: Tile,
  deltaStrength: number,
  overrideDirection: CurrentDirection | null,
  label: string,
): void {
  state.tileModifiers.push({
    id: `mod-${state.nextLogId}-${tile.id}`,
    tileId: tile.id,
    deltaStrength,
    overrideDirection,
    sourcePlayerId: player.id,
    sourceLabel: label,
    forRound: state.round,
  })
}

export const CARD_EFFECTS: Record<string, CardEffect> = {
  tow: (state, player, card, target) => {
    const animal = requireOwnAnimal(state, player, target)
    if (typeof animal === 'string') return { ok: false, error: animal }
    const distance = Math.min(target.distance ?? card.magnitude, card.magnitude)
    const result = slideAnimal(state, animal, 0, 1, distance)
    if (result.moved === 0) return { ok: false, error: 'That animal cannot be towed forward.' }
    return { ok: true, detail: `Towed forward ${result.moved} to ${coord(animal.col, animal.row)}.` }
  },

  pull: (state, player, card, target) => {
    const animal = requireEnemyAnimal(state, player, target)
    if (typeof animal === 'string') return { ok: false, error: animal }
    if (target.direction !== 'left' && target.direction !== 'right') {
      return { ok: false, error: 'Pull moves an animal sideways, left or right.' }
    }
    const dc = target.direction === 'left' ? -1 : 1
    const distance = Math.min(target.distance ?? card.magnitude, card.magnitude)
    const result = slideAnimal(state, animal, dc, 0, distance)
    if (result.moved === 0) return { ok: false, error: 'That animal cannot be pulled that way.' }
    return {
      ok: true,
      detail: `Pulled ${result.moved} ${target.direction} to ${coord(animal.col, animal.row)}.`,
    }
  },

  redirect: (state, player, _card, target) => {
    const tile = findTile(state, target.tileId)
    if (!tile) return { ok: false, error: 'Choose a tile.' }
    const occupied = state.animals.some(
      (a) => a.status !== 'finished' && a.col === tile.col && a.row === tile.row,
    )
    if (!occupied) return { ok: false, error: 'Redirect only works on an occupied tile.' }
    const reversed: CurrentDirection =
      state.rules.current.direction === 'right' ? 'left' : 'right'
    addModifier(state, player, tile, 0, reversed, `${player.name}'s Redirect`)
    return { ok: true, detail: `Current on ${coord(tile.col, tile.row)} now flows ${reversed}.` }
  },

  surge: (state, player, card, target) => {
    const tile = findTile(state, target.tileId)
    if (!tile) return { ok: false, error: 'Choose a tile.' }
    addModifier(state, player, tile, card.magnitude, null, `${player.name}'s Surge`)
    return {
      ok: true,
      detail: `Current on ${coord(tile.col, tile.row)} raised by ${card.magnitude}.`,
    }
  },

  'river-shift': (state, _player, _card, target) => {
    const a = findTile(state, target.tileId)
    const b = findTile(state, target.secondTileId)
    if (!a || !b) return { ok: false, error: 'Choose two river tiles.' }
    if (a.id === b.id) return { ok: false, error: 'Choose two different tiles.' }
    if (a.kind === 'bank-top' || a.kind === 'bank-bottom') {
      return { ok: false, error: 'River Shift only swaps river tiles.' }
    }
    if (b.kind === 'bank-top' || b.kind === 'bank-bottom') {
      return { ok: false, error: 'River Shift only swaps river tiles.' }
    }
    const swap = { current: a.current, hidden: a.hidden, revealed: a.revealed }
    a.current = b.current
    a.hidden = b.hidden
    a.revealed = b.revealed
    b.current = swap.current
    b.hidden = swap.hidden
    b.revealed = swap.revealed
    return {
      ok: true,
      detail: `Swapped the currents of ${coord(a.col, a.row)} and ${coord(b.col, b.row)}.`,
    }
  },

  whirlpool: (state, _player, _card, target) => {
    const animal = findAnimal(state, target.animalId)
    if (!animal) return { ok: false, error: 'Choose an animal that is still in play.' }
    if (state.pendingWhirlpoolRerolls.includes(animal.id)) {
      return { ok: false, error: 'That animal is already set to roll again.' }
    }
    state.pendingWhirlpoolRerolls.push(animal.id)
    return { ok: true, detail: 'That animal will roll its whirlpool again this phase.' }
  },

  'calm-water': (state, player, card, target) => {
    const tile = findTile(state, target.tileId)
    if (!tile) return { ok: false, error: 'Choose a tile.' }
    addModifier(state, player, tile, -card.magnitude, null, `${player.name}'s Calm Water`)
    return {
      ok: true,
      detail: `Current on ${coord(tile.col, tile.row)} reduced by ${card.magnitude}.`,
    }
  },

  push: (state, player, card, target) => {
    const animal = requireEnemyAnimal(state, player, target)
    if (typeof animal === 'string') return { ok: false, error: animal }
    if (target.direction !== 'forward' && target.direction !== 'backward') {
      return { ok: false, error: 'Push moves an animal forward or backward.' }
    }
    const dr = target.direction === 'forward' ? 1 : -1
    const result = slideAnimal(state, animal, 0, dr, card.magnitude)
    if (result.moved === 0) return { ok: false, error: 'That animal cannot be pushed that way.' }
    return {
      ok: true,
      detail: `Pushed ${target.direction} to ${coord(animal.col, animal.row)}.`,
    }
  },

  rescue: (state, player, _card, target) => {
    const animal = requireOwnAnimal(state, player, target)
    if (typeof animal === 'string') return { ok: false, error: animal }
    const tile = findTile(state, target.tileId)
    if (!tile || tile.kind !== 'island') return { ok: false, error: 'Choose an island.' }
    const neighbours = adjacentCoords(state.board, animal.col, animal.row)
    const adjacent = neighbours.some(([c, r]) => c === tile.col && r === tile.row)
    if (!adjacent) return { ok: false, error: 'That island is not next to the animal.' }
    animal.col = tile.col
    animal.row = tile.row
    animal.status = 'river'
    if (!animal.islandsVisited.includes(tile.id)) animal.islandsVisited.push(tile.id)
    return { ok: true, detail: `Rescued onto the island at ${coord(tile.col, tile.row)}.` }
  },

  'free-resources': (_state, player, _card, target) => {
    const chosen = target.resources ?? []
    const unique = Array.from(new Set(chosen))
    if (unique.length !== 2) {
      return { ok: false, error: 'Choose exactly two different resources.' }
    }
    for (const id of unique) {
      player.resources[id] += 1
      player.stats.resourcesGained[id] += 1
    }
    const names = unique.map((id) => RESOURCE_LABELS[id]).join(' and ')
    return { ok: true, detail: `Gained 1 ${names}.` }
  },

  'double-move': (state, player, card, target) => {
    const animal = requireOwnAnimal(state, player, target)
    if (typeof animal === 'string') return { ok: false, error: animal }
    animal.bonusMovement += card.magnitude
    return { ok: true, detail: `That animal has ${card.magnitude} extra movement this turn.` }
  },

  'current-shield': (state, player, _card, target) => {
    const animal = requireOwnAnimal(state, player, target)
    if (typeof animal === 'string') return { ok: false, error: animal }
    animal.shieldedForRound = state.round
    return { ok: true, detail: 'That animal ignores the current in the coming Current Phase.' }
  },
}

export function cardById(state: GameState, cardId: string): PowerCardDef | undefined {
  return state.rules.powerCards.deck.find((card) => card.id === cardId)
}

/** True when the card's printed timing allows it to be played in the current phase. */
export function cardPlayableNow(state: GameState, card: PowerCardDef, playerId: string): boolean {
  if (card.timing === 'turn') {
    const active = state.turnOrder[state.activePlayerIndex]
    return state.phase === 'player-turns' && active === playerId
  }
  // Both the before-current cards and the whirlpool card are armed in the window after every
  // player has acted and before the current is resolved.
  return state.phase === 'current' && state.currentResolvedForRound !== state.round
}

export function applyCardEffect(
  state: GameState,
  player: Player,
  card: PowerCardDef,
  target: CardTarget,
): { ok: true; detail: string } | { ok: false; error: string } {
  const effect = CARD_EFFECTS[card.id]
  if (!effect) return { ok: false, error: `No effect is implemented for ${card.name}.` }
  const result = effect(state, player, card, target)
  if (result.ok) {
    addLog(state, {
      kind: 'power-card',
      playerId: player.id,
      message: `${player.name} played ${card.name}.`,
      detail: result.detail,
    })
  }
  return result
}
