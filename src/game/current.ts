////////////////////////////////////////////////////////////////////////////////////////////////
// The Current Phase.
//
// Resolved once, after every player has taken their turn. The order animals are resolved in is
// deterministic and configurable, and every move records the reason it happened so the log can
// answer "why did that animal end up there".
//
// Order of effects applied to one animal, which is also what the rules panel shows:
//   1. Base current strength of the tile it is standing on
//   2. Tile modifiers played this round (Surge, Calm Water, Redirect, Saboteur)
//   3. Islands, if islands block the current
//   4. Dams calming the water above and below, unless the owner barred this animal
//   5. Anchor, then Current Shield, either of which makes the animal ignore the current
//   6. Swan resistance, which never takes the strength below zero
//   7. The animal is pushed that many squares in the current's direction
//   8. Duck Go With the Flow, one extra square, only if the current actually moved it
//   9. Whirlpool, at most once per animal per phase
////////////////////////////////////////////////////////////////////////////////////////////////

import { bottomBankRow, tileAt, TOP_BANK_ROW } from './board'
import { addLog } from './log'
import { coord, isFinished, isInPlay, loseAnimal, placeAnimal } from './movement'
import type { GameRules } from './rules'
import { weightedIndex } from './rng'
import type {
  Animal,
  CurrentDirection,
  CurrentStep,
  Dam,
  GameState,
  RngState,
  Tile,
} from './types'
import { CURRENT_VECTORS } from './types'

export type WhirlpoolDirection = 'left' | 'right' | 'forward'

const WHIRLPOOL_VECTORS: Record<WhirlpoolDirection, { dc: number; dr: number }> = {
  left: { dc: -1, dr: 0 },
  right: { dc: 1, dr: 0 },
  forward: { dc: 0, dr: 1 },
}

/** How far downstream a column is, for the resolution order. */
function flowSign(direction: CurrentDirection): number {
  return direction === 'left' ? -1 : 1
}

export const DIRECTION_LABELS: Record<CurrentDirection, string> = {
  left: 'left',
  right: 'right',
  forward: 'forward, toward the far bank',
  back: 'back, toward the starting bank',
}

/** True when this dam calms the given square. */
export function damCalms(rules: GameRules, dam: Dam, col: number, row: number): boolean {
  const { calmAxis, calmRadius, calmsOwnTile } = rules.dam
  if (calmAxis === 'vertical') {
    if (col !== dam.col) return false
    const distance = Math.abs(row - dam.row)
    if (distance === 0) return calmsOwnTile
    return distance <= calmRadius
  }
  if (row !== dam.row) return false
  const distance = Math.abs(col - dam.col)
  if (distance === 0) return calmsOwnTile
  return distance <= calmRadius
}

/** The dam calming an animal's square, if any, taking the owner's exclusion into account. */
export function calmingDam(state: GameState, animal: Animal): Dam | null {
  for (const dam of state.dams) {
    if (!damCalms(state.rules, dam, animal.col, animal.row)) continue
    const barred =
      dam.excludedAnimalId === animal.id && dam.excludedForRound === state.round
    if (barred) continue
    return dam
  }
  return null
}

export interface CurrentAssessment {
  baseStrength: number
  effectiveStrength: number
  direction: CurrentDirection
  reasons: string[]
  immune: boolean
}

