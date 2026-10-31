////////////////////////////////////////////////////////////////////////////////////////////////
// The single central configuration for Dam It.
//
// Everything the engine treats as a tunable lives in this structure. Nothing in the engine
// hard-codes a cost, a strength, a limit or a bonus. The rules editor edits this object, the
// engine reads it, and a saved game carries the exact rules it was played with.
//
// Rules are tagged in PROVISIONAL_NOTES below as either established (supplied in the design
// brief and the printed components) or provisional (a reversible default chosen so the
// prototype is playable). See rulesNotes.ts for the full three-way split.
////////////////////////////////////////////////////////////////////////////////////////////////

import type {
  AiDifficulty,
  CurrentDirection,
  EquipmentId,
  FactionId,
  MissionDef,
  PowerCardDef,
  ProductionCardDef,
  ResourceBag,
  ResourceId,
} from './types'

export type CurrentOrderId =
  | 'downstream-first'
  | 'upstream-first'
  | 'turn-order'
  | 'row-then-column'

export type WhirlpoolTrigger = 'end-of-current-move' | 'any-tile-entered'

export type EdgeBehaviour = 'stop-at-edge' | 'wrap-around'

export type DamCalmAxis = 'vertical' | 'horizontal'

export interface IslandSpec {
  col: number
  row: number
  size: 'small' | 'large'
}

export interface WhirlpoolSpec {
  col: number
  row: number
}

export interface FactionRules {
  id: FactionId
  name: string
  colour: string
  startingAnimals: number
  movementPoints: number
  actionsPerTurn: number
  /** Ducks: extra spaces moved in the current's direction after the current moves them. */
  goWithTheFlowBonus: number
  /** Swans: spaces subtracted from the current's effective strength. */
  currentResistance: number
  /** Beavers: resources removed from the cost of anything they build. */
  buildDiscount: number
  /** Frogs cannot use these equipment items. */
  forbiddenEquipment: EquipmentId[]
}

export interface EquipmentRules {
  cost: ResourceBag
  /** Buying this item consumes the turn's action. */
  purchaseUsesAction: boolean
  /** Using the item later also consumes an action. */
  useUsesAction: boolean
  enabled: boolean
}

