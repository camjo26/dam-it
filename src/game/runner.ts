////////////////////////////////////////////////////////////////////////////////////////////////
// Game loop driver.
//
// autoStep performs one piece of automatic progress and returns null when the game is waiting
// for a person. The interface calls it on a timer so AI turns can be watched; the headless
// simulator calls it in a tight loop. Both get identical games from identical seeds.
////////////////////////////////////////////////////////////////////////////////////////////////

import { chooseAiAction } from './ai'
import { activePlayer, applyAction } from './engine'
import { allCollectorsPlaced } from './production'
import type { GameState } from './types'

/** Total automatic steps allowed in one game before the loop is treated as stuck. */
export const MAX_AUTO_STEPS = 20000

export function hasHumanPlayers(state: GameState): boolean {
  return state.players.some((p) => p.controller === 'human')
}

/**
 * One piece of automatic progress, or null when the game needs a person to act.
 * Never advances the Current Phase while a human could still play a card into it.
 */
export function autoStep(state: GameState): GameState | null {
  if (state.phase === 'finished') return null

  if (state.phase === 'resource') {
    // AI collectors go down first.
    for (const player of state.players) {
      if (player.controller !== 'ai' || player.collectorArea !== null) continue
      const action = chooseAiAction(state, player.id)
      if (!action) continue
      const result = applyAction(state, action)
      if (result.ok) return result.state
    }
    // Once everybody has chosen, the production card turns over by itself.
    if (allCollectorsPlaced(state)) {
      const result = applyAction(state, { type: 'resolve-production' })
      if (result.ok) return result.state
    }
    return null
  }

  if (state.phase === 'player-turns') {
    const player = activePlayer(state)
    if (!player || player.controller !== 'ai') return null
    const action = chooseAiAction(state, player.id)
    if (!action) {
      const ended = applyAction(state, { type: 'end-turn' })
      return ended.ok ? ended.state : null
    }
    const result = applyAction(state, action)
    if (result.ok) return result.state
    // An illegal suggestion must not wedge the game, so the turn is ended instead.
    const ended = applyAction(state, { type: 'end-turn' })
    return ended.ok ? ended.state : null
  }

  if (state.phase === 'current') {
    if (state.currentResolvedForRound === state.round) return null
    for (const player of state.players) {
      if (player.controller !== 'ai') continue
      const action = chooseAiAction(state, player.id)
      if (!action) continue
      const result = applyAction(state, action)
      if (result.ok) return result.state
    }
    // With nobody human left to play a card, the current resolves on its own.
    if (!hasHumanPlayers(state)) {
      const result = applyAction(state, { type: 'resolve-current' })
      if (result.ok) return result.state
    }
    return null
  }

  return null
}

/** Runs the game until it needs a person, or until it finishes. */
export function runUntilInput(state: GameState, maxSteps = MAX_AUTO_STEPS): GameState {
  let current = state
  for (let i = 0; i < maxSteps; i += 1) {
    const next = autoStep(current)
    if (!next) return current
    current = next
  }
  throw new Error(`Game did not settle within ${maxSteps} automatic steps.`)
}

/** Plays a game of AI players right through to the final score. */
export function playOutGame(state: GameState, maxSteps = MAX_AUTO_STEPS): GameState {
  let current = state
  for (let i = 0; i < maxSteps; i += 1) {
    if (current.phase === 'finished') return current
    const next = autoStep(current)
    if (!next) {
      throw new Error(
        `Game stalled in round ${current.round}, phase ${current.phase}, with no automatic ` +
          `step available. A human player is probably in the line-up.`,
      )
    }
    current = next
  }
  throw new Error(`Game did not finish within ${maxSteps} automatic steps.`)
}
