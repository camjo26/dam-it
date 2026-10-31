////////////////////////////////////////////////////////////////////////////////////////////////
// The river board.
//
// Draws the top bank, the river rows and the far bank, with current strengths, islands,
// whirlpools, dams and every animal. Clicking is routed back up so the same board serves
// movement, dam placement and card targeting.
////////////////////////////////////////////////////////////////////////////////////////////////

import { useMemo } from 'react'

import { bottomBankRow, tileAt } from '../game/board'
import { damCalms } from '../game/current'
import { coord, isInPlay } from '../game/movement'
import type { Animal, CurrentDirection, GameState, Tile } from '../game/types'
import { BANK_BOTTOM_ART, BANK_TOP_ART, bg, factionArt, tileArt } from './art'

/**
 * Each tile now rolls its own direction, so the printed arrows on the artwork cannot be
 * trusted to point the right way. The badge is the authority, and carries the arrow itself.
 */
const DIRECTION_ARROWS: Record<CurrentDirection, string> = {
  left: '←',
  right: '→',
  forward: '↓',
  back: '↑',
}

/**
 * The printed current tiles all draw their arrows pointing right, so a tile whose current
 * runs any other way is turned until the arrows point the way the water actually goes. Only
 * the picture turns: the badge, the animals and the coordinate stay upright.
 */
const DIRECTION_SPIN: Record<CurrentDirection, string> = {
  right: '',
  left: ' face-left',
  forward: ' face-forward',
  back: ' face-back',
}

export interface BoardProps {
  state: GameState
  selectedAnimalId: string | null
  /** Squares highlighted as legal destinations for the selected animal. */
  legal: Array<{ col: number; row: number }>
  /** Squares highlighted while a card or a dam is being aimed. */
  targetable: string[]
  onTileClick: (tile: Tile) => void
  onAnimalClick: (animal: Animal) => void
  /** Animal ids to flash, used while stepping through the Current Phase. */
  highlightAnimalIds?: string[]
  /** Hides the current strengths of tiles nobody has entered yet. */
  revealAllCurrents?: boolean
}

/**
 * Whether the tile's real face can be drawn. A hidden current is drawn as plain water
 * until an animal has entered it, because the artwork shows the arrows.
 */
function isRevealed(tile: Tile, revealAll: boolean): boolean {
  return !tile.hidden || tile.revealed || revealAll
}

function currentLabel(
  tile: Tile,
  revealAll: boolean,
  calmed: boolean,
): { text: string; hidden: boolean; calm: boolean } {
  if (tile.kind === 'bank-top' || tile.kind === 'bank-bottom') {
    return { text: '', hidden: false, calm: false }
  }
  // A dam holds the water at nothing whatever the tile says underneath, so the badge reads
  // 0 rather than the strength that will come back when the dam goes.
  if (calmed) return { text: '0', hidden: false, calm: true }
  if (!isRevealed(tile, revealAll)) return { text: '?', hidden: true, calm: false }
  if (tile.current === 0) return { text: '', hidden: false, calm: false }
  return {
    text: `${tile.current}${DIRECTION_ARROWS[tile.direction]}`,
    hidden: false,
    calm: false,
  }
}

function describeCurrent(tile: Tile, revealAll: boolean, calmed: boolean): string {
  if (tile.kind === 'bank-top' || tile.kind === 'bank-bottom') return ''
  if (calmed) return 'Held at 0 by a dam, until the dam is destroyed'
  if (!isRevealed(tile, revealAll)) return 'Face down until an animal enters it'
  if (tile.current === 0) return 'Still water'
  return `Current ${tile.current}, running ${tile.direction}`
}

/**
 * The bank artwork is one wide strip, so each cell in the bank row shows its own slice of
 * it and the row reads as a continuous river edge rather than the same tree ten times.
 */
function bankSlice(url: string, col: number, width: number) {
  return {
    backgroundImage: `url(${url})`,
    backgroundSize: `${width * 100}% 100%`,
    backgroundPositionX: width > 1 ? `${(col / (width - 1)) * 100}%` : '50%',
  }
}