export interface GameRules {
  game: {
    rounds: number
    /** Animals that reach the bottom bank are taken off the board and can no longer be
     *  targeted or moved. They still score. */
    finishedAnimalsLeaveBoard: boolean
    allowUndo: boolean
    startingResources: ResourceBag
  }
  board: {
    width: number
    riverDepth: number
    islands: IslandSpec[]
    whirlpools: WhirlpoolSpec[]
    islandsBlockCurrent: boolean
    /** Relative weights for rolling each river tile's current strength, index 0..4. */
    currentStrengthWeights: number[]
    /** Relative weights for rolling a tile's direction: left, right, forward, back. */
    currentDirectionWeights: number[]
    /**
     * How many flowing river tiles start face up. Every other current is hidden until an
     * animal stands on it, so the river has to be learned the hard way.
     */
    visibleCurrents: number
    /** Strength at or above which a current may only run sideways, never up or down the river. */
    sidewaysOnlyFromStrength: number
    /**
     * Animals that fit on one river square. Banks are exempt, since every animal starts
     * stacked on the top bank. The current ignores it: see MAX_ANIMALS_NOTE in movement.ts.
     */
    maxAnimalsPerTile: number
  }
  movement: {
    allowDiagonal: boolean
    allowBackward: boolean
    costPerTile: number
  }
  current: {
    /** The way the river runs as a whole. Each tile rolls its own direction from this. */
    direction: CurrentDirection
    edgeBehaviour: EdgeBehaviour
    resolutionOrder: CurrentOrderId
    /** Current pushes animals that are on the top bank as well. Normally false. */
    affectsBankAnimals: boolean
  }
  whirlpool: {
    enabled: boolean
    weightLeft: number
    weightRight: number
    weightForward: number
    distance: number
    trigger: WhirlpoolTrigger
    maxEffectsPerAnimalPerPhase: number
  }
  factions: Record<FactionId, FactionRules>
  distraction: {
    enabled: boolean
    /** Tokens each player starts the game with. */
    tokensPerPlayer: number
    playUsesAction: boolean
    /** Every animal this far from the token, or nearer, must roll. */
    radius: number
    dieSides: number
    /** Rolling this value or higher shrugs the distraction off. */
    avoidOnRoll: number
    /** Factions that need a higher roll than everyone else, and the roll they need. */
    hardToDistract: FactionId[]
    hardAvoidOnRoll: number
    /** Squares the player who placed the token may drag each distracted animal. */
    pullDistance: number
  }
  production: {
    cards: ProductionCardDef[]
    /** Collectors each player places in the Resource Phase. They may share one area. */
    collectorsPerPlayer: number
    /** Subtracted from each player's yield when more than one collector shares an area. */
    sharingPenalty: number
    minimumYield: number
    /** Collectors are re-assigned every round rather than staying put. */
    reassignEachRound: boolean
  }
  equipment: Record<EquipmentId, EquipmentRules>
  equipmentEffects: {
    /** Squares a Raft moves an animal forward. */
    raftDistance: number
    /** How far apart two of your animals may be for a Rope to reach. */
    ropeRange: number
    /** Squares a Rope moves the chosen animal toward the other one. */
    ropeDistance: number
    /** Rounds an Anchor keeps protecting the animal, counting the round it is used. */
    anchorRounds: number
  }
  dam: {
    calmAxis: DamCalmAxis
    calmRadius: number
    calmsOwnTile: boolean
    destroyCost: ResourceBag
    destroyUsesAction: boolean
    /** Animals immediately downstream of a destroyed dam are swept this many spaces. */
    sweepDistance: number
    /** The owner may bar one animal per round from the dam's calming effect. */
    exclusionsPerRound: number
  }
  powerCards: {
    enabled: boolean
    /** Total resources of any mix needed to draw one card. */
    cost: number
    purchaseUsesAction: boolean
    playsPerPlayerPerRound: number
    deck: PowerCardDef[]
  }
  missions: {
    enabled: boolean
    cards: MissionDef[]
  }
  roles: {
    enabled: boolean
    /** Roles are dealt at the end of this round. */
    dealAfterRound: number
    bonusPoints: number
    minAnimalsAcross: number
    saboteur: {
      abilityEnabled: boolean
      /** Free current increase the Saboteur may apply to one tile each round. */
      surgeStrength: number
      usesPerRound: number
    }
  }
  scoring: {
    pointsPerAnimalAcross: number
  }
  ai: {
    difficulty: AiDifficulty
    /** Milliseconds between AI steps so turns are watchable. 0 runs them instantly. */
    stepDelayMs: number
  }
}

const DUCK_COLOUR = '#e8b23a'
const SWAN_COLOUR = '#e6eef7'
const FROG_COLOUR = '#5fb14e'
const BEAVER_COLOUR = '#a9693d'

// Nearly every tile now flows. Still water is the exception rather than the rule, which is
// what makes the crossing a fight rather than a walk. Strength 4 stays the rarest, as the
// printed tile sheet has only one of them.
const CURRENT_WEIGHTS: number[] = [5, 32, 30, 22, 11]

// Two tiles in four push sideways, one pushes forward and one pushes back, so the river
// shoves an animal off its line as often as it costs or gives it ground.
const DIRECTION_WEIGHTS: number[] = [1, 1, 1, 1]

const DEFAULT_WIDTH = 10
const DEFAULT_DEPTH = 7
const DEFAULT_VISIBLE_CURRENTS = 5
const SIDEWAYS_ONLY_FROM = 4
const MAX_ANIMALS_PER_TILE = 4

function bag(wood = 0, stone = 0, clay = 0, reeds = 0): ResourceBag {
  return { wood, stone, clay, reeds }
}

/**
 * The production deck. Fourteen cards, two copies of each, named for whatever they are
 * generous with.
 *
 * Exactly half of them pay nothing at all in one area, and a card is only allowed to do that
 * if it pays PRODUCTION_FEAST somewhere else: a blank is the price of a glut, never just a
 * mean card. The other half pay something everywhere. So a collector left on stone is a real
 * gamble on a feast card and merely a thin round on a steady one, and stacking both
 * collectors on one area is a bet with a visible downside.
 */
export const PRODUCTION_FEAST = 4

