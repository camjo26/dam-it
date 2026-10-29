////////////////////////////////////////////////////////////////////////////////////////////////
// Computer opponents.
//
// The AI returns one action at a time and nothing else. It drives the game through applyAction
// exactly as a person does, so it can never make a move a player could not, and every decision
// it makes shows up in the game log. playAiTurn loops until the AI ends its turn, with a hard
// cap so a bad heuristic shows up as a loud failure rather than a hung browser.
////////////////////////////////////////////////////////////////////////////////////////////////

import { bottomBankRow, tileAt } from './board'
import { cardById } from './cards'
import {
  activeAnimalsOf,
  activePlayer,
  applyAction,
  autoPayment,
  canAfford,
  equipmentCost,
  totalResources,
  type GameAction,
} from './engine'
import { legalDestinations } from './movement'
import { deriveFloat } from './rng'
import { missionById } from './missions'
import { COLLECTOR_AREAS } from './rules'
import { saboteurUsesLeft } from './roles'
import type {
  AiDifficulty,
  Animal,
  EquipmentId,
  GameState,
  Player,
  ResourceId,
  Tile,
} from './types'
import { RESOURCE_IDS } from './types'

/** Hard cap on actions in one AI turn. Exceeding it means a heuristic is cycling. */
export const MAX_AI_ACTIONS_PER_TURN = 200

export interface AiWeights {
  /** Value of being one row closer to the far bank. */
  progress: number
  /** Penalty per point of current strength on the destination tile. */
  danger: number
  /** Bonus for standing on an island. */
  island: number
  /** Bonus, or penalty, for standing on a whirlpool. */
  whirlpool: number
  /** Bonus for stepping onto the far bank. */
  finish: number
  /** Resources the AI keeps back rather than spending. */
  reserve: number
  /** Chance of taking a random legal move instead of the best one. */
  noise: number
  buysEquipment: boolean
  playsCards: boolean
}

export const AI_WEIGHTS: Record<AiDifficulty, AiWeights> = {
  easy: {
    progress: 10,
    danger: 0,
    island: 0,
    whirlpool: 0,
    finish: 40,
    reserve: 6,
    noise: 0.35,
    buysEquipment: false,
    playsCards: false,
  },
  normal: {
    progress: 10,
    danger: 1.2,
    island: 1.5,
    whirlpool: 0.5,
    finish: 60,
    reserve: 2,
    noise: 0.08,
    buysEquipment: true,
    playsCards: true,
  },
  hard: {
    progress: 10,
    danger: 2.2,
    island: 3,
    whirlpool: 1.2,
    finish: 80,
    reserve: 0,
    noise: 0,
    buysEquipment: true,
    playsCards: true,
  },
}

/** Named opponents, so a solo game feels like facing somebody rather than a slider. */
export const AI_OPPONENTS: Record<AiDifficulty, { name: string; style: string }> = {
  easy: {
    name: 'Reedy',
    style: 'Paddles straight for the far bank and rarely bothers with equipment.',
  },
  normal: {
    name: 'Old Mottle',
    style: 'Reads the water, shelters on islands and buys when it can afford to.',
  },
  hard: {
    name: 'Grey Quill',
    style: 'Picks the quietest lane, hoards for Power Cards and uses them against you.',
  },
}

function weightsFor(player: Player): AiWeights {
  return AI_WEIGHTS[player.aiDifficulty] ?? AI_WEIGHTS.normal
}

/**
 * Average strength behind a face-down current token. Only tiles with a current above zero are
 * ever hidden, so the average is taken over those.
 */
export function expectedHiddenStrength(weights: number[]): number {
  let weighted = 0
  let total = 0
  for (let strength = 1; strength < weights.length; strength += 1) {
    weighted += strength * weights[strength]
    total += weights[strength]
  }
  return total > 0 ? weighted / total : 0
}

function perceivedCurrent(state: GameState, tile: Tile): number {
  if (tile.kind === 'island' && state.rules.board.islandsBlockCurrent) return 0
  if (tile.hidden && !tile.revealed) {
    return expectedHiddenStrength(state.rules.board.currentStrengthWeights)
  }
  return tile.current
}

