////////////////////////////////////////////////////////////////////////////////////////////////
// Core domain types for Dam It.
//
// Board coordinates: `col` runs 0..width-1 from left to right, which is the direction the
// river flows. `row` 0 is the top bank, rows 1..riverDepth are river rows, and row
// riverDepth+1 is the bottom bank. Animals cross from row 0 down to row riverDepth+1.
////////////////////////////////////////////////////////////////////////////////////////////////

import type { GameRules } from './rules'

export type ResourceId = 'wood' | 'stone' | 'clay' | 'reeds'

export const RESOURCE_IDS: ResourceId[] = ['wood', 'stone', 'clay', 'reeds']

export const RESOURCE_LABELS: Record<ResourceId, string> = {
  wood: 'Wood',
  stone: 'Stone',
  clay: 'Clay',
  reeds: 'Reeds',
}

export type ResourceBag = Record<ResourceId, number>

export type FactionId = 'ducks' | 'swans' | 'frogs' | 'beavers'

export const FACTION_IDS: FactionId[] = ['ducks', 'swans', 'frogs', 'beavers']

export type TileKind = 'bank-top' | 'bank-bottom' | 'river' | 'island' | 'whirlpool'

export type IslandSize = 'small' | 'large'

/**
 * Which way a tile's current pushes. Forward is toward the far bank and back is toward the
 * starting bank, so a tile can cost an animal its progress rather than only its position.
 */
export type CurrentDirection = 'right' | 'left' | 'forward' | 'back'

export const CURRENT_DIRECTIONS: CurrentDirection[] = ['left', 'right', 'forward', 'back']

export const CURRENT_VECTORS: Record<CurrentDirection, { dc: number; dr: number }> = {
  left: { dc: -1, dr: 0 },
  right: { dc: 1, dr: 0 },
  forward: { dc: 0, dr: 1 },
  back: { dc: 0, dr: -1 },
}

export const SIDEWAYS_DIRECTIONS: CurrentDirection[] = ['left', 'right']

export interface Tile {
  id: string
  col: number
  row: number
  kind: TileKind
  islandSize?: IslandSize
  /** Base current strength of this tile, 0..4. Banks and islands are normally 0. */
  current: number
  /** Which way this tile's current pushes. Meaningless when `current` is 0. */
  direction: CurrentDirection
  /** Hidden currents are not shown to players until an animal enters the tile. */
  hidden: boolean
  revealed: boolean
}

export interface Board {
  width: number
  riverDepth: number
  tiles: Tile[]
}

/**
 * `lost` is an animal the river carried off the side of the board. It is out of the game and
 * scores nothing, which is what makes a strong sideways current near an edge genuinely
 * dangerous rather than merely annoying.
 */
export type AnimalStatus = 'bank' | 'river' | 'finished' | 'lost'

export interface Animal {
  id: string
  factionId: FactionId
  playerId: string
  col: number
  row: number
  status: AnimalStatus
  /** Round number up to and including which an anchor protects this animal. */
  anchoredThroughRound: number | null
  /** Round number during whose Current Phase a Current Shield protects this animal. */
  shieldedForRound: number | null
  /** Extra movement points granted to this animal only, for the current turn. */
  bonusMovement: number
  /** Times this animal has been moved by the current. Feeds the Against the Current mission. */
  movedByCurrentCount: number
  /** Island tile ids this animal has landed on. Feeds the Island Hopper mission. */
  islandsVisited: string[]
  /** Set when the animal has been through a whirlpool. Feeds the Risk Taker mission. */
  crossedWhirlpool: boolean
  finishedOnRound: number | null
}

export interface Dam {
  id: string
  ownerPlayerId: string
  col: number
  row: number
  /** Animal the owner has barred from this dam's calming effect, for `excludedForRound`. */
  excludedAnimalId: string | null
  excludedForRound: number | null
  builtOnRound: number
}

