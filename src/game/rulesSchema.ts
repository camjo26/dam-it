////////////////////////////////////////////////////////////////////////////////////////////////
// A description of every editable rule, used to build the rules editor and the rules reference.
//
// `status` is the three-way split the design brief asks for:
//   established - stated in the brief or printed on the components
//   provisional - a reversible default chosen so the prototype is playable
//   open        - genuinely undecided, listed as a question rather than a setting
//
// Adding a tunable means adding it to GameRules and adding one line here. Nothing else.
////////////////////////////////////////////////////////////////////////////////////////////////

export type FieldStatus = 'established' | 'provisional'

export type FieldType = 'number' | 'boolean' | 'select' | 'resourceBag'

export interface RuleField {
  path: string
  label: string
  type: FieldType
  status: FieldStatus
  note?: string
  min?: number
  max?: number
  step?: number
  options?: Array<{ value: string; label: string }>
}

export interface RuleSection {
  id: string
  title: string
  blurb?: string
  fields: RuleField[]
}

const CURRENT_ORDER_OPTIONS = [
  { value: 'downstream-first', label: 'Downstream first' },
  { value: 'upstream-first', label: 'Upstream first' },
  { value: 'turn-order', label: 'Turn order' },
  { value: 'row-then-column', label: 'Reading order' },
]