export const DEFAULT_PRODUCTION_CARDS: ProductionCardDef[] = [
  // Seven with a blank, each paying 4 somewhere to earn it.
  { id: 'forests-are-full', name: 'Forests Are Full', yields: bag(4, 1, 0, 2), copies: 2 },
  { id: 'the-quarry-rings', name: 'The Quarry Rings', yields: bag(0, 4, 2, 1), copies: 2 },
  { id: 'banks-run-thick', name: 'Banks Run Thick', yields: bag(1, 0, 4, 2), copies: 2 },
  { id: 'reeds-in-flower', name: 'Reeds in Flower', yields: bag(2, 1, 0, 4), copies: 2 },
  { id: 'rockfall', name: 'Rockfall', yields: bag(1, 4, 2, 0), copies: 2 },
  { id: 'the-flood-plain', name: 'The Flood Plain', yields: bag(4, 0, 2, 1), copies: 2 },
  { id: 'timber-and-stone', name: 'Timber and Stone', yields: bag(4, 3, 0, 1), copies: 2 },

  // Seven that pay something everywhere.
  { id: 'spring-flood', name: 'Spring Flood', yields: bag(2, 1, 2, 3), copies: 2 },
  { id: 'after-the-storm', name: 'After the Storm', yields: bag(3, 2, 1, 2), copies: 2 },
  { id: 'low-water', name: 'Low Water', yields: bag(1, 2, 3, 1), copies: 2 },
  { id: 'a-good-season', name: 'A Good Season', yields: bag(2, 2, 2, 2), copies: 2 },
  { id: 'lean-weeks', name: 'Lean Weeks', yields: bag(1, 1, 1, 1), copies: 2 },
  { id: 'the-rich-delta', name: 'The Rich Delta', yields: bag(2, 1, 3, 2), copies: 2 },
  { id: 'cold-snap', name: 'Cold Snap', yields: bag(1, 2, 1, 2), copies: 2 },
]

// The twelve printed Power Cards. Three copies of each except River Shift and Whirlpool,
// which have two, giving 34 cards in total.
export const DEFAULT_POWER_CARDS: PowerCardDef[] = [
  {
    id: 'tow',
    name: 'Tow',
    text: 'Move one of your animals up to 2 spaces forward.',
    timing: 'turn',
    copies: 3,
    magnitude: 2,
  },
  {
    id: 'pull',
    name: 'Pull',
    text: "Move another player's animal up to 2 spaces sideways (left or right).",
    timing: 'turn',
    copies: 3,
    magnitude: 2,
  },
  {
    id: 'redirect',
    name: 'Redirect',
    text: 'Change the direction of the current on one occupied tile for this round.',
    timing: 'before-current',
    copies: 3,
    magnitude: 0,
  },
  {
    id: 'surge',
    name: 'Surge',
    text: 'Increase the current on one tile by 2 for this round.',
    timing: 'before-current',
    copies: 3,
    magnitude: 2,
  },
  {
    id: 'river-shift',
    name: 'River Shift',
    text: 'Swap the hidden current tokens of two river tiles.',
    timing: 'before-current',
    copies: 2,
    magnitude: 0,
  },
  {
    id: 'whirlpool',
    name: 'Whirlpool',
    text: 'Force one animal on a Whirlpool to roll again.',
    timing: 'whirlpool',
    copies: 2,
    magnitude: 0,
  },
  {
    id: 'calm-water',
    name: 'Calm Water',
    text: 'Reduce one current by 2 for this round.',
    timing: 'before-current',
    copies: 3,
    magnitude: 2,
  },
  {
    id: 'push',
    name: 'Push',
    text: "Move one opponent's animal 1 space forward or backward.",
    timing: 'turn',
    copies: 3,
    magnitude: 1,
  },
  {
    id: 'rescue',
    name: 'Rescue',
    text: 'Move one of your animals onto an adjacent island.',
    timing: 'turn',
    copies: 3,
    magnitude: 1,
  },
  {
    id: 'free-resources',
    name: 'Free Resources',
    text: 'Choose two different resources and gain one of each.',
    timing: 'turn',
    copies: 3,
    magnitude: 2,
  },
  {
    id: 'double-move',
    name: 'Double Move',
    text: 'One animal may take an additional 2 movement this turn.',
    timing: 'turn',
    copies: 3,
    magnitude: 2,
  },
  {
    id: 'current-shield',
    name: 'Current Shield',
    text: 'One of your animals ignores its current during the next Current Phase.',
    timing: 'before-current',
    copies: 3,
    magnitude: 0,
  },
]