export type EquipmentId = 'dam' | 'raft' | 'rope' | 'anchor'

export const EQUIPMENT_IDS: EquipmentId[] = ['dam', 'raft', 'rope', 'anchor']

export interface PlayerStats {
  structuresBuilt: number
  damsDestroyed: number
  powerCardsBought: number
  powerCardsPlayed: number
  resourcesGained: ResourceBag
  resourcesSpent: ResourceBag
  animalsFinished: number
  /** Animals the river carried off the side of the board. */
  animalsLost: number
  tradesAccepted: number
  currentMovesSuffered: number
  /** Animals across at the end of each round. Index 0 is round 1. */
  acrossByRound: number[]
}

export interface PowerCardInstance {
  instanceId: string
  cardId: string
}

export type ControllerKind = 'human' | 'ai'

export type AiDifficulty = 'easy' | 'normal' | 'hard'

export interface Player {
  id: string
  name: string
  factionId: FactionId
  controller: ControllerKind
  aiDifficulty: AiDifficulty
  resources: ResourceBag
  /** Equipment bought but not yet used or placed. */
  equipment: Record<EquipmentId, number>
  hand: PowerCardInstance[]
  missionId: string | null
  missionComplete: boolean
  roleId: RoleId | null
  /** Areas this player's collectors are sitting in. Two collectors may share one area. */
  collectors: ResourceId[]
  /** Unplayed Distraction tokens. One per player per game by default. */
  distractionTokens: number
  movementRemaining: number
  actionsRemaining: number
  powerCardsPlayedThisRound: number
  stats: PlayerStats
}

export type RoleId = 'saboteur' | 'hoarder' | 'champion' | 'none'

export type PowerCardTiming = 'turn' | 'before-current' | 'whirlpool'

export interface PowerCardDef {
  id: string
  name: string
  text: string
  timing: PowerCardTiming
  copies: number
  /** The number in the card's effect: squares moved, or strength added or removed. */
  magnitude: number
}

export type MissionCheckId =
  | 'animals-across'
  | 'dams-destroyed'
  | 'structures-built'
  | 'one-of-each-resource'
  | 'whirlpool-survivor'
  | 'power-cards-bought'
  | 'island-hopper'
  | 'current-rider'

export interface MissionDef {
  id: string
  name: string
  text: string
  check: MissionCheckId
  /** Threshold the check compares against, for example 5 animals across. */
  target: number
  points: number
  enabled: boolean
}

export type GamePhase = 'setup' | 'resource' | 'player-turns' | 'current' | 'finished'

export interface LogEntry {
  id: number
  round: number
  phase: GamePhase
  playerId: string | null
  /** Short machine-readable tag so the log can be filtered and exported. */
  kind: string
  message: string
  /** Set on entries that explain a board movement, for the "why did that move" view. */
  detail?: string
}

export interface RngState {
  seed: string
  counter: number
}

/** A modifier applied to a tile for the coming Current Phase only. */
export interface TileModifier {
  id: string
  tileId: string
  /** Added to the tile's current strength. Negative for Calm Water. */
  deltaStrength: number
  /** Overrides the direction the current pushes animals on this tile. */
  overrideDirection: CurrentDirection | null
  sourcePlayerId: string
  sourceLabel: string
  forRound: number
}

export interface CurrentStep {
  index: number
  animalId: string
  factionId: FactionId
  from: { col: number; row: number }
  to: { col: number; row: number }
  /** Human readable explanation of exactly why the animal ended up where it did. */
  reason: string
  baseStrength: number
  effectiveStrength: number
  whirlpool: null | { direction: 'left' | 'right' | 'forward'; roll: number }
  finished: boolean
  /** The river carried this animal over the side and out of the game. */
  lost: boolean
}

export interface ProductionCardDef {
  id: string
  name: string
  /** Resources produced for each collector sitting in that area. Never below 1. */
  yields: ResourceBag
  copies: number
}