export const RULE_SECTIONS: RuleSection[] = [
  {
    id: 'game',
    title: 'Game',
    blurb: 'Length, undo and what everybody starts with.',
    fields: [
      {
        path: 'game.rounds',
        label: 'Rounds',
        type: 'number',
        status: 'established',
        min: 1,
        max: 30,
        note: 'The brief and the printed rules both say 10.',
      },
      {
        path: 'game.allowUndo',
        label: 'Allow undo during a turn',
        type: 'boolean',
        status: 'provisional',
        note: 'Undo is cleared whenever a hidden current is revealed or a face-down card is ' +
          'drawn, so it cannot be used to peek.',
      },
      {
        path: 'game.startingResources',
        label: 'Starting resources',
        type: 'resourceBag',
        status: 'provisional',
        note: 'Nothing in the brief says players start with resources, so this is zero.',
      },
      {
        path: 'scoring.pointsPerAnimalAcross',
        label: 'Points per animal across',
        type: 'number',
        status: 'established',
        min: 0,
        max: 10,
      },
    ],
  },
  {
    id: 'board',
    title: 'Board',
    blurb: 'Size, island and whirlpool placement, and how currents are rolled.',
    fields: [
      {
        path: 'board.width',
        label: 'River width (tiles)',
        type: 'number',
        status: 'established',
        min: 4,
        max: 20,
        note: 'The printed starter map is 10 wide.',
      },
      {
        path: 'board.riverDepth',
        label: 'River depth (rows to cross)',
        type: 'number',
        status: 'established',
        min: 2,
        max: 15,
        note: 'The starter map says 7 deep. A top bank and a far bank are added either side.',
      },
      {
        path: 'board.islandsBlockCurrent',
        label: 'Islands shelter from the current',
        type: 'boolean',
        status: 'provisional',
        note: 'The printed rules say islands are "not automatically safe", which is ' +
          'ambiguous. On, an animal on an island ignores the current.',
      },
      {
        path: 'board.visibleCurrents',
        label: 'Currents that start face up',
        type: 'number',
        status: 'provisional',
        min: 0,
        max: 80,
        note: 'Everything else is face down until an animal stands on it. Only tiles with a ' +
          'current above zero are ever hidden: still water has nothing to hide.',
      },
      {
        path: 'board.maxAnimalsPerTile',
        label: 'Animals that fit on one river square',
        type: 'number',
        status: 'established',
        min: 1,
        max: 12,
        note: 'Binds anything a player chooses to do. It does not bind the river: the ' +
          'current carries every animal on a tile, so a stack driven into the bank piles ' +
          'up past the limit. Banks are exempt, since every animal starts stacked on one.',
      },
      {
        path: 'board.sidewaysOnlyFromStrength',
        label: 'Sideways only from strength',
        type: 'number',
        status: 'provisional',
        min: 1,
        max: 5,
        note: 'A current this strong or stronger never runs forward or back, because at that ' +
          'strength it would hand out or take away most of a crossing in one phase.',
      },
    ],
  },
  {
    id: 'movement',
    title: 'Movement',
    fields: [
      {
        path: 'movement.costPerTile',
        label: 'Movement points per square',
        type: 'number',
        status: 'established',
        min: 1,
        max: 5,
      },
      {
        path: 'movement.allowBackward',
        label: 'Animals may move backward',
        type: 'boolean',
        status: 'provisional',
        note: 'Nothing in the brief forbids it, and Push can move an animal backward anyway.',
      },
      {
        path: 'movement.allowDiagonal',
        label: 'Animals may move diagonally',
        type: 'boolean',
        status: 'provisional',
        note: 'Off by default. The brief asks for a clear tile-by-tile system.',
      },
    ],
  },
  {
    id: 'current',
    title: 'The current',
    blurb: 'Every river tile rolls its own strength and its own direction, so the river ' +
      'shoves an animal sideways about half the time and costs or gives it ground the rest.',
    fields: [
      {
        path: 'current.direction',
        label: 'Which way the river runs overall',
        type: 'select',
        status: 'established',
        options: [
          { value: 'right', label: 'Left to right' },
          { value: 'left', label: 'Right to left' },
        ],
        note: 'Used for the resolution order and for still tiles. Each tile rolls its own ' +
          'direction from the weights in the Board tab.',
      },
      {
        path: 'current.edgeBehaviour',
        label: 'At the downstream edge',
        type: 'select',
        status: 'provisional',
        options: [
          { value: 'swept-away', label: 'Swept away and out of the game' },
          { value: 'stop-at-edge', label: 'Stop at the edge' },
          { value: 'wrap-around', label: 'Wrap round to the other side' },
        ],
        note: 'Only the river can do this. Walking, a rope and a card all stop at the edge ' +
          'instead, so nobody can push a rival into the weir by hand.',
      },
      {
        path: 'current.resolutionOrder',
        label: 'Resolution order',
        type: 'select',
        status: 'provisional',
        options: CURRENT_ORDER_OPTIONS,
        note: 'Ties always break by turn order then animal id, so a replay never diverges.',
      },
      {
        path: 'current.affectsBankAnimals',
        label: 'The current reaches animals on the top bank',
        type: 'boolean',
        status: 'provisional',
        note: 'Off: animals waiting on the bank are safe.',
      },
    ],
  },
  {
    id: 'whirlpool',
    title: 'Whirlpools',
    blurb: 'The printed rule is a roll for left, right or forward. The odds are not settled.',
    fields: [
      { path: 'whirlpool.enabled', label: 'Whirlpools in play', type: 'boolean',
        status: 'established' },
      {
        path: 'whirlpool.weightLeft',
        label: 'Weight: left',
        type: 'number',
        status: 'provisional',
        min: 0,
        max: 20,
        note: 'Equal weights give the printed one-in-three each.',
      },
      { path: 'whirlpool.weightRight', label: 'Weight: right', type: 'number',
        status: 'provisional', min: 0, max: 20 },
      { path: 'whirlpool.weightForward', label: 'Weight: forward', type: 'number',
        status: 'provisional', min: 0, max: 20 },
      {
        path: 'whirlpool.distance',
        label: 'Squares moved',
        type: 'number',
        status: 'provisional',
        min: 0,
        max: 5,
        note: 'The printed card does not give a distance. One square is the cautious default.',
      },
      {
        path: 'whirlpool.maxEffectsPerAnimalPerPhase',
        label: 'Maximum whirlpool effects per animal per phase',
        type: 'number',
        status: 'established',
        min: 0,
        max: 5,
        note: 'The printed rules say each animal is affected once per phase.',
      },
      {
        path: 'whirlpool.trigger',
        label: 'When a whirlpool triggers',
        type: 'select',
        status: 'provisional',
        options: [
          { value: 'end-of-current-move', label: 'Where the animal ends up' },
          { value: 'any-tile-entered', label: 'Any whirlpool passed through' },
        ],
      },
    ],
  },
  {
    id: 'equipment',
    title: 'Equipment',
    blurb: 'Costs are taken from the printed Cost Guide. The brief calls the prices provisional.',
    fields: [
      { path: 'equipment.dam.cost', label: 'Dam cost', type: 'resourceBag',
        status: 'established' },
      { path: 'equipment.raft.cost', label: 'Raft cost', type: 'resourceBag',
        status: 'established' },
      { path: 'equipment.rope.cost', label: 'Rope cost', type: 'resourceBag',
        status: 'established' },
      { path: 'equipment.anchor.cost', label: 'Anchor cost', type: 'resourceBag',
        status: 'established' },
      {
        path: 'equipmentEffects.raftDistance',
        label: 'Raft: squares forward',
        type: 'number',
        status: 'established',
        min: 1,
        max: 5,
      },
      {
        path: 'equipmentEffects.ropeRange',
        label: 'Rope: how far apart the two animals may be',
        type: 'number',
        status: 'established',
        min: 1,
        max: 10,
      },
      {
        path: 'equipmentEffects.ropeDistance',
        label: 'Rope: squares pulled',
        type: 'number',
        status: 'established',
        min: 1,
        max: 5,
      },
      {
        path: 'equipmentEffects.anchorRounds',
        label: 'Anchor: rounds protected',
        type: 'number',
        status: 'established',
        min: 1,
        max: 5,
        note: 'The printed card says one round, removed at the end of the Current Phase.',
      },
      {
        path: 'equipment.raft.useUsesAction',
        label: 'Using a raft costs an action',
        type: 'boolean',
        status: 'provisional',
        note: 'Off: buying it already cost an action. Not settled in the brief.',
      },
      {
        path: 'equipment.rope.useUsesAction',
        label: 'Using a rope costs an action',
        type: 'boolean',
        status: 'provisional',
      },
      {
        path: 'equipment.anchor.useUsesAction',
        label: 'Using an anchor costs an action',
        type: 'boolean',
        status: 'provisional',
      },
    ],
  },
  {
    id: 'dam',
    title: 'Dams',
    blurb: 'How far a dam calms, what it costs to destroy, and the sweep when it goes.',
    fields: [
      {
        path: 'dam.calmAxis',
        label: 'Calms along',
        type: 'select',
        status: 'provisional',
        options: [
          { value: 'vertical', label: 'Above and below (up and down the board)' },
          { value: 'horizontal', label: 'Upstream and downstream (left and right)' },
        ],
        note: 'The card says "above and below the dam". On a board where the river runs ' +
          'left to right, that most naturally means the squares above and below it.',
      },
      { path: 'dam.calmRadius', label: 'Squares calmed either side', type: 'number',
        status: 'provisional', min: 0, max: 5 },
      { path: 'dam.calmsOwnTile', label: 'Calms its own square too', type: 'boolean',
        status: 'provisional' },
      {
        path: 'dam.destroyCost',
        label: 'Cost to destroy',
        type: 'resourceBag',
        status: 'provisional',
        note: 'The brief says this was discussed as 2 or 3 Stone and never settled. ' +
          'Default is 2 Stone.',
      },
      {
        path: 'dam.sweepDistance',
        label: 'Squares animals are swept when it is destroyed',
        type: 'number',
        status: 'established',
        min: 0,
        max: 6,
      },
      {
        path: 'dam.burstCurrent',
        label: 'Strength the calmed squares run at once it is destroyed',
        type: 'number',
        status: 'provisional',
        min: 0,
        max: 4,
        note: 'Asked for directly: the water the dam held back bursts through the line it ' +
          'was holding. Zero lets those squares go back to the strength they were rolled at.',
      },
      {
        path: 'dam.exclusionsPerRound',
        label: 'Animals the owner may bar per round',
        type: 'number',
        status: 'established',
        min: 0,
        max: 4,
      },
    ],
  },
  {
    id: 'powerCards',
    title: 'Power Cards',
    fields: [
      { path: 'powerCards.enabled', label: 'Power Cards in play', type: 'boolean',
        status: 'established' },
      {
        path: 'powerCards.cost',
        label: 'Cost in resources, any mix',
        type: 'number',
        status: 'established',
        min: 1,
        max: 12,
      },
      {
        path: 'powerCards.playsPerPlayerPerRound',
        label: 'Cards playable per player per round',
        type: 'number',
        status: 'established',
        min: 1,
        max: 5,
      },
      {
        path: 'powerCards.purchaseUsesAction',
        label: 'Buying one costs the action',
        type: 'boolean',
        status: 'established',
      },
    ],
  },
  {
    id: 'production',
    title: 'Collectors and production',
    blurb: 'Half the deck pays nothing in one area, and a card may only do that if it pays ' +
      '4 somewhere else: a blank is the price of a glut. The other half pay something ' +
      'everywhere. The exact distribution is still provisional.',
    fields: [
      {
        path: 'production.collectorsPerPlayer',
        label: 'Collectors each player places',
        type: 'number',
        status: 'established',
        min: 1,
        max: 4,
        note: 'Two by default. They may go in two areas or stack on one, and each is paid ' +
          'separately, so stacking doubles that area up.',
      },
      {
        path: 'production.sharingPenalty',
        label: 'Penalty when two collectors share an area',
        type: 'number',
        status: 'provisional',
        min: 0,
        max: 5,
        note: 'Zero by default: sharing costs nothing. Raise it to make areas contested.',
      },
      { path: 'production.minimumYield', label: 'Minimum yield per collector', type: 'number',
        status: 'provisional', min: 0, max: 5 },
      {
        path: 'production.reassignEachRound',
        label: 'Collectors are re-placed every round',
        type: 'boolean',
        status: 'provisional',
      },
    ],
  },
  {
    id: 'roles',
    title: 'Secret roles',
    blurb: 'Parked for now, which is why this is off. The Saboteur powers and the scoring ' +
      'were never settled, so the game is being tested without them. Everything still works ' +
      'if you switch it back on.',
    fields: [
      { path: 'roles.enabled', label: 'Secret roles in play', type: 'boolean',
        status: 'established' },
      {
        path: 'roles.dealAfterRound',
        label: 'Dealt at the end of round',
        type: 'number',
        status: 'established',
        min: 1,
        max: 20,
      },
      { path: 'roles.bonusPoints', label: 'Role bonus points', type: 'number',
        status: 'established', min: 0, max: 20 },
      {
        path: 'roles.minAnimalsAcross',
        label: 'Animals across needed to qualify',
        type: 'number',
        status: 'established',
        min: 0,
        max: 10,
      },
      {
        path: 'roles.saboteur.abilityEnabled',
        label: 'Saboteur has an active ability',
        type: 'boolean',
        status: 'provisional',
        note: 'Provisional ability: once a round, before the current resolves, strengthen one ' +
          'tile. The log does not name who did it.',
      },
      { path: 'roles.saboteur.surgeStrength', label: 'Saboteur: strength added', type: 'number',
        status: 'provisional', min: 0, max: 4 },
      { path: 'roles.saboteur.usesPerRound', label: 'Saboteur: uses per round', type: 'number',
        status: 'provisional', min: 0, max: 5 },
    ],
  },
  {
    id: 'distraction',
    title: 'Distraction tokens',
    blurb: 'Everyone holds a Distraction token. Played on a river tile for your action, it ' +
      'makes every animal near it roll, and whoever played it drags the ones that look away ' +
      'toward the token. Ducks are the easiest to distract.',
    fields: [
      { path: 'distraction.enabled', label: 'Distraction tokens in play', type: 'boolean',
        status: 'provisional' },
      {
        path: 'distraction.tokensPerPlayer',
        label: 'Tokens each player starts with',
        type: 'number',
        status: 'established',
        min: 0,
        max: 5,
        note: 'The brief gives everyone one for the whole game, so it is a card you only ' +
          'get to play once.',
      },
      {
        path: 'distraction.radius',
        label: 'Squares it reaches',
        type: 'number',
        status: 'established',
        min: 1,
        max: 6,
        note: 'Measured as a square around the token, so a corner counts the same as a side.',
      },
      { path: 'distraction.dieSides', label: 'Die sides', type: 'number',
        status: 'established', min: 2, max: 20 },
      {
        path: 'distraction.avoidOnRoll',
        label: 'Roll this or higher to shrug it off',
        type: 'number',
        status: 'established',
        min: 1,
        max: 20,
        note: 'Four on a six means an even chance for everyone but the Ducks.',
      },
      {
        path: 'distraction.hardAvoidOnRoll',
        label: 'Ducks need this or higher',
        type: 'number',
        status: 'established',
        min: 1,
        max: 20,
        note: 'The printed Ducks card says they must roll a 6, which is why they are the ' +
          'faction worth aiming a token at.',
      },
      {
        path: 'distraction.pullDistance',
        label: 'Squares a distracted animal can be dragged',
        type: 'number',
        status: 'established',
        min: 0,
        max: 6,
        note: 'The player who placed the token chooses anything from nothing up to this, ' +
          'separately for each animal caught.',
      },
      {
        path: 'distraction.playUsesAction',
        label: 'Playing it uses your action',
        type: 'boolean',
        status: 'established',
      },
    ],
  },
  {
    id: 'trade',
    title: 'Trading',
    blurb: 'Offer another player resources and Power Cards for resources and Power Cards. ' +
      'They take it, leave it, or name terms of their own for you to take or leave. Cards ' +
      'are asked for by number rather than by name, because a hand is secret.',
    fields: [
      { path: 'trade.enabled', label: 'Trading in play', type: 'boolean',
        status: 'provisional' },
      {
        path: 'trade.proposalsPerTurn',
        label: 'Offers you may make a turn',
        type: 'number',
        status: 'provisional',
        min: 0,
        max: 5,
      },
      {
        path: 'trade.usesAction',
        label: 'Proposing a trade costs your action',
        type: 'boolean',
        status: 'provisional',
        note: 'Off, so trading actually gets used. One offer a turn is the brake instead.',
      },
      {
        path: 'trade.aiAcceptMargin',
        label: 'How much better than even an opponent wants a deal',
        type: 'number',
        status: 'provisional',
        min: 1,
        max: 3,
        step: 0.05,
        note: '1 takes any deal that is not a loss. Higher drives a harder bargain, and ' +
          'makes counter-offers more likely than plain acceptance.',
      },
    ],
  },
  {
    id: 'ai',
    title: 'Computer opponents',
    fields: [
      {
        path: 'ai.difficulty',
        label: 'Default difficulty',
        type: 'select',
        status: 'provisional',
        options: [
          { value: 'easy', label: 'Easy - Reedy' },
          { value: 'normal', label: 'Normal - Old Mottle' },
          { value: 'hard', label: 'Hard - Grey Quill' },
        ],
      },
      {
        path: 'ai.stepDelayMs',
        label: 'Delay between AI steps (ms)',
        type: 'number',
        status: 'provisional',
        min: 0,
        max: 2000,
        step: 10,
        note: 'Set to 0 to make computer turns instant.',
      },
    ],
  },
]