/** Works out what the current will do to one animal, without moving it. */
export function assessCurrent(state: GameState, animal: Animal): CurrentAssessment {
  const rules = state.rules
  const tile = tileAt(state.board, animal.col, animal.row)
  const reasons: string[] = []
  let direction = rules.current.direction

  if (!tile) {
    return { baseStrength: 0, effectiveStrength: 0, direction, reasons: ['Off board.'],
      immune: true }
  }

  const baseStrength = tile.current
  let strength = baseStrength
  direction = tile.direction
  reasons.push(
    baseStrength === 0
      ? `Tile ${coord(animal.col, animal.row)} is still water.`
      : `Tile ${coord(animal.col, animal.row)} has a current of ${baseStrength}, running ` +
        `${DIRECTION_LABELS[direction]}.`,
  )

  // 2. Modifiers played for this round.
  for (const modifier of state.tileModifiers) {
    if (modifier.tileId !== tile.id || modifier.forRound !== state.round) continue
    if (modifier.deltaStrength !== 0) {
      strength += modifier.deltaStrength
      const sign = modifier.deltaStrength > 0 ? '+' : ''
      reasons.push(`${modifier.sourceLabel}: ${sign}${modifier.deltaStrength} strength.`)
    }
    if (modifier.overrideDirection) {
      direction = modifier.overrideDirection
      reasons.push(`${modifier.sourceLabel}: current now flows ${DIRECTION_LABELS[direction]}.`)
    }
  }
  strength = Math.max(0, strength)

  // 3. Islands.
  if (tile.kind === 'island' && rules.board.islandsBlockCurrent) {
    reasons.push('Sheltered on an island, so the current does not reach it.')
    return { baseStrength, effectiveStrength: 0, direction, reasons, immune: true }
  }

  // 4. Dams.
  const dam = calmingDam(state, animal)
  if (dam) {
    const owner = state.players.find((p) => p.id === dam.ownerPlayerId)
    reasons.push(`Calmed by ${owner ? owner.name : 'a'} dam at ${coord(dam.col, dam.row)}.`)
    return { baseStrength, effectiveStrength: 0, direction, reasons, immune: true }
  }

  // 5. Anchor and Current Shield.
  if (animal.anchoredThroughRound !== null && animal.anchoredThroughRound >= state.round) {
    reasons.push('Anchored, so it ignores the current this round.')
    return { baseStrength, effectiveStrength: 0, direction, reasons, immune: true }
  }
  if (animal.shieldedForRound === state.round) {
    reasons.push('Current Shield, so it ignores the current this phase.')
    return { baseStrength, effectiveStrength: 0, direction, reasons, immune: true }
  }

  // 6. Swan resistance.
  const faction = rules.factions[animal.factionId]
  if (faction.currentResistance > 0 && strength > 0) {
    const before = strength
    strength = Math.max(0, strength - faction.currentResistance)
    reasons.push(`${faction.name} resist the current: ${before} reduced to ${strength}.`)
  }

  return { baseStrength, effectiveStrength: strength, direction, reasons, immune: false }
}

function orderedAnimals(state: GameState): Animal[] {
  const rules = state.rules
  const flowing = flowSign(rules.current.direction)
  const eligible = state.animals.filter((animal) => {
    if (!isInPlay(animal)) return false
    if (animal.row === TOP_BANK_ROW && !rules.current.affectsBankAnimals) return false
    return true
  })

  const turnIndex = (animal: Animal): number => state.turnOrder.indexOf(animal.playerId)

  const compare = (a: Animal, b: Animal): number => {
    switch (rules.current.resolutionOrder) {
      case 'downstream-first':
        // Animals nearest the downstream edge are moved first.
        if (a.col !== b.col) return flowing > 0 ? b.col - a.col : a.col - b.col
        if (a.row !== b.row) return a.row - b.row
        break
      case 'upstream-first':
        if (a.col !== b.col) return flowing > 0 ? a.col - b.col : b.col - a.col
        if (a.row !== b.row) return a.row - b.row
        break
      case 'turn-order':
        if (turnIndex(a) !== turnIndex(b)) return turnIndex(a) - turnIndex(b)
        if (a.col !== b.col) return flowing > 0 ? b.col - a.col : a.col - b.col
        if (a.row !== b.row) return a.row - b.row
        break
      case 'row-then-column':
        if (a.row !== b.row) return a.row - b.row
        if (a.col !== b.col) return a.col - b.col
        break
    }
    // Final tie-break is always stable so a replay never diverges.
    if (turnIndex(a) !== turnIndex(b)) return turnIndex(a) - turnIndex(b)
    return a.id.localeCompare(b.id)
  }

  return eligible.sort(compare)
}

/**
 * Pushes an animal in a straight line, recording every tile it passes through.
 *
 * The square limit does not apply here. The current takes everything standing on a tile, so
 * a stack driven into the bank piles up past the limit rather than some of it being left
 * behind, and nothing in the game decides who would be left. See MAX_ANIMALS_NOTE.
 */