// The eight printed Mission cards, with the point values shown on the cards.
export const DEFAULT_MISSIONS: MissionDef[] = [
  {
    id: 'the-herd',
    name: 'The Herd',
    text: 'Get 5 of your animals to the finish.',
    check: 'animals-across',
    target: 5,
    points: 5,
    enabled: true,
  },
  {
    id: 'dam-destroyer',
    name: 'Dam Destroyer',
    text: 'Destroy 1 Dam during the game.',
    check: 'dams-destroyed',
    target: 1,
    points: 4,
    enabled: true,
  },
  {
    id: 'builder',
    name: 'Builder',
    text: 'Build 2 structures during the game.',
    check: 'structures-built',
    target: 2,
    points: 4,
    enabled: true,
  },
  {
    id: 'resourceful',
    name: 'Resourceful',
    text: 'Finish the game with at least 1 of each resource.',
    check: 'one-of-each-resource',
    target: 1,
    points: 4,
    enabled: true,
  },
  {
    id: 'risk-taker',
    name: 'Risk Taker',
    text: 'Have one of your animals cross a Whirlpool and still reach the finish.',
    check: 'whirlpool-survivor',
    target: 1,
    points: 5,
    enabled: true,
  },
  {
    id: 'power-man',
    name: 'Power Man',
    text: 'Buy 3 Power Cards during the game.',
    check: 'power-cards-bought',
    target: 3,
    points: 4,
    enabled: true,
  },
  {
    id: 'island-hopper',
    name: 'Island Hopper',
    text: 'Get one animal to land on 3 different islands.',
    check: 'island-hopper',
    target: 3,
    points: 5,
    enabled: true,
  },
  {
    id: 'against-the-current',
    name: 'Against the Current',
    text: 'Get an animal to the finish after it has been moved by the current at least 3 times.',
    check: 'current-rider',
    target: 3,
    points: 5,
    enabled: true,
  },
]