/** How good it is for this animal to be standing on this square. */
function positionValue(
  state: GameState,
  player: Player,
  animal: Animal,
  col: number,
  row: number,
): number {
  const w = weightsFor(player)
  const finishRow = bottomBankRow(state.board)
  if (row >= finishRow) return w.finish + w.progress * finishRow

  const tile = tileAt(state.board, col, row)
  if (!tile) return -Infinity

  let value = w.progress * row
  value -= w.danger * perceivedCurrent(state, tile)

  if (tile.kind === 'island') {
    value += w.island
    // An animal chasing Island Hopper gains much more from a new island.
    const mission = missionById(state, player.missionId)
    if (mission?.check === 'island-hopper' && !animal.islandsVisited.includes(tile.id)) {
      value += w.island * 3
    }
  }

  if (tile.kind === 'whirlpool') {
    const mission = missionById(state, player.missionId)
    // A whirlpool sends an animal forward a third of the time and never backward, so it is
    // only mildly bad, and it is actively wanted by a player holding Risk Taker.
    value += mission?.check === 'whirlpool-survivor' ? w.whirlpool * 4 : -w.whirlpool
  }

  return value
}

interface MoveCandidate {
  animalId: string
  col: number
  row: number
  gain: number
}

function bestMove(state: GameState, player: Player): MoveCandidate | null {
  const candidates: MoveCandidate[] = []

  for (const animal of activeAnimalsOf(state, player.id)) {
    const here = positionValue(state, player, animal, animal.col, animal.row)
    for (const destination of legalDestinations(state, animal)) {
      const there = positionValue(state, player, animal, destination.col, destination.row)
      candidates.push({
        animalId: animal.id,
        col: destination.col,
        row: destination.row,
        gain: there - here,
      })
    }
  }

  if (candidates.length === 0) return null

  // Only ever take a step that improves the animal's position, which is what stops the AI
  // shuffling an animal back and forth and burning the clock.
  const improving = candidates.filter((c) => c.gain > 0)
  if (improving.length === 0) return null

  // Noise is derived from the seeded generator so an easy opponent is still reproducible.
  const w = weightsFor(player)
  if (w.noise > 0) {
    const roll = deriveFloat(state.rng, state.nextLogId)
    if (roll < w.noise) {
      const pickRoll = deriveFloat(state.rng, state.nextLogId + improving.length)
      return improving[Math.floor(pickRoll * improving.length)]
    }
  }

  return improving.reduce((best, c) => (c.gain > best.gain ? c : best))
}

/** The resource area the AI most wants this round, based on what it is short of. */
function chooseCollectorArea(state: GameState, player: Player): ResourceId {
  const wanted: Record<ResourceId, number> = { wood: 0, stone: 0, clay: 0, reeds: 0 }

  // Weight by what the things it wants to build actually cost.
  const targets: EquipmentId[] = ['dam', 'raft', 'anchor', 'rope']
  for (const item of targets) {
    if (!state.rules.equipment[item].enabled) continue
    const faction = state.rules.factions[player.factionId]
    if (faction.forbiddenEquipment.includes(item)) continue
    const cost = equipmentCost(state.rules, player.factionId, item)
    for (const id of RESOURCE_IDS) {
      const shortfall = Math.max(0, cost[id] - player.resources[id])
      wanted[id] += shortfall
    }
  }

  // Everything is useful toward a Power Card, so break ties toward the smallest stock.
  for (const id of RESOURCE_IDS) wanted[id] += 1 / (1 + player.resources[id])

  let best: ResourceId = COLLECTOR_AREAS[0]
  for (const id of COLLECTOR_AREAS) {
    if (wanted[id] > wanted[best]) best = id
  }
  return best
}