function push(
  state: GameState,
  animal: Animal,
  dc: number,
  dr: number,
  distance: number,
): { moved: number; path: Tile[]; lost: boolean } {
  const finishRow = bottomBankRow(state.board)
  const path: Tile[] = []
  let moved = 0

  for (let step = 0; step < distance; step += 1) {
    let nextCol = animal.col + dc
    const nextRow = animal.row + dr

    if (nextCol < 0 || nextCol >= state.board.width) {
      const edge = state.rules.current.edgeBehaviour
      if (edge === 'wrap-around') {
        nextCol = (nextCol + state.board.width) % state.board.width
      } else if (edge === 'swept-away') {
        loseAnimal(state, animal)
        return { moved, path, lost: true }
      } else {
        break
      }
    }
    if (nextRow < TOP_BANK_ROW || nextRow > finishRow) break

    placeAnimal(state, animal, nextCol, nextRow)
    moved += 1
    const tile = tileAt(state.board, nextCol, nextRow)
    if (tile) path.push(tile)
    if (animal.status === 'finished') break
  }

  return { moved, path, lost: false }
}

function rollWhirlpool(
  rng: RngState,
  rules: GameRules,
): [WhirlpoolDirection, number, RngState] {
  const weights = [rules.whirlpool.weightLeft, rules.whirlpool.weightRight,
    rules.whirlpool.weightForward]
  const [index, next] = weightedIndex(rng, weights)
  const directions: WhirlpoolDirection[] = ['left', 'right', 'forward']
  const safeIndex = index < 0 ? 2 : index
  return [directions[safeIndex], safeIndex + 1, next]
}

/**
 * Resolves the whole Current Phase in place. Returns the ordered list of steps so the UI can
 * replay them one at a time or skip straight to the end.
 */