/** Per-faction fields, rendered once for each of the four factions. */
export const FACTION_FIELDS: RuleField[] = [
  { path: 'startingAnimals', label: 'Starting animals', type: 'number', status: 'established',
    min: 1, max: 30 },
  { path: 'movementPoints', label: 'Movement points', type: 'number', status: 'established',
    min: 0, max: 12 },
  { path: 'actionsPerTurn', label: 'Actions per turn', type: 'number', status: 'established',
    min: 0, max: 6 },
  {
    path: 'goWithTheFlowBonus',
    label: 'Go With the Flow: extra squares',
    type: 'number',
    status: 'provisional',
    min: 0,
    max: 4,
    note: 'Off everywhere by default. It was the Ducks\u2019 ability and is the mirror of ' +
      'Swan resistance, which made one of the two strictly better than the other. Applied ' +
      'once, after the current has moved the animal.',
  },
  {
    path: 'oneAnimalBonus',
    label: 'Extra squares for one animal',
    type: 'number',
    status: 'provisional',
    min: 0,
    max: 4,
    note: 'Ducks only by default. Spent last of all, on one animal, and the animal that ' +
      'spends it first keeps it for the rest of the game.',
  },
  {
    path: 'currentResistance',
    label: 'Current resistance',
    type: 'number',
    status: 'established',
    min: 0,
    max: 4,
    note: 'Swans only by default. Never takes the effective strength below zero.',
  },
  {
    path: 'buildDiscount',
    label: 'Build discount',
    type: 'number',
    status: 'established',
    min: 0,
    max: 4,
    note: 'Beavers only by default. Taken off the largest requirement first. Applies to ' +
      'equipment, not to Power Cards.',
  },
]