function chooseEquipmentPurchase(state: GameState, player: Player): EquipmentId | null {
  const w = weightsFor(player)
  if (!w.buysEquipment) return null

  const faction = state.rules.factions[player.factionId]
  const animals = activeAnimalsOf(state, player.id)
  if (animals.length === 0) return null

  const affordable = (item: EquipmentId): boolean => {
    if (!state.rules.equipment[item].enabled) return false
    if (faction.forbiddenEquipment.includes(item)) return false
    return canAfford(player, equipmentCost(state.rules, player.factionId, item))
  }

  // A raft is pure progress, so take one whenever it is affordable.
  if (affordable('raft')) return 'raft'

  // An anchor is worth it when an animal is sitting in genuinely fast water.
  const inFastWater = animals.some((animal) => {
    const tile = tileAt(state.board, animal.col, animal.row)
    return tile ? perceivedCurrent(state, tile) >= 2 : false
  })
  if (inFastWater && affordable('anchor')) return 'anchor'

  // Beavers get their discount on dams, so they are the ones who build them.
  if (faction.buildDiscount > 0 && affordable('dam')) return 'dam'

  return null
}

function damSpot(state: GameState, player: Player): { col: number; row: number } | null {
  let best: { col: number; row: number; score: number } | null = null
  for (const animal of activeAnimalsOf(state, player.id)) {
    const tile = tileAt(state.board, animal.col, animal.row)
    if (!tile || tile.kind === 'bank-top' || tile.kind === 'bank-bottom') continue
    if (state.dams.some((d) => d.col === tile.col && d.row === tile.row)) continue
    const score = perceivedCurrent(state, tile)
    if (!best || score > best.score) best = { col: tile.col, row: tile.row, score }
  }
  return best ? { col: best.col, row: best.row } : null
}

/** Picks a legal target for a card the AI holds, or null if it cannot use it sensibly. */
function cardPlay(state: GameState, player: Player): GameAction | null {
  const w = weightsFor(player)
  if (!w.playsCards) return null
  if (player.powerCardsPlayedThisRound >= state.rules.powerCards.playsPerPlayerPerRound) {
    return null
  }

  const mine = activeAnimalsOf(state, player.id)
  const theirs = state.animals.filter(
    (a) => a.playerId !== player.id && a.status !== 'finished',
  )
  const leader = mine.reduce<Animal | null>(
    (best, a) => (best === null || a.row > best.row ? a : best),
    null,
  )

  for (const held of player.hand) {
    const card = cardById(state, held.cardId)
    if (!card) continue

    const play = (target: Record<string, unknown>): GameAction => ({
      type: 'play-power-card',
      playerId: player.id,
      instanceId: held.instanceId,
      target,
    })

    switch (card.id) {
      case 'tow':
        if (leader) return play({ animalId: leader.id })
        break
      case 'double-move':
        if (leader) return play({ animalId: leader.id })
        break
      case 'rescue': {
        if (!leader) break
        const island = state.board.tiles.find(
          (t) =>
            t.kind === 'island' &&
            Math.abs(t.col - leader.col) <= 1 &&
            Math.abs(t.row - leader.row) <= 1,
        )
        if (island) return play({ animalId: leader.id, tileId: island.id })
        break
      }
      case 'free-resources':
        return play({ resources: ['wood', 'reeds'] })
      case 'push': {
        const target = theirs.reduce<Animal | null>(
          (best, a) => (best === null || a.row > best.row ? a : best),
          null,
        )
        if (target) return play({ animalId: target.id, direction: 'backward' })
        break
      }
      case 'pull': {
        const target = theirs.reduce<Animal | null>(
          (best, a) => (best === null || a.row > best.row ? a : best),
          null,
        )
        if (target) return play({ animalId: target.id, direction: 'left' })
        break
      }
      case 'current-shield':
        if (leader) return play({ animalId: leader.id })
        break
      case 'calm-water': {
        if (!leader) break
        const tile = tileAt(state.board, leader.col, leader.row)
        if (tile && perceivedCurrent(state, tile) > 0) return play({ tileId: tile.id })
        break
      }
      case 'surge': {
        const target = theirs.reduce<Animal | null>(
          (best, a) => (best === null || a.row > best.row ? a : best),
          null,
        )
        if (!target) break
        const tile = tileAt(state.board, target.col, target.row)
        if (tile) return play({ tileId: tile.id })
        break
      }
      default:
        break
    }
  }

  return null
}

/**
 * The single next thing this AI player wants to do, or null when it has nothing left.
 * Mirrors what a person can do through the interface, in the same phases.
 */