export function resolveCurrentPhase(state: GameState): CurrentStep[] {
  const rules = state.rules
  const steps: CurrentStep[] = []
  const animals = orderedAnimals(state)

  addLog(state, {
    kind: 'current-start',
    message: `Current Phase for round ${state.round}.`,
    detail: `Resolution order: ${rules.current.resolutionOrder}. ` +
      `${animals.length} animals in the water.`,
  })

  for (const animal of animals) {
    if (isFinished(animal)) continue

    const from = { col: animal.col, row: animal.row }
    const assessment = assessCurrent(state, animal)
    const reasons = [...assessment.reasons]
    let whirlpool: CurrentStep['whirlpool'] = null
    let whirlpoolsUsed = 0

    // 7. The push itself. Every tile passed through is kept, because the whirlpool rule can
    //    be set to trigger on any whirlpool crossed rather than only the one landed on.
    let totalMoved = 0
    const tilesEntered: Tile[] = []
    if (assessment.effectiveStrength > 0) {
      const { dc, dr } = CURRENT_VECTORS[assessment.direction]
      const result = push(state, animal, dc, dr, assessment.effectiveStrength)
      totalMoved += result.moved
      tilesEntered.push(...result.path)
      if (result.lost) {
        reasons.push(`Carried over the ${assessment.direction === 'left' ? 'left' : 'right'} ` +
          `edge of the river and lost.`)
      } else if (result.moved < assessment.effectiveStrength) {
        reasons.push(`Stopped by the edge of the river after ${result.moved} of ` +
          `${assessment.effectiveStrength} squares.`)
      } else {
        reasons.push(`Pushed ${result.moved} ${plural(result.moved, 'square')} ` +
          `${assessment.direction}.`)
      }

      // 8. Ducks ride the current one square further.
      const faction = rules.factions[animal.factionId]
      if (faction.goWithTheFlowBonus > 0 && result.moved > 0 && isInPlay(animal)) {
        const bonus = push(state, animal, dc, dr, faction.goWithTheFlowBonus)
        tilesEntered.push(...bonus.path)
        if (bonus.lost) {
          reasons.push('Go With the Flow carried it that one square too far, over the edge.')
        }
        if (bonus.moved > 0) {
          totalMoved += bonus.moved
          reasons.push(`Go With the Flow: ${bonus.moved} extra ` +
            `${plural(bonus.moved, 'square')} ${assessment.direction}.`)
        }
      }
    } else if (!assessment.immune) {
      reasons.push('Still water, so it did not move.')
    }

    if (totalMoved > 0) {
      animal.movedByCurrentCount += 1
      const owner = state.players.find((p) => p.id === animal.playerId)
      if (owner) owner.stats.currentMovesSuffered += 1
    }

    // 9. Whirlpool, at most once per animal per phase. Which whirlpool counts depends on the
    //    trigger rule: the one the animal came to rest on, or the first one it was dragged
    //    through on the way.
    if (rules.whirlpool.enabled && isInPlay(animal)) {
      const restTile = tileAt(state.board, animal.col, animal.row)
      let caught = restTile?.kind === 'whirlpool' ? restTile : undefined
      if (!caught && rules.whirlpool.trigger === 'any-tile-entered') {
        caught = tilesEntered.find((t) => t.kind === 'whirlpool')
        if (caught) {
          reasons.push(`Dragged through the whirlpool at ${coord(caught.col, caught.row)}.`)
        }
      }
      if (caught && whirlpoolsUsed < rules.whirlpool.maxEffectsPerAnimalPerPhase) {
        const [direction, roll, rngAfter] = rollWhirlpool(state.rng, rules)
        state.rng = rngAfter
        let finalDirection = direction
        let finalRoll = roll

        // A Whirlpool card armed against this animal forces a second roll.
        const rerollIndex = state.pendingWhirlpoolRerolls.indexOf(animal.id)
        if (rerollIndex >= 0) {
          state.pendingWhirlpoolRerolls.splice(rerollIndex, 1)
          const [again, againRoll, rngAfterReroll] = rollWhirlpool(state.rng, rules)
          state.rng = rngAfterReroll
          reasons.push(`Whirlpool card forced a re-roll: ${direction} became ${again}.`)
          finalDirection = again
          finalRoll = againRoll
        }

        const vector = WHIRLPOOL_VECTORS[finalDirection]
        const spun = push(state, animal, vector.dc, vector.dr, rules.whirlpool.distance)
        animal.crossedWhirlpool = true
        whirlpoolsUsed += 1
        whirlpool = { direction: finalDirection, roll: finalRoll }
        reasons.push(spun.lost
          ? `The whirlpool spun it ${finalDirection}, over the edge and out of the game.`
          : `Whirlpool spun it ${finalDirection} ${spun.moved} ` +
            `${plural(spun.moved, 'square')}.`)
      }
    }

    const to = { col: animal.col, row: animal.row }
    const finished = isFinished(animal)
    const lost = animal.status === 'lost'
    if (finished) reasons.push('Carried onto the far bank and scored.')

    const step: CurrentStep = {
      index: steps.length,
      animalId: animal.id,
      factionId: animal.factionId,
      from,
      to,
      reason: reasons.join(' '),
      baseStrength: assessment.baseStrength,
      effectiveStrength: assessment.effectiveStrength,
      whirlpool,
      finished,
      lost,
    }
    steps.push(step)

    const owner = state.players.find((p) => p.id === animal.playerId)
    const movedAtAll = from.col !== to.col || from.row !== to.row
    addLog(state, {
      kind: lost ? 'current-lost' : movedAtAll ? 'current-move' : 'current-hold',
      playerId: animal.playerId,
      message: lost
        ? `${owner?.name ?? 'An animal'} lost an animal over the edge at ` +
          `${coord(from.col, from.row)}.`
        : movedAtAll
          ? `${owner?.name ?? 'An animal'} was carried from ${coord(from.col, from.row)} to ` +
            `${coord(to.col, to.row)}.`
          : `${owner?.name ?? 'An animal'} held position at ${coord(from.col, from.row)}.`,
      detail: step.reason,
    })
  }

  return steps
}

/** Clears the one-round effects once the Current Phase is finished. */
export function clearRoundEffects(state: GameState): void {
  state.tileModifiers = state.tileModifiers.filter((m) => m.forRound > state.round)
  state.pendingWhirlpoolRerolls = []

  for (const animal of state.animals) {
    if (animal.anchoredThroughRound !== null && animal.anchoredThroughRound <= state.round) {
      animal.anchoredThroughRound = null
    }
    if (animal.shieldedForRound !== null && animal.shieldedForRound <= state.round) {
      animal.shieldedForRound = null
    }
  }

  for (const dam of state.dams) {
    if (dam.excludedForRound !== null && dam.excludedForRound <= state.round) {
      dam.excludedAnimalId = null
      dam.excludedForRound = null
    }
  }
}

function plural(count: number, word: string): string {
  return count === 1 ? word : `${word}s`
}
