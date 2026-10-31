////////////////////////////////////////////////////////////////////////////////////////////////
// Animal movement: legality checks, movement point accounting and the shared "place an animal
// on a tile" routine that every mover (player movement, current, cards, equipment) goes through.
//
// Routing every position change through placeAnimal keeps island visits, whirlpool flags,
// current reveals and finishing consistent no matter what caused the move.
////////////////////////////////////////////////////////////////////////////////////////////////

import { bottomBankRow, inBounds, isRiverRow, stepOffsets, tileAt, TOP_BANK_ROW } from './board'
import { addLog } from './log'
import type { Animal, GameState, Player, Tile } from './types'

/**
 * MAX_ANIMALS_NOTE
 *
 * A river square holds `board.maxAnimalsPerTile` animals. The limit binds anything a player
 * chooses to do - walking, a raft, a rope, a card, dragging someone in with a Distraction -
 * and does not bind the river. The current moves every animal standing on a tile, however
 * many that is, so a stack shoved into the bank piles up past the limit rather than some of
 * it being left behind. Making the river obey the cap would mean picking which animals get
 * carried and which do not, and nothing in the game says who would choose.
 *
 * The banks are exempt. Every animal in the game starts stacked on the top bank, so a limit
 * there would make the opening position illegal.
 */
export function animalsOnTile(state: GameState, col: number, row: number): number {
  let count = 0
  for (const animal of state.animals) {
    if (!isInPlay(animal)) continue
    if (animal.col === col && animal.row === row) count += 1
  }
  return count
}

/** True when a deliberate move may not put another animal on this square. */
export function tileIsFull(state: GameState, col: number, row: number): boolean {
  const max = state.rules.board.maxAnimalsPerTile
  if (max <= 0) return false
  if (!isRiverRow(state.board, row)) return false
  return animalsOnTile(state, col, row) >= max
}

export interface MoveOutcome {
  finished: boolean
  enteredIsland: boolean
  revealedCurrent: boolean
  tile: Tile | undefined
}

/**
 * Moves an animal to a square and applies everything that follows from standing there.
 * Does not check legality or charge movement points, so callers must validate first.
 */
export function placeAnimal(
  state: GameState,
  animal: Animal,
  col: number,
  row: number,
): MoveOutcome {
  const finishRow = bottomBankRow(state.board)
  animal.col = col
  animal.row = row

  const tile = tileAt(state.board, col, row)
  let revealedCurrent = false
  let enteredIsland = false

  if (tile) {
    // A hidden current is revealed the moment an animal stands on it, and stays revealed.
    if (tile.hidden && !tile.revealed) {
      tile.revealed = true
      revealedCurrent = true
    }
    if (tile.kind === 'island' && !animal.islandsVisited.includes(tile.id)) {
      animal.islandsVisited.push(tile.id)
      enteredIsland = true
    }
  }

  if (row >= finishRow) {
    animal.status = 'finished'
    animal.finishedOnRound = state.round
    const player = state.players.find((p) => p.id === animal.playerId)
    if (player) player.stats.animalsFinished += 1
  } else if (row === TOP_BANK_ROW) {
    animal.status = 'bank'
  } else {
    animal.status = 'river'
  }

  return { finished: animal.status === 'finished', enteredIsland, revealedCurrent, tile }
}

/**
 * Deliberately a plain boolean rather than a type guard. placeAnimal changes status as a side
 * effect, which the compiler cannot see, so narrowing on `animal.status` after an early return
 * would wrongly rule out states the animal can reach part way through a slide.
 */
export function isFinished(animal: Animal): boolean {
  return animal.status === 'finished'
}

/**
 * Still on the board and still playable. An animal that has crossed has left the board with
 * its point, and one the river has swept off the side has left it with nothing; neither can
 * be moved, targeted or counted again.
 */
export function isInPlay(animal: Animal): boolean {
  return animal.status !== 'finished' && animal.status !== 'lost'
}

export function isMovable(animal: Animal): boolean {
  return isInPlay(animal)
}

/** Takes an animal out of the game for good, swept off the side of the river. */
export function loseAnimal(state: GameState, animal: Animal): void {
  animal.status = 'lost'
  const player = state.players.find((p) => p.id === animal.playerId)
  if (player) player.stats.animalsLost += 1
}

/** Movement points available to this animal: its own bonus plus the player's shared pool. */
export function availableMovement(player: Player, animal: Animal): number {
  return player.movementRemaining + animal.bonusMovement
}

export function canStepTo(
  state: GameState,
  animal: Animal,
  col: number,
  row: number,
): { ok: true } | { ok: false; error: string } {
  if (!isMovable(animal)) {
    return { ok: false, error: 'That animal cannot move this turn.' }
  }
  if (!inBounds(state.board, col, row)) {
    return { ok: false, error: 'That square is off the board.' }
  }
  const dc = col - animal.col
  const dr = row - animal.row
  const offsets = stepOffsets(state.rules)
  const match = offsets.find((o) => o.dc === dc && o.dr === dr)
  if (!match) {
    if (dr < 0 && !state.rules.movement.allowBackward) {
      return { ok: false, error: 'Moving backward is switched off in the current rules.' }
    }
    if (Math.abs(dc) === 1 && Math.abs(dr) === 1) {
      return { ok: false, error: 'Diagonal moves are switched off in the current rules.' }
    }
    return { ok: false, error: 'Animals move one square at a time to an adjacent square.' }
  }
  if (tileIsFull(state, col, row)) {
    return {
      ok: false,
      error: `That square is full: only ${state.rules.board.maxAnimalsPerTile} animals fit ` +
        `on a river square.`,
    }
  }
  return { ok: true }
}