/** One side of a trade: what that player hands over. */
export interface TradeTerms {
  resources: ResourceBag
  cardInstanceIds: string[]
}

export type TradeStatus = 'awaiting-reply' | 'countered' | 'settled'

/**
 * A trade being negotiated. Cards are asked for by count rather than by name, because a hand
 * is secret: you can offer a card you can see, but you cannot name one you cannot.
 */
export interface TradeProposal {
  id: string
  fromPlayerId: string
  toPlayerId: string
  /** What the proposer hands over if the deal closes. */
  offer: TradeTerms
  /** What the proposer asked for. */
  request: { resources: ResourceBag; cardCount: number }
  status: TradeStatus
  /** Set when the other player answers with different terms of their own. */
  counter?: TradeTerms
  /** What the other player said, in words, shown to the proposer. */
  reply?: string
}

/** One animal's die roll against a Distraction token. */
export interface DistractionRoll {
  animalId: string
  playerId: string
  factionId: FactionId
  roll: number
  /** The roll this animal needed to shrug the distraction off. */
  neededRoll: number
  distracted: boolean
  /** Squares this animal has already been dragged toward the token. */
  movedSoFar: number
}

/**
 * A played Distraction token waiting to be resolved. The dice are rolled when the token
 * lands, so the player sees who it caught before deciding how far to drag each of them,
 * and no other action can be taken until it is finished.
 */
export interface PendingDistraction {
  placerId: string
  col: number
  row: number
  rolls: DistractionRoll[]
}

export interface ProductionState {
  drawPile: string[]
  discardPile: string[]
  lastRevealedCardId: string | null
}

export interface ScoreBreakdown {
  playerId: string
  factionId: FactionId
  playerName: string
  animalsAcross: number
  animalPoints: number
  missionId: string | null
  missionName: string | null
  missionComplete: boolean
  missionPoints: number
  roleId: RoleId | null
  roleBonus: number
  roleQualified: boolean
  roleExplanation: string
  total: number
}

export interface GameResult {
  breakdowns: ScoreBreakdown[]
  winningPlayerIds: string[]
  tieExplanation: string | null
}

export interface GameState {
  id: string
  createdAt: string
  rules: GameRules
  rng: RngState
  board: Board
  players: Player[]
  animals: Animal[]
  dams: Dam[]
  turnOrder: string[]
  round: number
  phase: GamePhase
  activePlayerIndex: number
  log: LogEntry[]
  nextLogId: number
  production: ProductionState
  powerDeck: string[]
  powerDiscard: string[]
  missionDeck: string[]
  tileModifiers: TileModifier[]
  /** Animal ids armed with a Whirlpool card, forcing a re-roll when their whirlpool resolves. */
  pendingWhirlpoolRerolls: string[]
  /** Saboteur ability uses spent this round, keyed by player id. */
  saboteurUsesThisRound: Record<string, number>
  /** A Distraction token that has been played and whose drags are still being chosen. */
  pendingDistraction: PendingDistraction | null
  /** A trade on the table, waiting for an answer from one side or the other. */
  pendingTrade: TradeProposal | null
  /** Trades proposed this turn, keyed by player id, against the per-turn limit. */
  tradesProposedThisTurn: Record<string, number>
  /** Populated while the Current Phase is being stepped through for display. */
  currentSteps: CurrentStep[]
  /** Guards against the Current Phase being resolved twice in one round. */
  currentResolvedForRound: number | null
  resourcesCollectedForRound: number | null
  rolesDealt: boolean
  result: GameResult | null
  /** Serialised snapshots taken during the active player's turn, for undo. */
  undoStack: string[]
}

export type ActionResult =
  | { ok: true; state: GameState }
  | { ok: false; error: string }

export function emptyResourceBag(): ResourceBag {
  return { wood: 0, stone: 0, clay: 0, reeds: 0 }
}