export function chooseAiAction(state: GameState, playerId: string): GameAction | null {
  const player = state.players.find((p) => p.id === playerId)
  if (!player) return null

  // Phase A: put the collector down.
  if (state.phase === 'resource') {
    if (player.collectorArea === null) {
      return { type: 'place-collector', playerId, area: chooseCollectorArea(state, player) }
    }
    return null
  }

  // The window before the current is resolved: arm anything that belongs there.
  if (state.phase === 'current') {
    if (state.currentResolvedForRound === state.round) return null
    const card = cardPlay(state, player)
    if (card) return card
    if (saboteurUsesLeft(state, player) > 0) {
      const theirs = state.animals.filter(
        (a) => a.playerId !== player.id && a.status !== 'finished',
      )
      const target = theirs.reduce<Animal | null>(
        (best, a) => (best === null || a.row > best.row ? a : best),
        null,
      )
      if (target) {
        const tile = tileAt(state.board, target.col, target.row)
        if (tile) return { type: 'saboteur-surge', playerId, tileId: tile.id }
      }
    }
    return null
  }

  if (state.phase !== 'player-turns') return null
  if (activePlayer(state)?.id !== playerId) return null

  // Use anything already bought, since it costs no movement.
  if (player.equipment.dam > 0) {
    const spot = damSpot(state, player)
    if (spot) return { type: 'place-dam', col: spot.col, row: spot.row }
  }

  if (player.equipment.raft > 0) {
    const leader = activeAnimalsOf(state, player.id).reduce<Animal | null>(
      (best, a) => (best === null || a.row > best.row ? a : best),
      null,
    )
    if (leader && leader.row < bottomBankRow(state.board)) {
      return { type: 'use-raft', animalId: leader.id }
    }
  }

  if (player.equipment.anchor > 0) {
    const exposed = activeAnimalsOf(state, player.id).find((animal) => {
      if (animal.anchoredThroughRound !== null) return false
      const tile = tileAt(state.board, animal.col, animal.row)
      return tile ? perceivedCurrent(state, tile) >= 2 : false
    })
    if (exposed) return { type: 'use-anchor', animalId: exposed.id }
  }

  // Spend the action, if there is one worth spending it on.
  if (player.actionsRemaining > 0) {
    const card = cardPlay(state, player)
    if (card) return card

    const purchase = chooseEquipmentPurchase(state, player)
    if (purchase) return { type: 'buy-equipment', item: purchase }

    const w = weightsFor(player)
    const spare = totalResources(player) - w.reserve
    const mission = missionById(state, player.missionId)
    const wantsCards = mission?.check === 'power-cards-bought'
    if (
      w.playsCards &&
      state.rules.powerCards.enabled &&
      state.powerDeck.length > 0 &&
      (spare >= state.rules.powerCards.cost || wantsCards) &&
      autoPayment(player, state.rules.powerCards.cost) !== null
    ) {
      return { type: 'buy-power-card' }
    }
  }

  // Then move.
  const move = bestMove(state, player)
  if (move) {
    return { type: 'move-animal', animalId: move.animalId, col: move.col, row: move.row }
  }

  return { type: 'end-turn' }
}

export interface AiTurnResult {
  state: GameState
  actions: GameAction[]
}

/**
 * Runs one AI player until it has nothing left to do. Throws rather than looping forever if a
 * heuristic starts cycling, so the failure is obvious in tests and in the simulator.
 */
export function playAiTurn(
  state: GameState,
  playerId: string,
  maxActions: number = MAX_AI_ACTIONS_PER_TURN,
): AiTurnResult {
  let current = state
  const actions: GameAction[] = []

  for (let i = 0; i < maxActions; i += 1) {
    const action = chooseAiAction(current, playerId)
    if (!action) return { state: current, actions }

    const result = applyAction(current, action)
    if (!result.ok) {
      // A rejected action means the heuristic suggested something illegal. End the turn
      // rather than retrying the same thing forever.
      if (action.type === 'end-turn') return { state: current, actions }
      const ended = applyAction(current, { type: 'end-turn' })
      return { state: ended.ok ? ended.state : current, actions }
    }

    current = result.state
    actions.push(action)
    if (action.type === 'end-turn') return { state: current, actions }
  }

  throw new Error(
    `AI for ${playerId} exceeded ${maxActions} actions in one turn, which means a heuristic ` +
      `is cycling.`,
  )
}