/** Spends movement from the animal's own bonus pool first, then the player's shared pool. */
export function spendMovement(player: Player, animal: Animal, amount: number): void {
  let remaining = amount
  const fromBonus = Math.min(animal.bonusMovement, remaining)
  animal.bonusMovement -= fromBonus
  remaining -= fromBonus
  player.movementRemaining -= remaining
}

export interface StepResult {
  ok: boolean
  error?: string
}

/** A single player-driven step, charged against the player's movement points. */
export function moveAnimalStep(
  state: GameState,
  animal: Animal,
  col: number,
  row: number,
): StepResult {
  const player = state.players.find((p) => p.id === animal.playerId)
  if (!player) return { ok: false, error: 'Unknown player.' }

  const legality = canStepTo(state, animal, col, row)
  if (!legality.ok) return { ok: false, error: legality.error }

  const cost = state.rules.movement.costPerTile
  if (availableMovement(player, animal) < cost) {
    return { ok: false, error: 'Not enough movement points left.' }
  }

  const fromCol = animal.col
  const fromRow = animal.row
  spendMovement(player, animal, cost)
  const outcome = placeAnimal(state, animal, col, row)

  const details: string[] = []
  if (outcome.revealedCurrent && outcome.tile) {
    details.push(
      outcome.tile.current === 0
        ? 'Turned the tile over: still water.'
        : `Turned the tile over: current ${outcome.tile.current} running ` +
          `${outcome.tile.direction}.`,
    )
  }
  if (outcome.enteredIsland) details.push('Landed on an island.')
  if (outcome.finished) details.push('Reached the far bank and scored.')

  addLog(state, {
    kind: 'move',
    playerId: player.id,
    message: `${player.name} moved an animal from ${coord(fromCol, fromRow)} to ${coord(col, row)}.`,
    detail: details.length > 0 ? details.join(' ') : 'Spent 1 movement point.',
  })

  return { ok: true }
}

export interface SlideOptions {
  /**
   * Lets the slide finish on a square that is already full. Set for the river's own effects
   * - the current, a whirlpool, water released by a broken dam - which carry whatever is
   * standing there rather than choosing. See MAX_ANIMALS_NOTE above.
   */
  ignoreCapacity?: boolean
  /**
   * Lets this slide carry an animal over the side of the board and out of the game, when
   * the edge rule says so. Set for the same river effects, and never for a player's own
   * move, a rope or a card: nobody gets to push a rival into the weir by hand.
   */
  canSweepOff?: boolean
}

/**
 * Moves an animal a number of squares in a straight line without charging movement points.
 * Used by the current, whirlpools, rafts, ropes and cards. Stops at the board edge or, in
 * wrap-around mode, carries on round the other side, and stops short of a full square unless
 * the caller says otherwise.
 */
export function slideAnimal(
  state: GameState,
  animal: Animal,
  dc: number,
  dr: number,
  distance: number,
  options: SlideOptions = {},
): { moved: number; finished: boolean; lost: boolean } {
  const finishRow = bottomBankRow(state.board)
  let moved = 0
  for (let step = 0; step < distance; step += 1) {
    let nextCol = animal.col + dc
    const nextRow = animal.row + dr

    if (nextCol < 0 || nextCol >= state.board.width) {
      const edge = state.rules.current.edgeBehaviour
      if (edge === 'wrap-around') {
        nextCol = (nextCol + state.board.width) % state.board.width
      } else if (edge === 'swept-away' && options.canSweepOff) {
        // Over the side and out of the game. Only the river can do this: a player's own
        // move, a rope or a card stops at the edge instead.
        loseAnimal(state, animal)
        return { moved, finished: false, lost: true }
      } else {
        break
      }
    }
    // Rows are clamped whatever the edge rule says: past the far bank is a crossing, and
    // behind the top bank is dry land rather than an edge to be washed over.
    if (nextRow < TOP_BANK_ROW || nextRow > finishRow) break
    if (!options.ignoreCapacity && tileIsFull(state, nextCol, nextRow)) break

    placeAnimal(state, animal, nextCol, nextRow)
    moved += 1
    if (animal.status === 'finished') break
  }
  return { moved, finished: animal.status === 'finished', lost: false }
}

export function coord(col: number, row: number): string {
  return `${String.fromCharCode(65 + col)}${row}`
}

export function describeTile(state: GameState, col: number, row: number): string {
  const tile = tileAt(state.board, col, row)
  if (!tile) return 'off board'
  if (tile.kind === 'bank-top') return 'top bank'
  if (tile.kind === 'bank-bottom') return 'far bank'
  if (tile.kind === 'island') return `${tile.islandSize} island`
  if (tile.kind === 'whirlpool') return 'whirlpool'
  if (tile.hidden && !tile.revealed) return 'river, current hidden'
  if (tile.current === 0) return 'river, still water'
  return `river, current ${tile.current} ${tile.direction}`
}

/** Every square the animal could legally step to right now, for highlighting in the UI. */
export function legalDestinations(
  state: GameState,
  animal: Animal,
): Array<{ col: number; row: number }> {
  const player = state.players.find((p) => p.id === animal.playerId)
  if (!player || !isMovable(animal)) return []
  if (availableMovement(player, animal) < state.rules.movement.costPerTile) return []
  const out: Array<{ col: number; row: number }> = []
  for (const offset of stepOffsets(state.rules)) {
    const col = animal.col + offset.dc
    const row = animal.row + offset.dr
    if (canStepTo(state, animal, col, row).ok) out.push({ col, row })
  }
  return out
}