/** Questions that genuinely need a decision rather than a default. */
export interface OpenQuestion {
  id: string
  question: string
  current: string
}

export const OPEN_QUESTIONS: OpenQuestion[] = [
  {
    id: 'resource-count',
    question:
      'Three resources or four? The brief text says Wood, Clay and Stone, but the Cost Guide, ' +
      'the Market board and the illustrated rules all show four, including Reeds, and the ' +
      'Raft and Rope costs need Reeds.',
    current: 'Built with four, matching the printed components. The Market has four areas, ' +
      'which also fits four.',
  },
  {
    id: 'island-count',
    question:
      'Four islands or five? The brief asks for exactly four. The printed starter map draws ' +
      'five and its key counts six island tiles.',
    current: 'Four, as the brief asks. Their positions are editable on the Board tab.',
  },
  {
    id: 'dam-destroy-cost',
    question: 'Does destroying a dam cost 2 Stone or 3?',
    current: '2 Stone.',
  },
  {
    id: 'roles',
    question:
      'Are secret roles coming back, and if so what does the Saboteur do and how does it ' +
      'score? It was the easiest of the three: the same 6 points for the same 2 animals ' +
      'across, without having to lead at anything.',
    current: 'Parked. The whole mechanic is off, and can be switched back on in the Roles ' +
      'tab if you want to test it.',
  },
  {
    id: 'distraction-own-animals',
    question:
      'A Distraction token makes every animal within 3 squares roll, including the animals ' +
      'of whoever played it. Should it spare your own, or is catching yourself part of the ' +
      'cost of playing it?',
    current: 'Everything in range rolls, your own included. Where you drop it is the skill.',
  },
  {
    id: 'distraction-forward-pull',
    question:
      'A distracted animal is dragged toward the token, so a token dropped ahead of a rival ' +
      'pulls them forward and helps them. Dropped on row 1 in round 1 it catches almost ' +
      'every animal on the bank and pushes them all into the river. Is that intended?',
    current: 'Allowed. The drag distance is chosen per animal, from nothing up to 3, so a ' +
      'bad catch can simply be left alone.',
  },
  {
    id: 'equipment-actions',
    question:
      'Does using a raft, rope or anchor cost an action, or only buying it?',
    current: 'Only buying costs an action. Using what you already own is free.',
  },
  {
    id: 'current-mix',
    question:
      'The river now pushes forward and back as well as sideways, in a 2:1:1 mix, and only ' +
      'about 5 tiles in 70 are still water. Is that the right amount of shove, and is a ' +
      'quarter of the river pushing animals backward too punishing?',
    current: 'Half sideways, a quarter forward, a quarter back. A current of 4 is always ' +
      'sideways, because forward at that strength is most of a free crossing. All of it is ' +
      'editable on the Board tab.',
  },
  {
    id: 'edge-losses',
    question:
      'The river now carries an animal over the side of the board and out of the game for ' +
      'good. Is losing animals outright the right penalty, or should a strong current near ' +
      'an edge cost something less final?',
    current: 'Swept away and gone, at any strength, including from the edge square itself. ' +
      'Resisting the current only makes the push smaller, so it does not save an animal ' +
      'there, but a dam, an island, an anchor or a shield does. Only the river does it: ' +
      'walking, a rope and a card all stop at the edge instead.',
  },
  {
    id: 'trade-scope',
    question:
      'Trading swaps resources and Power Cards. Should equipment, or a Distraction token, ' +
      'be tradeable too? And should an offer cost your action rather than being free once ' +
      'a turn?',
    current: 'Resources and Power Cards, free, one offer a turn.',
  },
  {
    id: 'stack-limit',
    question:
      'Four animals fit on a river square, and the limit binds players but not the river: ' +
      'the current carries a whole stack, so animals shoved into the bank pile up past four. ' +
      'Should the river obey the limit too, and if so who decides which animals get left?',
    current: 'Four, and the river ignores it. Banks are exempt, since every animal starts ' +
      'stacked on the top bank.',
  },
  {
    id: 'visible-currents',
    question:
      'Only 5 currents start face up. Is that too harsh with a 7 row river, given that the ' +
      'only way to learn a tile is to put an animal on it?',
    current: '5 face up, the rest face down until entered. Editable on the Board tab.',
  },
  {
    id: 'structures',
    question:
      'The Builder mission says "build 2 structures". Does a raft or a rope count as a ' +
      'structure, or only a dam?',
    current: 'Any equipment purchase counts.',
  },
]
