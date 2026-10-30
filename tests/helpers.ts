////////////////////////////////////////////////////////////////////////////////////////////////
// Shared test helpers: build a game with a predictable board so a rule can be tested on its own.
////////////////////////////////////////////////////////////////////////////////////////////////

import { applyAction, type GameAction } from '../src/game/engine'
import { placeAnimal } from '../src/game/movement'
import { defaultRules, type GameRules } from '../src/game/rules'
import { createGame } from '../src/game/setup'
import type { Animal, FactionId, GameState } from '../src/game/types'
import { FACTION_IDS } from '../src/game/types'

export interface TestGameOptions {
  /** Every river tile gets this current strength. */
  currentStrength?: number
  /** Weights for left, right, forward and back. Defaults to every tile running right. */
  directionWeights?: number[]
  sidewaysOnlyFrom?: number
  /** Everything is face up by default, so tests do not have to reveal tiles first. */
  visibleCurrents?: number
  islands?: GameRules['board']['islands']
  whirlpools?: GameRules['board']['whirlpools']
  seed?: string
  tweak?: (rules: GameRules) => void
}

export function makeGame(options: TestGameOptions = {}): GameState {
  const rules = defaultRules()
  const strength = options.currentStrength ?? 0

  // A weight array with a single non-zero entry makes every river tile that strength.
  rules.board.currentStrengthWeights = [0, 0, 0, 0, 0]
  rules.board.currentStrengthWeights[strength] = 1
  // Likewise for direction: tests that care about the push want it to run one known way.
  rules.board.currentDirectionWeights = options.directionWeights ?? [0, 1, 0, 0]
  rules.board.sidewaysOnlyFromStrength = options.sidewaysOnlyFrom ?? 4
  // Everything face up unless a test is specifically about hidden water.
  rules.board.visibleCurrents = options.visibleCurrents ?? Number.MAX_SAFE_INTEGER
  rules.board.islands = options.islands ?? []
  rules.board.whirlpools = options.whirlpools ?? []
  rules.ai.stepDelayMs = 0
  options.tweak?.(rules)

  return createGame({
    rules,
    seed: options.seed ?? 'TEST',
    players: FACTION_IDS.map((factionId) => ({
      factionId,
      name: rules.factions[factionId].name,
      controller: 'human' as const,
    })),
  })
}

/** Applies an action and throws with the engine's own message if it was rejected. */
export function must(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action)
  if (!result.ok) throw new Error(`Action ${action.type} rejected: ${result.error}`)
  return result.state
}

export function expectRejected(state: GameState, action: GameAction): string {
  const result = applyAction(state, action)
  if (result.ok) throw new Error(`Action ${action.type} was expected to be rejected`)
  return result.error
}

export function playerOf(state: GameState, factionId: FactionId) {
  const player = state.players.find((p) => p.factionId === factionId)
  if (!player) throw new Error(`No player for ${factionId}`)
  return player
}

export function animalsOf(state: GameState, factionId: FactionId): Animal[] {
  const player = playerOf(state, factionId)
  return state.animals.filter((a) => a.playerId === player.id)
}

/** Moves an animal onto a square directly, bypassing movement points. */
export function put(state: GameState, animal: Animal, col: number, row: number): void {
  placeAnimal(state, animal, col, row)
}

/** Takes every player past the Resource Phase, with every collector in a fixed area. */
export function startPlayerTurns(state: GameState): GameState {
  let current = state
  const perPlayer = current.rules.production.collectorsPerPlayer
  for (const player of current.players) {
    for (let i = player.collectors.length; i < perPlayer; i += 1) {
      current = must(current, { type: 'place-collector', playerId: player.id, area: 'wood' })
    }
  }
  return must(current, { type: 'resolve-production' })
}

/** Ends every remaining player turn so the game reaches the Current Phase window. */
export function reachCurrentPhase(state: GameState): GameState {
  let current = state
  let guard = 0
  while (current.phase === 'player-turns' && guard < 20) {
    current = must(current, { type: 'end-turn' })
    guard += 1
  }
  return current
}

/** Gives a player enough of everything to buy whatever a test needs. */
export function stockUp(state: GameState, factionId: FactionId, amount = 20): void {
  const player = playerOf(state, factionId)
  player.resources.wood = amount
  player.resources.stone = amount
  player.resources.clay = amount
  player.resources.reeds = amount
}