export const DEFAULT_RULES: GameRules = {
  game: {
    rounds: 10,
    finishedAnimalsLeaveBoard: true,
    allowUndo: true,
    startingResources: bag(0, 0, 0, 0),
  },
  board: {
    width: DEFAULT_WIDTH,
    riverDepth: DEFAULT_DEPTH,
    // Exactly four islands, spread across the crossing so no single lane is safest.
    islands: [
      { col: 2, row: 2, size: 'small' },
      { col: 7, row: 3, size: 'small' },
      { col: 4, row: 4, size: 'large' },
      { col: 1, row: 6, size: 'small' },
    ],
    whirlpools: [
      { col: 6, row: 2 },
      { col: 3, row: 5 },
      { col: 8, row: 5 },
    ],
    islandsBlockCurrent: true,
    currentStrengthWeights: CURRENT_WEIGHTS,
    currentDirectionWeights: DIRECTION_WEIGHTS,
    visibleCurrents: DEFAULT_VISIBLE_CURRENTS,
    sidewaysOnlyFromStrength: SIDEWAYS_ONLY_FROM,
    maxAnimalsPerTile: MAX_ANIMALS_PER_TILE,
  },
  movement: {
    allowDiagonal: false,
    allowBackward: true,
    costPerTile: 1,
  },
  current: {
    direction: 'right',
    edgeBehaviour: 'stop-at-edge',
    resolutionOrder: 'downstream-first',
    affectsBankAnimals: false,
  },
  whirlpool: {
    enabled: true,
    weightLeft: 1,
    weightRight: 1,
    weightForward: 1,
    distance: 1,
    trigger: 'end-of-current-move',
    maxEffectsPerAnimalPerPhase: 1,
  },
  factions: {
    ducks: {
      id: 'ducks',
      name: 'Ducks',
      colour: DUCK_COLOUR,
      startingAnimals: 10,
      movementPoints: 3,
      actionsPerTurn: 1,
      goWithTheFlowBonus: 1,
      currentResistance: 0,
      buildDiscount: 0,
      forbiddenEquipment: [],
    },
    swans: {
      id: 'swans',
      name: 'Swans',
      colour: SWAN_COLOUR,
      startingAnimals: 8,
      movementPoints: 3,
      actionsPerTurn: 1,
      goWithTheFlowBonus: 0,
      currentResistance: 1,
      buildDiscount: 0,
      forbiddenEquipment: [],
    },
    frogs: {
      id: 'frogs',
      name: 'Frogs',
      colour: FROG_COLOUR,
      startingAnimals: 10,
      movementPoints: 3,
      actionsPerTurn: 2,
      goWithTheFlowBonus: 0,
      currentResistance: 0,
      buildDiscount: 0,
      forbiddenEquipment: ['anchor', 'rope'],
    },
    beavers: {
      id: 'beavers',
      name: 'Beavers',
      colour: BEAVER_COLOUR,
      startingAnimals: 10,
      movementPoints: 3,
      actionsPerTurn: 1,
      goWithTheFlowBonus: 0,
      currentResistance: 0,
      buildDiscount: 1,
      forbiddenEquipment: [],
    },
  },
  distraction: {
    enabled: true,
    tokensPerPlayer: 1,
    playUsesAction: true,
    radius: 3,
    dieSides: 6,
    avoidOnRoll: 4,
    // Ducks are the easiest birds on the river to distract: nothing but a 6 will do.
    hardToDistract: ['ducks'],
    hardAvoidOnRoll: 6,
    pullDistance: 3,
  },
  production: {
    cards: DEFAULT_PRODUCTION_CARDS,
    collectorsPerPlayer: 2,
    sharingPenalty: 0,
    minimumYield: 0,
    reassignEachRound: true,
  },
  equipment: {
    dam: {
      cost: bag(3, 2, 1, 0),
      purchaseUsesAction: true,
      useUsesAction: false,
      enabled: true,
    },
    raft: {
      cost: bag(2, 0, 0, 1),
      purchaseUsesAction: true,
      useUsesAction: false,
      enabled: true,
    },
    rope: {
      cost: bag(2, 0, 0, 2),
      purchaseUsesAction: true,
      useUsesAction: false,
      enabled: true,
    },
    anchor: {
      cost: bag(0, 1, 1, 0),
      purchaseUsesAction: true,
      useUsesAction: false,
      enabled: true,
    },
  },
  equipmentEffects: {
    raftDistance: 1,
    ropeRange: 3,
    ropeDistance: 2,
    anchorRounds: 1,
  },
  dam: {
    calmAxis: 'vertical',
    calmRadius: 1,
    calmsOwnTile: true,
    destroyCost: bag(0, 2, 0, 0),
    destroyUsesAction: true,
    sweepDistance: 2,
    exclusionsPerRound: 1,
  },
  powerCards: {
    enabled: true,
    cost: 4,
    purchaseUsesAction: true,
    playsPerPlayerPerRound: 1,
    deck: DEFAULT_POWER_CARDS,
  },
  missions: {
    enabled: true,
    cards: DEFAULT_MISSIONS,
  },
  roles: {
    // Parked, not deleted. The powers and the scoring were never settled, so the game is
    // being tested without them; switching this back on restores the whole mechanic.
    enabled: false,
    dealAfterRound: 5,
    bonusPoints: 6,
    minAnimalsAcross: 2,
    saboteur: {
      abilityEnabled: true,
      surgeStrength: 1,
      usesPerRound: 1,
    },
  },
  scoring: {
    pointsPerAnimalAcross: 1,
  },
  ai: {
    difficulty: 'normal',
    stepDelayMs: 220,
  },
}

export function cloneRules(rules: GameRules): GameRules {
  return JSON.parse(JSON.stringify(rules)) as GameRules
}

export function defaultRules(): GameRules {
  return cloneRules(DEFAULT_RULES)
}

/** Resource areas on the market board, in printed left-to-right order. */
export const COLLECTOR_AREAS: ResourceId[] = ['wood', 'reeds', 'clay', 'stone']

export const CURRENT_ORDER_LABELS: Record<CurrentOrderId, string> = {
  'downstream-first': 'Downstream first (rightmost animal moves first)',
  'upstream-first': 'Upstream first (leftmost animal moves first)',
  'turn-order': 'Turn order (faction order, then board position)',
  'row-then-column': 'Reading order (top row first, then left to right)',
}