export function Board({
  state,
  selectedAnimalId,
  legal,
  targetable,
  onTileClick,
  onAnimalClick,
  highlightAnimalIds = [],
  revealAllCurrents = false,
}: BoardProps) {
  const { board } = state
  const finishRow = bottomBankRow(board)

  const legalKeys = useMemo(
    () => new Set(legal.map((l) => `${l.col},${l.row}`)),
    [legal],
  )
  const targetableSet = useMemo(() => new Set(targetable), [targetable])

  // Group animals by square so a stack shows as a row of pips.
  const byTile = useMemo(() => {
    const map = new Map<string, Animal[]>()
    for (const animal of state.animals) {
      if (!isInPlay(animal)) continue
      const key = `${animal.col},${animal.row}`
      const list = map.get(key)
      if (list) list.push(animal)
      else map.set(key, [animal])
    }
    return map
  }, [state.animals])

  const damsByTile = useMemo(() => {
    const map = new Map<string, true>()
    for (const dam of state.dams) map.set(`${dam.col},${dam.row}`, true)
    return map
  }, [state.dams])

  const pending = state.pendingDistraction
  const distractionKey = pending ? `${pending.col},${pending.row}` : null
  const distractedIds = useMemo(
    () => new Set((pending?.rolls ?? []).filter((r) => r.distracted).map((r) => r.animalId)),
    [pending],
  )

  const calmedTiles = useMemo(() => {
    const set = new Set<string>()
    for (const dam of state.dams) {
      for (const tile of board.tiles) {
        if (damCalms(state.rules, dam, tile.col, tile.row)) set.add(tile.id)
      }
    }
    return set
  }, [state.dams, state.rules, board.tiles])

  const rows: number[] = []
  for (let row = 0; row <= finishRow; row += 1) rows.push(row)

  return (
    <div className="board-wrap">
      <div className="bank-label">Top bank - animals start here</div>
      <div
        className="board"
        style={{ gridTemplateColumns: `repeat(${board.width}, minmax(0, 1fr))` }}
      >
        {rows.map((row) =>
          Array.from({ length: board.width }, (_, col) => {
            const tile = tileAt(board, col, row)
            if (!tile) return null

            const key = `${col},${row}`
            const animals = byTile.get(key) ?? []
            const revealed = isRevealed(tile, revealAllCurrents)
            const calmed = calmedTiles.has(tile.id)
            const label = currentLabel(tile, revealAllCurrents, calmed)
            const classes = ['tile', 'art']

            let art: Record<string, string>
            if (tile.kind === 'bank-top') {
              classes.push('bank')
              art = bankSlice(BANK_TOP_ART, col, board.width)
            } else if (tile.kind === 'bank-bottom') {
              classes.push('bank', 'bank-bottom')
              art = bankSlice(BANK_BOTTOM_ART, col, board.width)
            } else {
              art = bg(tileArt(tile, revealed) as string)
            }

            // Only a face-up river tile with a current has arrows drawn on it to turn.
            const spin = tile.kind === 'river' && revealed && tile.current > 0
              ? DIRECTION_SPIN[tile.direction]
              : ''

            if (tile.kind === 'island') {
              classes.push('island')
              if (tile.islandSize === 'large') classes.push('large')
            }
            if (tile.kind === 'whirlpool') classes.push('whirlpool')
            if (legalKeys.has(key)) classes.push('legal', 'clickable')
            if (targetableSet.has(tile.id)) classes.push('targeting', 'clickable')
            if (calmed) classes.push('calmed')
            if (distractionKey === key) classes.push('distracting')

            const title = [
              coord(col, row),
              tile.kind === 'bank-top'
                ? 'Top bank'
                : tile.kind === 'bank-bottom'
                  ? 'Far bank - cross here to score'
                  : tile.kind === 'island'
                    ? `${tile.islandSize} island`
                    : tile.kind === 'whirlpool'
                      ? 'Whirlpool'
                      : 'River',
              describeCurrent(tile, revealAllCurrents, calmed),
              damsByTile.has(key) ? 'Dam built here' : '',
              distractionKey === key ? 'A Distraction token is on this square' : '',
            ]
              .filter(Boolean)
              .join(' - ')

            return (
              <div
                key={tile.id}
                className={classes.join(' ')}
                title={title}
                onClick={() => onTileClick(tile)}
                role="button"
                tabIndex={-1}
              >
                <span className={`tile-art${spin}`} style={art} />
                {label.text && (
                  <span
                    className={'current' + (label.hidden ? ' hidden-current' : '') +
                      (label.calm ? ' calm-current' : '')}
                  >
                    {label.text}
                  </span>
                )}
                {damsByTile.has(key) && (
                  <span
                    className={`dam${state.rules.dam.calmAxis === 'horizontal' ? ' vertical' : ''}`}
                  />
                )}
                {distractionKey === key && <span className="distraction-token">!</span>}
                <div className="animals">
                  {animals.map((animal) => {
                    const pip = ['pip', animal.factionId]
                    if (animal.id === selectedAnimalId) pip.push('selected')
                    if (animal.anchoredThroughRound !== null) pip.push('anchored')
                    if (animal.shieldedForRound === state.round) pip.push('shielded')
                    if (distractedIds.has(animal.id)) pip.push('distracted')
                    if (highlightAnimalIds.includes(animal.id)) pip.push('moving')
                    return (
                      <span
                        key={animal.id}
                        className={pip.join(' ')}
                        style={bg(factionArt(animal.factionId))}
                        title={animalTitle(state, animal)}
                        onClick={(event) => {
                          event.stopPropagation()
                          onAnimalClick(animal)
                        }}
                      />
                    )
                  })}
                </div>
                <span className="coord">{coord(col, row)}</span>
              </div>
            )
          }),
        )}
      </div>
      <div className="bank-label">Far bank - 1 point for every animal that gets here</div>
    </div>
  )
}

function animalTitle(state: GameState, animal: Animal): string {
  const player = state.players.find((p) => p.id === animal.playerId)
  const parts = [`${player?.name ?? animal.factionId} at ${coord(animal.col, animal.row)}`]
  if (animal.anchoredThroughRound !== null) {
    parts.push(`anchored through round ${animal.anchoredThroughRound}`)
  }
  if (animal.shieldedForRound === state.round) parts.push('shielded from the current')
  if (state.pendingDistraction?.rolls.some((r) => r.animalId === animal.id && r.distracted)) {
    parts.push('distracted, and can be drawn toward the token')
  }
  if (animal.bonusMovement > 0) parts.push(`${animal.bonusMovement} extra movement`)
  if (animal.islandsVisited.length > 0) {
    parts.push(`${animal.islandsVisited.length} islands visited`)
  }
  if (animal.movedByCurrentCount > 0) {
    parts.push(`carried by the current ${animal.movedByCurrentCount} times`)
  }
  if (animal.crossedWhirlpool) parts.push('has been through a whirlpool')
  return parts.join(' - ')
}
