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
        path: 'board.hiddenCurrentFraction',
        label: 'Share of moving water that starts hidden',
        type: 'number',
        status: 'provisional',
        min: 0,
        max: 1,
        step: 0.05,
        note: 'Only tiles with a current above zero are ever hidden, because still water has ' +
          'nothing to hide.',
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
    blurb: 'Direction, what happens at the edge, and the order simultaneous effects resolve in.',
    fields: [
      {
        path: 'current.direction',
        label: 'Direction of flow',
        type: 'select',
        status: 'established',
        options: [
          { value: 'right', label: 'Left to right' },
          { value: 'left', label: 'Right to left' },
        ],
      },
      {
        path: 'current.edgeBehaviour',
        label: 'At the downstream edge',
        type: 'select',
        status: 'provisional',
        options: [
          { value: 'stop-at-edge', label: 'Stop at the edge' },
          { value: 'wrap-around', label: 'Wrap round to the other side' },
        ],
        note: 'The brief does not say what happens to an animal pushed off the end. ' +
          'Stopping is the gentler default.',
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
    blurb: 'The exact production distribution is not settled. These cards are provisional.',
    fields: [
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
    blurb: 'One player gets a special role. The Saboteur powers are not settled.',
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
    title: 'Distraction',
    blurb: 'The printed faction card says Ducks "must roll 6 to avoid Distraction". ' +
      'The brief asks for it to be optional until confirmed, so it is off by default.',
    fields: [
      { path: 'distraction.enabled', label: 'Distraction in play', type: 'boolean',
        status: 'provisional' },
      { path: 'distraction.dieSides', label: 'Die sides', type: 'number',
        status: 'provisional', min: 2, max: 20 },
      {
        path: 'distraction.avoidOnRoll',
        label: 'Roll this or higher to avoid it',
        type: 'number',
        status: 'provisional',
        min: 1,
        max: 20,
      },
      {
        path: 'distraction.scope',
        label: 'What gets distracted',
        type: 'select',
        status: 'provisional',
        options: [
          { value: 'one-animal', label: 'One animal, chosen at random' },
          { value: 'all-animals', label: 'Every animal that faction owns' },
        ],
        note: 'One animal is far gentler with ten ducks on the board.',
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
    status: 'established',
    min: 0,
    max: 4,
    note: 'Ducks only by default. Applied once, after the current has moved the animal.',
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
    id: 'saboteur',
    question:
      'What does the Saboteur actually do, and how does it score? At the moment it scores the ' +
      'same 6 points as the other roles for getting 2 animals across, which makes it the ' +
      'easiest of the three.',
    current: 'A single free current increase per round, and the shared qualifying condition.',
  },
  {
    id: 'distraction',
    question:
      'Is Distraction in the game? The Ducks faction card says they must roll 6 to avoid it, ' +
      'but the brief asks for it to stay optional. If it is in, does it hit one duck or all?',
    current: 'Off. One animal at a time when switched on.',
  },
  {
    id: 'equipment-actions',
    question:
      'Does using a raft, rope or anchor cost an action, or only buying it?',
    current: 'Only buying costs an action. Using what you already own is free.',
  },
  {
    id: 'current-danger',
    question:
      'The current only pushes animals sideways, so it never costs progress toward the far ' +
      'bank. Should it also push animals backward, or is sideways displacement enough of a ' +
      'threat on its own?',
    current: 'Sideways only, exactly as the brief describes.',
  },
  {
    id: 'structures',
    question:
      'The Builder mission says "build 2 structures". Does a raft or a rope count as a ' +
      'structure, or only a dam?',
    current: 'Any equipment purchase counts.',
  },
]
