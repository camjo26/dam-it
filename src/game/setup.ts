////////////////////////////////////////////////////////////////////////////////////////////////
// New game setup: board, players, animals, decks and the opening Resource Phase.
////////////////////////////////////////////////////////////////////////////////////////////////

import { createBoard } from './board'
import { addLog } from './log'
import type { GameRules } from './rules'
import { cloneRules } from './rules'
import { createRng, shuffle } from './rng'
import {
  emptyResourceBag,
  FACTION_IDS,
  type AiDifficulty,
  type ControllerKind,
  type FactionId,
  type GameState,
  type Player,
  type RngState,
  type Animal,
} from './types'

export interface PlayerSetup {
  factionId: FactionId
  name: string
  controller: ControllerKind
  aiDifficulty?: AiDifficulty
}

export interface NewGameOptions {
  rules: GameRules
  seed: string
  players: PlayerSetup[]
}

function buildDeck(entries: Array<{ id: string; copies: number }>): string[] {
  const deck: string[] = []
  for (const entry of entries) {
    for (let i = 0; i < Math.max(0, entry.copies); i += 1) deck.push(entry.id)
  }
  return deck
}

function createPlayer(setup: PlayerSetup, index: number, rules: GameRules): Player {
  const faction = rules.factions[setup.factionId]
  return {
    id: `p${index + 1}`,
    name: setup.name || faction.name,
    factionId: setup.factionId,
    controller: setup.controller,
    aiDifficulty: setup.aiDifficulty ?? rules.ai.difficulty,
    resources: { ...rules.game.startingResources },
    equipment: { dam: 0, raft: 0, rope: 0, anchor: 0 },
    hand: [],
    missionId: null,
    missionComplete: false,
    roleId: null,
    collectors: [],
    distractionTokens: rules.distraction.enabled ? rules.distraction.tokensPerPlayer : 0,
    movementRemaining: 0,
    actionsRemaining: 0,
    powerCardsPlayedThisRound: 0,
    stats: {
      structuresBuilt: 0,
      damsDestroyed: 0,
      powerCardsBought: 0,
      powerCardsPlayed: 0,
      resourcesGained: emptyResourceBag(),
      resourcesSpent: emptyResourceBag(),
      animalsFinished: 0,
      animalsLost: 0,
      tradesAccepted: 0,
      currentMovesSuffered: 0,
      acrossByRound: [],
    },
  }
}

/** Spreads a faction's animals across the top bank so starting lanes differ per faction. */
function createAnimals(player: Player, rules: GameRules, boardWidth: number): Animal[] {
  const faction = rules.factions[player.factionId]
  const animals: Animal[] = []
  const factionIndex = FACTION_IDS.indexOf(player.factionId)
  for (let i = 0; i < faction.startingAnimals; i += 1) {
    // Interleave factions along the bank rather than clumping them into blocks.
    const col = (i * FACTION_IDS.length + factionIndex) % boardWidth
    animals.push({
      id: `${player.id}-a${i + 1}`,
      factionId: player.factionId,
      playerId: player.id,
      col,
      row: 0,
      status: 'bank',
      anchoredThroughRound: null,
      shieldedForRound: null,
      bonusMovement: 0,
      movedByCurrentCount: 0,
      islandsVisited: [],
      crossedWhirlpool: false,
      finishedOnRound: null,
    })
  }
  return animals
}

export function createGame(options: NewGameOptions): GameState {
  const rules = cloneRules(options.rules)
  let rng: RngState = createRng(options.seed)

  const [board, afterBoard] = createBoard(rules, rng)
  rng = afterBoard

  const players = options.players.map((setup, index) => createPlayer(setup, index, rules))
  const animals = players.flatMap((player) => createAnimals(player, rules, board.width))

  const [powerDeck, afterPower] = shuffle(rng, buildDeck(rules.powerCards.deck))
  rng = afterPower

  const [productionDeck, afterProduction] = shuffle(rng, buildDeck(rules.production.cards))
  rng = afterProduction

  const enabledMissions = rules.missions.cards.filter((m) => m.enabled).map((m) => m.id)
  const [missionDeck, afterMissions] = shuffle(rng, enabledMissions)
  rng = afterMissions

  const state: GameState = {
    id: `game-${Date.now()}`,
    createdAt: new Date().toISOString(),
    rules,
    rng,
    board,
    players,
    animals,
    dams: [],
    turnOrder: players.map((p) => p.id),
    round: 1,
    phase: 'setup',
    activePlayerIndex: 0,
    log: [],
    nextLogId: 1,
    production: {
      drawPile: productionDeck,
      discardPile: [],
      lastRevealedCardId: null,
    },
    powerDeck,
    powerDiscard: [],
    missionDeck,
    tileModifiers: [],
    pendingWhirlpoolRerolls: [],
    saboteurUsesThisRound: {},
    pendingDistraction: null,
    pendingTrade: null,
    tradesProposedThisTurn: {},
    currentSteps: [],
    currentResolvedForRound: null,
    resourcesCollectedForRound: null,
    rolesDealt: false,
    result: null,
    undoStack: [],
  }

  addLog(state, {
    kind: 'setup',
    message: `New game started. Seed ${options.seed}, ${rules.game.rounds} rounds.`,
    detail: `Board ${board.width} wide by ${board.riverDepth} river rows.`,
  })

  if (rules.missions.enabled) {
    dealMissions(state)
  }

  state.phase = 'resource'
  return state
}

function dealMissions(state: GameState): void {
  for (const player of state.players) {
    const missionId = state.missionDeck.shift() ?? null
    player.missionId = missionId
    if (missionId) {
      const mission = state.rules.missions.cards.find((m) => m.id === missionId)
      addLog(state, {
        kind: 'mission-dealt',
        playerId: player.id,
        message: `${player.name} received a secret mission.`,
        detail: mission ? `${mission.name} (hidden from other players)` : undefined,
      })
    }
  }
}

/** The standard solo setup: the human takes the Ducks, three AI opponents take the rest. */
export function defaultSoloPlayers(rules: GameRules): PlayerSetup[] {
  return FACTION_IDS.map((factionId, index) => ({
    factionId,
    name: rules.factions[factionId].name,
    controller: index === 0 ? ('human' as const) : ('ai' as const),
    aiDifficulty: rules.ai.difficulty,
  }))
}

export function defaultHotSeatPlayers(rules: GameRules): PlayerSetup[] {
  return FACTION_IDS.map((factionId) => ({
    factionId,
    name: rules.factions[factionId].name,
    controller: 'human' as const,
  }))
}
