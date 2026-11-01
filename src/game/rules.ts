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

/**
 * What becomes of an animal the river pushes past the left or right edge of the board.
 * `swept-away` takes it out of the game for good.
 */
export type EdgeBehaviour = 'swept-away' | 'stop-at-edge' | 'wrap-around'

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
  /** Extra spaces moved in the current's direction after the current moves them. */
  goWithTheFlowBonus: number
  /**
   * Ducks: extra squares for one animal of theirs, and the same animal all game.
   *
   * Deliberately not the mirror of the Swans' resistance, which it used to be: one faction
   * taking a square off the current while another adds one to it makes the stronger of the
   * two strictly better. An extra square that is always there, for one animal, is a
   * different kind of advantage rather than a bigger helping of the same one.
   */
  oneAnimalBonus: number
  /**
   * The price of that extra square: the animal carrying it is never out of the current.
   *
   * An anchor, a Current Shield or anything else that would let it ignore the water does
   * not stick to it. It makes naming the animal a real decision rather than an accident of
   * which one happened to move last, and it bites hardest on the faction the river already
   * pushes around the most.
   */
  bonusAnimalUnprotected: boolean
  /** Swans: spaces subtracted from the current's effective strength. */
  currentResistance: number
  /**
   * Whether resistance also applies to a current running toward the far bank.
   *
   * It used to, and it was costing the Swans the one thing the river ever gives away: a
   * free square of progress. An ability that turns down help is a drawback wearing an
   * ability's coat, so by default they only brace against water that is pushing them
   * sideways or back.
   */
  resistsForwardCurrents: boolean
  /** Beavers: resources removed from the cost of anything they build. */
  buildDiscount: number
  /** Frogs cannot use these equipment items. */
  forbiddenEquipment: EquipmentId[]
  /**
   * Power Cards this faction may play in a round, when that is more than everybody else
   * gets. Zero leaves them on the table's limit.
   *
   * The Frogs buy three times as many cards as anyone else, because a second action with
   * half the equipment list closed to it has little else to buy, and they can only ever
   * play one of them a round. This is the knob that lets the hoard be worth something.
   */
  powerCardPlaysPerRound: number
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
  trade: {
    enabled: boolean
    /** Proposing a trade costs the turn's action. */
    usesAction: boolean
    proposalsPerTurn: number
    /** How much better than even a deal must look before an opponent takes it. */
    aiAcceptMargin: number
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
    /**
     * Strength every square the dam was calming comes up to once it is destroyed. The water
     * it held back has to go somewhere, so the safest line on the board becomes the worst
     * of it. Zero lets the squares simply return to the strength they were rolled at.
     */
    burstCurrent: number
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

// A destroyed dam does not just stop calming the water: the river bursts through the line it
// was holding, and everything it had made safe runs this hard instead.
const DAM_BURST_CURRENT = 3

// A rope reaches most of the way across a ten-wide board, so an animal stranded on bad water
// is never beyond help from the rest of the group - it just takes two squares to get there.
const ROPE_RANGE = 6
const ROPE_DISTANCE = 2

// One duck, the same one all game, walks an extra square.
const DUCK_EXTRA_MOVE = 1

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

/**
 * The Power Card deck: 34 cards, as printed, plus two of the deck's own making.
 *
 * The shuffle itself is sound - it was measured over 4000 random seeds and comes out flat -
 * so the deck drawing samey is a question of what is in it rather than how it is dealt. The
 * copy counts are therefore a quality ladder: the two cards that simply hand you a better
 * board position are the rarest, the situational middle is the bulk of the deck, and Current
 * Shield, which does nothing at all on a calm tile, has been thinned out.
 */
export const DEFAULT_POWER_CARDS: PowerCardDef[] = [
  {
    id: 'break-for-it',
    name: 'Break for It',
    text: 'Move one of your animals up to 2 spaces in any one direction.',
    timing: 'turn',
    copies: 2,
    magnitude: 2,
  },
  {
    id: 'rally',
    name: 'Rally',
    text: "Move one of your animals to another of your animals' square.",
    timing: 'turn',
    copies: 2,
    magnitude: 0,
  },
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
    text: 'Turn the current on one occupied tile right around for this round.',
    timing: 'before-current',
    copies: 2,
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
    text: 'Move one of your animals onto an island next to it.',
    timing: 'turn',
    copies: 2,
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
    copies: 2,
    magnitude: 2,
  },
  {
    id: 'current-shield',
    name: 'Current Shield',
    text: 'One of your animals ignores its current during the next Current Phase.',
    timing: 'before-current',
    copies: 2,
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
    edgeBehaviour: 'swept-away',
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
      goWithTheFlowBonus: 0,
      oneAnimalBonus: DUCK_EXTRA_MOVE,
      bonusAnimalUnprotected: true,
      currentResistance: 0,
      resistsForwardCurrents: false,
      buildDiscount: 0,
      forbiddenEquipment: [],
      powerCardPlaysPerRound: 0,
    },
    swans: {
      id: 'swans',
      name: 'Swans',
      colour: SWAN_COLOUR,
      startingAnimals: 8,
      movementPoints: 3,
      actionsPerTurn: 1,
      goWithTheFlowBonus: 0,
      oneAnimalBonus: 0,
      bonusAnimalUnprotected: false,
      currentResistance: 1,
      resistsForwardCurrents: false,
      buildDiscount: 0,
      forbiddenEquipment: [],
      powerCardPlaysPerRound: 0,
    },
    frogs: {
      id: 'frogs',
      name: 'Frogs',
      colour: FROG_COLOUR,
      startingAnimals: 10,
      movementPoints: 3,
      actionsPerTurn: 2,
      goWithTheFlowBonus: 0,
      oneAnimalBonus: 0,
      bonusAnimalUnprotected: false,
      currentResistance: 0,
      resistsForwardCurrents: false,
      buildDiscount: 0,
      // The rope only, since v0.09. The ban was printed when a rope reached three squares
      // and could not choose its direction; at six it is the best item in the shop, and
      // being the one faction shut out of it was costing the Frogs more than their extra
      // action was worth. Anchors stay out: a frog does not sit still.
      forbiddenEquipment: ['anchor'],
      powerCardPlaysPerRound: 0,
    },
    beavers: {
      id: 'beavers',
      name: 'Beavers',
      colour: BEAVER_COLOUR,
      startingAnimals: 10,
      movementPoints: 3,
      actionsPerTurn: 1,
      goWithTheFlowBonus: 0,
      oneAnimalBonus: 0,
      bonusAnimalUnprotected: false,
      currentResistance: 0,
      resistsForwardCurrents: false,
      buildDiscount: 1,
      forbiddenEquipment: [],
      powerCardPlaysPerRound: 0,
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
  trade: {
    enabled: true,
    // Free, so it actually gets used in a playtest. It is limited to one a turn instead,
    // which stops the table being flooded with offers.
    usesAction: false,
    proposalsPerTurn: 1,
    aiAcceptMargin: 1.1,
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
      cost: bag(1, 1, 1, 1),
      purchaseUsesAction: true,
      useUsesAction: false,
      enabled: true,
    },
    rope: {
      cost: bag(1, 0, 1, 2),
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
    ropeRange: ROPE_RANGE,
    ropeDistance: ROPE_DISTANCE,
    anchorRounds: 1,
  },
  dam: {
    calmAxis: 'horizontal',
    calmRadius: 1,
    calmsOwnTile: true,
    destroyCost: bag(0, 2, 0, 0),
    destroyUsesAction: true,
    sweepDistance: 2,
    burstCurrent: DAM_BURST_CURRENT,
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

/** Power Cards this player may play this round, taking any faction override into account. */
export function cardPlaysAllowed(rules: GameRules, factionId: FactionId): number {
  const own = rules.factions[factionId].powerCardPlaysPerRound
  return own > 0 ? own : rules.powerCards.playsPerPlayerPerRound
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
