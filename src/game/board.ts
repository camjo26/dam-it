////////////////////////////////////////////////////////////////////////////////////////////////
// Board construction and geometry helpers.
//
// The river runs left to right across the board. Animals cross it from the top bank (row 0)
// down to the bottom bank (row riverDepth + 1). River rows are 1..riverDepth.
////////////////////////////////////////////////////////////////////////////////////////////////

import type { GameRules } from './rules'
import { shuffle, weightedIndex } from './rng'
import type { Board, CurrentDirection, RngState, Tile } from './types'
import { CURRENT_DIRECTIONS, SIDEWAYS_DIRECTIONS } from './types'

export const TOP_BANK_ROW = 0

export function bottomBankRow(board: Board): number {
  return board.riverDepth + 1
}

export function tileId(col: number, row: number): string {
  return `t-${col}-${row}`
}

export function isRiverRow(board: Board, row: number): boolean {
  return row >= 1 && row <= board.riverDepth
}

export function inBounds(board: Board, col: number, row: number): boolean {
  if (col < 0 || col >= board.width) return false
  return row >= TOP_BANK_ROW && row <= bottomBankRow(board)
}

export function tileAt(board: Board, col: number, row: number): Tile | undefined {
  if (!inBounds(board, col, row)) return undefined
  return board.tiles[row * board.width + col]
}

/**
 * Rolls one tile's direction. A current strong enough to be sideways-only never runs up or
 * down the river: at that strength a forward push would be a free crossing and a backward
 * one would undo most of a game's work, so the fiercest water only ever shoves you across.
 */
function rollDirection(
  rules: GameRules,
  strength: number,
  rng: RngState,
): [CurrentDirection, RngState] {
  const weights = rules.board.currentDirectionWeights
  if (strength >= rules.board.sidewaysOnlyFromStrength) {
    const [index, next] = weightedIndex(rng, [weights[0] ?? 1, weights[1] ?? 1])
    return [SIDEWAYS_DIRECTIONS[index < 0 ? 0 : index], next]
  }
  const [index, next] = weightedIndex(rng, weights)
  return [CURRENT_DIRECTIONS[index < 0 ? 0 : index], next]
}

/** Builds the board from the rules, rolling hidden current strengths from the seeded RNG. */
export function createBoard(rules: GameRules, rng: RngState): [Board, RngState] {
  const { width, riverDepth } = rules.board
  const totalRows = riverDepth + 2
  const tiles: Tile[] = []
  let state = rng

  const islandAt = new Map<string, 'small' | 'large'>()
  for (const spec of rules.board.islands) {
    islandAt.set(tileId(spec.col, spec.row), spec.size)
  }
  const whirlpoolAt = new Set<string>()
  for (const spec of rules.board.whirlpools) {
    whirlpoolAt.add(tileId(spec.col, spec.row))
  }

  for (let row = 0; row < totalRows; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const id = tileId(col, row)
      if (row === TOP_BANK_ROW || row === riverDepth + 1) {
        tiles.push({
          id,
          col,
          row,
          kind: row === TOP_BANK_ROW ? 'bank-top' : 'bank-bottom',
          current: 0,
          direction: rules.current.direction,
          hidden: false,
          revealed: true,
        })
        continue
      }

      const island = islandAt.get(id)
      const isWhirlpool = whirlpoolAt.has(id) && !island

      // Islands only carry a current if the rules say they do not block it.
      let current = 0
      if (!island || !rules.board.islandsBlockCurrent) {
        const [strength, nextState] = weightedIndex(state, rules.board.currentStrengthWeights)
        state = nextState
        current = strength < 0 ? 0 : strength
      }

      let direction = rules.current.direction
      if (current > 0) {
        const [rolled, nextState] = rollDirection(rules, current, state)
        state = nextState
        direction = rolled
      }

      tiles.push({
        id,
        col,
        row,
        kind: island ? 'island' : isWhirlpool ? 'whirlpool' : 'river',
        islandSize: island,
        current,
        direction,
        // Settled below, once every tile exists and the face-up few can be drawn.
        hidden: false,
        revealed: true,
      })
    }
  }

  state = hideCurrents(rules, tiles, state)
  return [{ width, riverDepth, tiles }, state]
}

/**
 * Turns all but a handful of the flowing currents face down.
 *
 * Done as a draw from the finished board rather than a per-tile coin flip, so the number
 * you can see is exactly the number the rules promise rather than an average. Islands and
 * whirlpools are printed tiles and stay face up: it is the strength and direction of open
 * water that is the secret, and plain still water has nothing to hide.
 */
function hideCurrents(rules: GameRules, tiles: Tile[], rng: RngState): RngState {
  const candidates = tiles.filter((t) => t.kind === 'river' && t.current > 0)
  const [shuffled, next] = shuffle(rng, candidates)

  const faceUp = Math.max(0, Math.min(rules.board.visibleCurrents, shuffled.length))
  for (let i = faceUp; i < shuffled.length; i += 1) {
    shuffled[i].hidden = true
    shuffled[i].revealed = false
  }
  return next
}

export interface Offset {
  dc: number
  dr: number
  label: string
}

const ORTHOGONAL_OFFSETS: Offset[] = [
  { dc: 0, dr: 1, label: 'forward' },
  { dc: 0, dr: -1, label: 'back' },
  { dc: -1, dr: 0, label: 'left' },
  { dc: 1, dr: 0, label: 'right' },
]

const DIAGONAL_OFFSETS: Offset[] = [
  { dc: -1, dr: 1, label: 'forward-left' },
  { dc: 1, dr: 1, label: 'forward-right' },
  { dc: -1, dr: -1, label: 'back-left' },
  { dc: 1, dr: -1, label: 'back-right' },
]

export function stepOffsets(rules: GameRules): Offset[] {
  const offsets = ORTHOGONAL_OFFSETS.filter((o) => rules.movement.allowBackward || o.dr >= 0)
  if (!rules.movement.allowDiagonal) return offsets
  const diagonals = DIAGONAL_OFFSETS.filter((o) => rules.movement.allowBackward || o.dr >= 0)
  return [...offsets, ...diagonals]
}

export function isIsland(tile: Tile | undefined): boolean {
  return tile?.kind === 'island'
}

export function isWhirlpool(tile: Tile | undefined): boolean {
  return tile?.kind === 'whirlpool'
}

/** Current strength as the players can see it. Hidden tiles read as unknown. */
export function visibleCurrent(tile: Tile): number | null {
  if (tile.hidden && !tile.revealed) return null
  return tile.current
}

export function adjacentCoords(board: Board, col: number, row: number): Array<[number, number]> {
  const out: Array<[number, number]> = []
  for (const offset of [...ORTHOGONAL_OFFSETS, ...DIAGONAL_OFFSETS]) {
    const nc = col + offset.dc
    const nr = row + offset.dr
    if (inBounds(board, nc, nr)) out.push([nc, nr])
  }
  return out
}
