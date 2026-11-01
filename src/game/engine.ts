////////////////////////////////////////////////////////////////////////////////////////////////
// The rules engine.
//
// Every change to a game goes through applyAction. It takes a state and an action and returns
// either a new state or an error message, and it never touches the DOM. The interface and the
// AI both drive the game through this one door, so the AI cannot make a move a player could
// not, and a sequence of actions replayed against the same seed gives the same game.
////////////////////////////////////////////////////////////////////////////////////////////////

import { bottomBankRow, isRiverRow, tileAt } from './board'
import { applyCardEffect, cardById, cardPlayableNow, type CardTarget } from './cards'
import { clearRoundEffects, damCalms, resolveCurrentPhase } from './current'
import { addLog } from './log'
import {
  animalsOnTile,
  coord,
  isFinished,
  isInPlay,
  moveAnimalStep,
  placeAnimal,
  slideAnimal,
  tileIsFull,
} from './movement'
import { refreshMissionProgress } from './missions'
import {
  allCollectorsPlaced,
  collectorsLeft,
  describeCollectors,
  resetCollectors,
  resolveProduction,
} from './production'
import { dealRoles, saboteurUsesLeft } from './roles'
import { rollDie } from './rng'
import type { GameRules } from './rules'
import { scoreGame } from './scoring'
import { bagTotal, describeTerms, judgeTrade, settleTrade } from './trade'
import type {
  Animal,
  ActionResult,
  DistractionRoll,
  EquipmentId,
  FactionId,
  GameState,
  PendingDistraction,
  Player,
  ResourceBag,
  ResourceId,
  TradeOutcome,
  TradeProposal,
  TradeTerms,
} from './types'
import { CURRENT_VECTORS, RESOURCE_IDS, RESOURCE_LABELS } from './types'

const MAX_UNDO_DEPTH = 40

/** The two ways a rope can set off toward the animal at the other end of it. */
export type RopeAxis = 'across' | 'along'

export type GameAction =
  | { type: 'place-collector'; playerId: string; area: ResourceId }
  | { type: 'resolve-production' }
  | { type: 'move-animal'; animalId: string; col: number; row: number }
  | { type: 'buy-equipment'; item: EquipmentId }
  | { type: 'place-dam'; col: number; row: number }
  | { type: 'use-raft'; animalId: string }
  | {
      type: 'use-rope'
      animalId: string
      towardAnimalId: string
      distance?: number
      /** Which way to set off when the other animal is neither straight across nor ahead. */
      axis?: RopeAxis
    }
  | { type: 'use-anchor'; animalId: string }
  | { type: 'destroy-dam'; damId: string }
  | { type: 'set-dam-exclusion'; damId: string; animalId: string }
  | { type: 'buy-power-card'; payment?: Partial<ResourceBag> }
  | { type: 'play-power-card'; playerId: string; instanceId: string; target: CardTarget }
  | { type: 'saboteur-surge'; playerId: string; tileId: string }
  | { type: 'play-distraction'; col: number; row: number }
  | { type: 'resolve-distraction'; moves: Array<{ animalId: string; distance: number }> }
  | { type: 'remove-collector'; playerId: string; index: number }
  | {
      type: 'propose-trade'
      toPlayerId: string
      offer: TradeTerms
      request: { resources: ResourceBag; cardCount: number }
    }
  | { type: 'answer-trade' }
  | { type: 'settle-trade'; accept: boolean }
  | { type: 'withdraw-trade' }
  | { type: 'dismiss-trade-outcome' }
  | { type: 'end-turn' }
  | { type: 'resolve-current' }
  | { type: 'undo' }

function fail(error: string): ActionResult {
  return { ok: false, error }
}

function clone(state: GameState): GameState {
  return structuredClone(state)
}

export function activePlayer(state: GameState): Player | undefined {
  const id = state.turnOrder[state.activePlayerIndex]
  return state.players.find((p) => p.id === id)
}

////////////////////////////////////////////////////////////////////////////////////////////////
// Costs
////////////////////////////////////////////////////////////////////////////////////////////////

/** Applies a faction's build discount, taking it off the largest requirement first. */
export function equipmentCost(
  rules: GameRules,
  factionId: FactionId,
  item: EquipmentId,
): ResourceBag {
  const base = { ...rules.equipment[item].cost }
  let discount = rules.factions[factionId].buildDiscount
  while (discount > 0) {
    const largest = RESOURCE_IDS.reduce<ResourceId | null>((best, id) => {
      if (base[id] <= 0) return best
      if (best === null || base[id] > base[best]) return id
      return best
    }, null)
    if (!largest) break
    base[largest] -= 1
    discount -= 1
  }
  return base
}

export function canAfford(player: Player, cost: ResourceBag): boolean {
  return RESOURCE_IDS.every((id) => player.resources[id] >= cost[id])
}

function payCost(player: Player, cost: ResourceBag): void {
  for (const id of RESOURCE_IDS) {
    player.resources[id] -= cost[id]
    player.stats.resourcesSpent[id] += cost[id]
  }
}

export function totalResources(player: Player): number {
  return RESOURCE_IDS.reduce((sum, id) => sum + player.resources[id], 0)
}

/**
 * Works out which resources to spend for a "any combination" cost such as a Power Card.
 * Takes from the largest stock first so a player is not stripped of a scarce resource.
 */
export function autoPayment(player: Player, amount: number): ResourceBag | null {
  const payment: ResourceBag = { wood: 0, stone: 0, clay: 0, reeds: 0 }
  const pool: ResourceBag = { ...player.resources }
  let remaining = amount
  while (remaining > 0) {
    const largest = RESOURCE_IDS.reduce<ResourceId | null>((best, id) => {
      if (pool[id] <= 0) return best
      if (best === null || pool[id] > pool[best]) return id
      return best
    }, null)
    if (!largest) return null
    pool[largest] -= 1
    payment[largest] += 1
    remaining -= 1
  }
  return payment
}

////////////////////////////////////////////////////////////////////////////////////////////////
// Undo
////////////////////////////////////////////////////////////////////////////////////////////////

function pushUndo(state: GameState): void {
  if (!state.rules.game.allowUndo) return
  const snapshot = JSON.stringify({ ...state, undoStack: [] })
  state.undoStack.push(snapshot)
  if (state.undoStack.length > MAX_UNDO_DEPTH) state.undoStack.shift()
}

/**
 * Undo must not let a player peek at hidden information and then take it back, so anything
 * that reveals a hidden current or draws a face-down card clears the history.
 */
function clearUndo(state: GameState): void {
  state.undoStack = []
}

////////////////////////////////////////////////////////////////////////////////////////////////
// Phase flow
////////////////////////////////////////////////////////////////////////////////////////////////

function startTurn(state: GameState): void {
  const player = activePlayer(state)
  if (!player) return
  const faction = state.rules.factions[player.factionId]
  player.movementRemaining = faction.movementPoints
  player.actionsRemaining = faction.actionsPerTurn

  // The faction's extra square, for one animal and the same one every round. A nomination
  // lapses if that animal has crossed or been swept away, because otherwise the faction
  // would go on paying for a duck that is no longer on the board.
  const named = state.animals.find((a) => a.id === player.bonusAnimalId)
  if (player.bonusAnimalId !== null && (!named || !isInPlay(named))) {
    player.bonusAnimalId = null
  }
  player.bonusAnimalMoveRemaining = faction.oneAnimalBonus
  clearUndo(state)

  const extras: string[] = []
  if (faction.oneAnimalBonus > 0) {
    const where = named && isInPlay(named) ? ` at ${coord(named.col, named.row)}` : ''
    extras.push(
      player.bonusAnimalId === null
        ? `Plus ${faction.oneAnimalBonus} extra for one animal, whichever one uses it first.`
        : `Plus ${faction.oneAnimalBonus} extra for their one animal${where}.`,
    )
  }

  addLog(state, {
    kind: 'turn-start',
    playerId: player.id,
    message: `${possessive(player.name)} turn.`,
    detail: `${player.movementRemaining} movement, ${player.actionsRemaining} ` +
      `${player.actionsRemaining === 1 ? 'action' : 'actions'}. ${extras.join(' ')}`.trim(),
  })
}

function endTurnInternal(state: GameState): void {
  const player = activePlayer(state)
  if (player) {
    player.movementRemaining = 0
    player.actionsRemaining = 0
    player.bonusAnimalMoveRemaining = 0
    for (const animal of state.animals) {
      if (animal.playerId !== player.id) continue
      animal.bonusMovement = 0
    }
    addLog(state, { kind: 'turn-end', playerId: player.id, message: `${player.name} ended their turn.` })
  }

  refreshMissionProgress(state)
  clearUndo(state)

  if (state.activePlayerIndex + 1 < state.turnOrder.length) {
    state.activePlayerIndex += 1
    startTurn(state)
    return
  }

  state.phase = 'current'
  addLog(state, {
    kind: 'phase',
    message: 'All players have acted. The Current Phase can now be resolved.',
    detail: 'Cards that are played before the Current Phase can be played now.',
  })
}

function endRound(state: GameState): void {
  refreshMissionProgress(state)

  for (const player of state.players) {
    const across = state.animals.filter(
      (a) => a.playerId === player.id && a.status === 'finished',
    ).length
    player.stats.acrossByRound[state.round - 1] = across
  }

  if (state.rules.roles.enabled && !state.rolesDealt &&
      state.round >= state.rules.roles.dealAfterRound) {
    dealRoles(state)
  }

  if (state.round >= state.rules.game.rounds) {
    state.phase = 'finished'
    state.result = scoreGame(state)
    const winners = state.result.breakdowns.filter((b) =>
      state.result?.winningPlayerIds.includes(b.playerId),
    )
    addLog(state, {
      kind: 'game-over',
      message: `Game over. ${winners.map((w) => w.playerName).join(', ')} ` +
        `${winners.length > 1 ? 'share the win' : 'wins'} on ${winners[0]?.total ?? 0} points.`,
      detail: state.result.tieExplanation ?? undefined,
    })
    return
  }

  state.round += 1
  state.phase = 'resource'
  state.activePlayerIndex = 0
  state.saboteurUsesThisRound = {}
  state.pendingDistraction = null
  state.pendingTrade = null
  state.tradesProposedThisTurn = {}
  for (const player of state.players) player.powerCardsPlayedThisRound = 0
  resetCollectors(state)

  addLog(state, { kind: 'round', message: `Round ${state.round} begins.` })
}

////////////////////////////////////////////////////////////////////////////////////////////////
// Action handlers
////////////////////////////////////////////////////////////////////////////////////////////////

function requireTurn(state: GameState): Player | string {
  if (state.phase !== 'player-turns') return 'It is not the player turn phase.'
  const player = activePlayer(state)
  if (!player) return 'No active player.'
  return player
}

function spendAction(player: Player, uses: boolean): string | null {
  if (!uses) return null
  if (player.actionsRemaining <= 0) return 'No actions left this turn.'
  player.actionsRemaining -= 1
  return null
}

function handleBuyEquipment(state: GameState, item: EquipmentId): ActionResult {
  const player = requireTurn(state)
  if (typeof player === 'string') return fail(player)

  const equipment = state.rules.equipment[item]
  if (!equipment.enabled) return fail(`${item} is switched off in the current rules.`)

  const faction = state.rules.factions[player.factionId]
  if (faction.forbiddenEquipment.includes(item)) {
    return fail(`${faction.name} cannot use ${item}s.`)
  }

  const cost = equipmentCost(state.rules, player.factionId, item)
  if (!canAfford(player, cost)) return fail(`Not enough resources for a ${item}.`)

  const actionError = spendAction(player, equipment.purchaseUsesAction)
  if (actionError) return fail(actionError)

  payCost(player, cost)
  player.equipment[item] += 1
  player.stats.structuresBuilt += 1

  const paid = RESOURCE_IDS.filter((id) => cost[id] > 0)
    .map((id) => `${cost[id]} ${RESOURCE_LABELS[id]}`)
    .join(', ')
  addLog(state, {
    kind: 'build',
    playerId: player.id,
    message: `${player.name} built a ${item}.`,
    detail: `Paid ${paid || 'nothing'}.` +
      (faction.buildDiscount > 0 ? ` ${faction.name} discount applied.` : ''),
  })
  return { ok: true, state }
}

function handlePlaceDam(state: GameState, col: number, row: number): ActionResult {
  const player = requireTurn(state)
  if (typeof player === 'string') return fail(player)
  if (player.equipment.dam <= 0) return fail('You have no dam to place. Build one first.')

  const tile = tileAt(state.board, col, row)
  if (!tile) return fail('That square is off the board.')
  if (tile.kind === 'bank-top' || tile.kind === 'bank-bottom') {
    return fail('A dam must be built in the river.')
  }
  if (state.dams.some((d) => d.col === col && d.row === row)) {
    return fail('There is already a dam there.')
  }

  const actionError = spendAction(player, state.rules.equipment.dam.useUsesAction)
  if (actionError) return fail(actionError)

  player.equipment.dam -= 1
  state.dams.push({
    id: `dam-${state.nextLogId}`,
    ownerPlayerId: player.id,
    col,
    row,
    excludedAnimalId: null,
    excludedForRound: null,
    builtOnRound: state.round,
  })

  addLog(state, {
    kind: 'dam-placed',
    playerId: player.id,
    message: `${player.name} placed a dam at ${coord(col, row)}.`,
    detail: `It holds the water at 0 on its own square and ` +
      `${state.rules.dam.calmAxis === 'vertical' ? 'above and below' : 'either side of'} it, ` +
      `within ${state.rules.dam.calmRadius} square, until it is destroyed.`,
  })
  return { ok: true, state }
}

function handleDestroyDam(state: GameState, damId: string): ActionResult {
  const player = requireTurn(state)
  if (typeof player === 'string') return fail(player)

  const dam = state.dams.find((d) => d.id === damId)
  if (!dam) return fail('That dam is not on the board.')

  const cost = state.rules.dam.destroyCost
  if (!canAfford(player, cost)) return fail('Not enough resources to destroy that dam.')

  const actionError = spendAction(player, state.rules.dam.destroyUsesAction)
  if (actionError) return fail(actionError)

  payCost(player, cost)
  state.dams = state.dams.filter((d) => d.id !== damId)
  player.stats.damsDestroyed += 1

  addLog(state, {
    kind: 'dam-destroyed',
    playerId: player.id,
    message: `${player.name} destroyed the dam at ${coord(dam.col, dam.row)}.`,
  })

  // The water the dam was holding back bursts along the line it was holding it on. Every
  // square the dam calmed, its own included, comes up to the burst strength, so the safest
  // line on the board turns into the worst of it. A square that was still water before the
  // dam went up keeps the direction the river as a whole runs, since it never rolled one.
  const burst = state.rules.dam.burstCurrent
  const raised = burst <= 0 ? [] : state.board.tiles.filter(
    (t) => t.kind === 'river' && t.current < burst && damCalms(state.rules, dam, t.col, t.row),
  )
  for (const tile of raised) {
    tile.current = burst
    // Water this loud is not something anybody should have to walk onto to find out about.
    tile.revealed = true
  }
  if (raised.length > 0) {
    addLog(state, {
      kind: 'dam-burst',
      playerId: player.id,
      message: `The river burst through ${coord(dam.col, dam.row)} and now runs at ${burst}.`,
      detail: `${raised.map((t) => coord(t.col, t.row)).join(', ')} ` +
        `${raised.length === 1 ? 'was calm and is' : 'were calm and are'} now current ` +
        `${burst}, until something changes it.`,
    })
  }

  // Everything immediately downstream of the dam is swept along by the released water.
  // Downstream is whichever way that tile's own current runs, now that each tile has one.
  const sweep = state.rules.dam.sweepDistance
  const damTile = tileAt(state.board, dam.col, dam.row)
  const { dc, dr } = CURRENT_VECTORS[damTile?.direction ?? state.rules.current.direction]
  const swept = state.animals.filter(
    (a) => isInPlay(a) && a.col === dam.col + dc && a.row === dam.row + dr,
  )
  for (const animal of swept) {
    const before = coord(animal.col, animal.row)
    // Released water, not a choice, so it carries everything regardless of the square limit.
    const result = slideAnimal(state, animal, dc, dr, sweep,
      { ignoreCapacity: true, canSweepOff: true })
    addLog(state, {
      kind: 'dam-sweep',
      playerId: animal.playerId,
      message: `An animal was swept from ${before} to ${coord(animal.col, animal.row)}.`,
      detail: `The dam at ${coord(dam.col, dam.row)} was destroyed and released the water. ` +
        `Swept ${result.moved} of ${sweep} squares.`,
    })
  }

  return { ok: true, state }
}

function handleUseRaft(state: GameState, animalId: string): ActionResult {
  const player = requireTurn(state)
  if (typeof player === 'string') return fail(player)
  if (player.equipment.raft <= 0) return fail('You have no raft.')

  const animal = state.animals.find((a) => a.id === animalId)
  if (!animal || animal.playerId !== player.id) return fail('Choose one of your animals.')
  if (!isInPlay(animal)) return fail('That animal is no longer in play.')

  const actionError = spendAction(player, state.rules.equipment.raft.useUsesAction)
  if (actionError) return fail(actionError)

  const before = coord(animal.col, animal.row)
  const result = slideAnimal(state, animal, 0, 1, state.rules.equipmentEffects.raftDistance)
  if (result.moved === 0) {
    const ahead = tileAt(state.board, animal.col, animal.row + 1)
    return fail(
      ahead && tileIsFull(state, ahead.col, ahead.row)
        ? `The square ahead already holds ${state.rules.board.maxAnimalsPerTile} animals.`
        : 'That animal has nowhere to go forward.',
    )
  }
  player.equipment.raft -= 1

  addLog(state, {
    kind: 'raft',
    playerId: player.id,
    message: `${player.name} used a raft to move an animal from ${before} to ` +
      `${coord(animal.col, animal.row)}.`,
    detail: 'No movement point was spent.',
  })
  return { ok: true, state }
}

function handleUseRope(
  state: GameState,
  animalId: string,
  towardAnimalId: string,
  distance?: number,
  axis?: RopeAxis,
): ActionResult {
  const player = requireTurn(state)
  if (typeof player === 'string') return fail(player)
  if (player.equipment.rope <= 0) return fail('You have no rope.')

  const faction = state.rules.factions[player.factionId]
  if (faction.forbiddenEquipment.includes('rope')) {
    return fail(`${faction.name} cannot use ropes.`)
  }

  const animal = state.animals.find((a) => a.id === animalId)
  const anchorAnimal = state.animals.find((a) => a.id === towardAnimalId)
  if (!animal || animal.playerId !== player.id) return fail('Choose one of your animals.')
  if (!anchorAnimal || anchorAnimal.playerId !== player.id) {
    return fail('Choose a second animal of yours to pull toward.')
  }
  if (animal.id === anchorAnimal.id) return fail('Choose two different animals.')
  if (!isInPlay(animal) || !isInPlay(anchorAnimal)) {
    return fail('Both animals must still be in play.')
  }

  const gap = orthogonalDistance(animal, anchorAnimal)
  const range = state.rules.equipmentEffects.ropeRange
  if (gap > range) return fail(`Those animals are more than ${range} squares apart.`)

  const actionError = spendAction(player, state.rules.equipment.rope.useUsesAction)
  if (actionError) return fail(actionError)

  const maxDistance = state.rules.equipmentEffects.ropeDistance
  const steps = Math.min(distance ?? maxDistance, maxDistance)
  const before = coord(animal.col, animal.row)
  let moved = 0

  // Step toward the other animal. The two squares need not be spent on the same axis, and
  // with the animal six squares away they rarely land on it, so the player says which way
  // to set off: across the river or along it. Without a preference the larger gap closes
  // first, which is the straightest line to walk.
  for (let i = 0; i < steps; i += 1) {
    const dCol = anchorAnimal.col - animal.col
    const dRow = anchorAnimal.row - animal.row
    if (dCol === 0 && dRow === 0) break
    const across = axis ? axis === 'across' : Math.abs(dCol) >= Math.abs(dRow)
    let dc = 0
    let dr = 0
    if (across && dCol !== 0) dc = Math.sign(dCol)
    else if (!across && dRow !== 0) dr = Math.sign(dRow)
    else if (dCol !== 0) dc = Math.sign(dCol)
    else dr = Math.sign(dRow)
    const result = slideAnimal(state, animal, dc, dr, 1)
    if (result.moved === 0) break
    moved += 1
    if (isFinished(animal)) break
  }

  if (moved === 0) {
    return fail('The rope could not move that animal any closer: the way is blocked or the ' +
      'next square is full.')
  }
  player.equipment.rope -= 1

  addLog(state, {
    kind: 'rope',
    playerId: player.id,
    message: `${player.name} roped an animal from ${before} to ${coord(animal.col, animal.row)}.`,
    detail: `Pulled ${moved} toward their other animal. No movement point was spent.`,
  })
  return { ok: true, state }
}

function handleUseAnchor(state: GameState, animalId: string): ActionResult {
  const player = requireTurn(state)
  if (typeof player === 'string') return fail(player)
  if (player.equipment.anchor <= 0) return fail('You have no anchor.')

  const faction = state.rules.factions[player.factionId]
  if (faction.forbiddenEquipment.includes('anchor')) {
    return fail(`${faction.name} cannot use anchors.`)
  }

  const animal = state.animals.find((a) => a.id === animalId)
  if (!animal || animal.playerId !== player.id) return fail('Choose one of your animals.')
  if (!isInPlay(animal)) return fail('That animal is no longer in play.')

  const actionError = spendAction(player, state.rules.equipment.anchor.useUsesAction)
  if (actionError) return fail(actionError)

  player.equipment.anchor -= 1
  const rounds = state.rules.equipmentEffects.anchorRounds
  animal.anchoredThroughRound = state.round + rounds - 1

  addLog(state, {
    kind: 'anchor',
    playerId: player.id,
    message: `${player.name} anchored the animal at ${coord(animal.col, animal.row)}.`,
    detail: `It ignores the current through round ${animal.anchoredThroughRound}, then the ` +
      `anchor is removed.`,
  })
  return { ok: true, state }
}

function handleBuyPowerCard(
  state: GameState,
  payment: Partial<ResourceBag> | undefined,
): ActionResult {
  const player = requireTurn(state)
  if (typeof player === 'string') return fail(player)
  if (!state.rules.powerCards.enabled) return fail('Power Cards are switched off.')
  if (state.powerDeck.length === 0) return fail('The Power Card deck is empty.')

  const amount = state.rules.powerCards.cost
  let cost: ResourceBag
  if (payment) {
    cost = { wood: 0, stone: 0, clay: 0, reeds: 0, ...payment }
    const given = RESOURCE_IDS.reduce((sum, id) => sum + cost[id], 0)
    if (given !== amount) return fail(`A Power Card costs exactly ${amount} resources.`)
  } else {
    const auto = autoPayment(player, amount)
    if (!auto) return fail(`Not enough resources. A Power Card costs ${amount}.`)
    cost = auto
  }
  if (!canAfford(player, cost)) return fail('Not enough resources for a Power Card.')

  const actionError = spendAction(player, state.rules.powerCards.purchaseUsesAction)
  if (actionError) return fail(actionError)

  payCost(player, cost)
  const cardId = state.powerDeck.shift()
  if (!cardId) return fail('The Power Card deck is empty.')

  player.hand.push({ instanceId: `pc-${state.nextLogId}`, cardId })
  player.stats.powerCardsBought += 1

  const card = cardById(state, cardId)
  addLog(state, {
    kind: 'power-card-bought',
    playerId: player.id,
    message: `${player.name} bought a Power Card.`,
    detail: `Drew ${card?.name ?? cardId}, which only they can see. ` +
      `${state.powerDeck.length} cards left in the deck.`,
  })

  // The card was face down, so the turn can no longer be rewound past this point.
  clearUndo(state)
  return { ok: true, state }
}

function handlePlayPowerCard(
  state: GameState,
  playerId: string,
  instanceId: string,
  target: CardTarget,
): ActionResult {
  const player = state.players.find((p) => p.id === playerId)
  if (!player) return fail('Unknown player.')

  const held = player.hand.find((c) => c.instanceId === instanceId)
  if (!held) return fail('You do not hold that card.')

  const card = cardById(state, held.cardId)
  if (!card) return fail('That card is not in the current rules.')

  if (!cardPlayableNow(state, card, playerId)) {
    const when = card.timing === 'turn'
      ? 'during your own turn'
      : 'in the window before the Current Phase is resolved'
    return fail(`${card.name} can only be played ${when}.`)
  }

  const limit = state.rules.powerCards.playsPerPlayerPerRound
  if (player.powerCardsPlayedThisRound >= limit) {
    return fail(`Only ${limit} Power Card may be played per player per round.`)
  }

  const result = applyCardEffect(state, player, card, target)
  if (!result.ok) return fail(result.error)

  player.hand = player.hand.filter((c) => c.instanceId !== instanceId)
  state.powerDiscard.push(card.id)
  player.powerCardsPlayedThisRound += 1
  player.stats.powerCardsPlayed += 1
  refreshMissionProgress(state)
  return { ok: true, state }
}

function handleSaboteurSurge(
  state: GameState,
  playerId: string,
  tileId: string,
): ActionResult {
  const player = state.players.find((p) => p.id === playerId)
  if (!player) return fail('Unknown player.')
  if (saboteurUsesLeft(state, player) <= 0) {
    return fail('No Saboteur uses left this round.')
  }
  if (state.phase !== 'current' || state.currentResolvedForRound === state.round) {
    return fail('The Saboteur acts in the window before the Current Phase is resolved.')
  }

  const tile = state.board.tiles.find((t) => t.id === tileId)
  if (!tile) return fail('Choose a tile.')
  if (tile.kind === 'bank-top' || tile.kind === 'bank-bottom') {
    return fail('Choose a river tile.')
  }

  const strength = state.rules.roles.saboteur.surgeStrength
  state.tileModifiers.push({
    id: `mod-sab-${state.nextLogId}`,
    tileId: tile.id,
    deltaStrength: strength,
    overrideDirection: null,
    sourcePlayerId: player.id,
    sourceLabel: 'A hidden hand',
    forRound: state.round,
  })
  state.saboteurUsesThisRound[player.id] = (state.saboteurUsesThisRound[player.id] ?? 0) + 1

  // Deliberately anonymous: naming the player would give the secret role away.
  addLog(state, {
    kind: 'saboteur',
    message: `The current at ${coord(tile.col, tile.row)} strengthened by ${strength} ` +
      `for no obvious reason.`,
  })
  return { ok: true, state }
}

////////////////////////////////////////////////////////////////////////////////////////////////
// Distraction tokens
////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Distance counted the way the animals themselves move: along the rows and columns, never
 * diagonally. Three squares means three steps left, right, forward or back, so a token's
 * reach is a diamond rather than a square and a corner at (3, 3) is six away, not three.
 * Everything in the game that talks about a range uses this.
 */
export function orthogonalDistance(
  a: { col: number; row: number },
  b: { col: number; row: number },
): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row)
}

export interface DistractionLanding {
  /** Animals standing on the token's square already. */
  standing: number
  /** Animals these drags would bring onto it. */
  arriving: number
  /** How many more the square has space for. */
  room: number
}

/**
 * What a set of drags would do to the token's own square.
 *
 * A Distraction pulls everything toward one square and the square limit binds a drag like any
 * other deliberate move, so this is worth knowing before the drags are committed rather than
 * afterwards, when the last few animals have quietly stopped a square short.
 *
 * It is room left rather than a headcount, because the river does not obey the limit: a
 * current carries every animal standing on a tile, so a square can already hold five. That
 * is nobody's fault and must not make a drag that adds nothing to it illegal.
 */
export function distractionLanding(
  state: GameState,
  pending: PendingDistraction,
  moves: Array<{ animalId: string; distance: number }>,
): DistractionLanding {
  const target = { col: pending.col, row: pending.row }
  const maxDistance = state.rules.distraction.pullDistance
  const cap = state.rules.board.maxAnimalsPerTile
  const standing = animalsOnTile(state, target.col, target.row)

  let arriving = 0
  for (const move of moves) {
    const entry = pending.rolls.find((r) => r.animalId === move.animalId)
    if (!entry || !entry.distracted) continue
    const animal = state.animals.find((a) => a.id === move.animalId)
    if (!animal || !isInPlay(animal)) continue
    const gap = orthogonalDistance(animal, target)
    // A gap of nothing means it is standing there already, where `standing` counts it.
    if (gap > 0 && gap <= Math.min(move.distance, maxDistance)) arriving += 1
  }

  const limited = cap > 0 && isRiverRow(state.board, target.row)
  const room = limited ? Math.max(0, cap - standing) : Number.MAX_SAFE_INTEGER
  return { standing, arriving, room }
}

/** The roll this animal needs to shrug off a distraction. Ducks need more than everyone. */
export function distractionTarget(rules: GameRules, factionId: FactionId): number {
  const d = rules.distraction
  return d.hardToDistract.includes(factionId) ? d.hardAvoidOnRoll : d.avoidOnRoll
}

function handlePlayDistraction(state: GameState, col: number, row: number): ActionResult {
  const player = requireTurn(state)
  if (typeof player === 'string') return fail(player)
  if (!state.rules.distraction.enabled) {
    return fail('Distraction tokens are switched off in the current rules.')
  }
  if (player.distractionTokens <= 0) return fail('You have no Distraction token left.')
  if (state.pendingDistraction) return fail('Finish the Distraction already in play first.')

  const tile = tileAt(state.board, col, row)
  if (!tile) return fail('That square is off the board.')
  if (tile.kind === 'bank-top' || tile.kind === 'bank-bottom') {
    return fail('A Distraction token goes on a river tile.')
  }

  const actionError = spendAction(player, state.rules.distraction.playUsesAction)
  if (actionError) return fail(actionError)

  player.distractionTokens -= 1

  // Everything in range rolls, including the placer's own animals. Putting the token where
  // it only catches opponents is the skill in it.
  const radius = state.rules.distraction.radius
  const inRange = state.animals.filter(
    (a) => isInPlay(a) && orthogonalDistance(a, { col, row }) <= radius,
  )

  const rolls: DistractionRoll[] = []
  for (const animal of inRange) {
    const [roll, rng] = rollDie(state.rng, state.rules.distraction.dieSides)
    state.rng = rng
    const neededRoll = distractionTarget(state.rules, animal.factionId)
    rolls.push({
      animalId: animal.id,
      playerId: animal.playerId,
      factionId: animal.factionId,
      roll,
      neededRoll,
      distracted: roll < neededRoll,
      movedSoFar: 0,
    })
  }

  state.pendingDistraction = { placerId: player.id, col, row, rolls }

  const caught = rolls.filter((r) => r.distracted).length
  addLog(state, {
    kind: 'distraction',
    playerId: player.id,
    message: `${player.name} played a Distraction token on ${coord(col, row)}.`,
    detail: `${rolls.length} ${rolls.length === 1 ? 'animal was' : 'animals were'} within ` +
      `${radius} squares. ${caught} looked away.`,
  })
  for (const entry of rolls) {
    const owner = state.players.find((p) => p.id === entry.playerId)
    addLog(state, {
      kind: 'distraction-roll',
      playerId: entry.playerId,
      message: `${owner?.name ?? 'An animal'} rolled ${entry.roll} and ` +
        `${entry.distracted ? 'was distracted' : 'kept looking ahead'}.`,
      detail: `Needed ${entry.neededRoll} or more.`,
    })
  }

  // The dice have been rolled, so the turn cannot be rewound to roll them again.
  clearUndo(state)
  return { ok: true, state }
}

function handleResolveDistraction(
  state: GameState,
  moves: Array<{ animalId: string; distance: number }>,
): ActionResult {
  const pending = state.pendingDistraction
  if (!pending) return fail('No Distraction token is waiting to be resolved.')

  const maxDistance = state.rules.distraction.pullDistance
  const target = { col: pending.col, row: pending.row }

  // Only so many animals fit on a square, and a Distraction drags everything toward one.
  // The whole set of drags is refused rather than quietly stopping the last few short, so
  // the player decides for themselves which animals come all the way in.
  const landing = distractionLanding(state, pending, moves)
  if (landing.arriving > landing.room) {
    const where = coord(target.col, target.row)
    const cap = state.rules.board.maxAnimalsPerTile
    return fail(
      landing.room === 0
        ? `${where} already holds ${landing.standing} animals and only ${cap} fit, so ` +
          `there is no room on it at all. Draw them in fewer squares so they stop short.`
        : `Only ${cap} animals fit on ${where} and ${landing.standing} ` +
          `${landing.standing === 1 ? 'is' : 'are'} there already, so ${landing.room} more ` +
          `can come in. Draw ${landing.arriving - landing.room} of them in fewer squares.`,
    )
  }

  for (const move of moves) {
    const entry = pending.rolls.find((r) => r.animalId === move.animalId)
    if (!entry || !entry.distracted) continue
    const animal = state.animals.find((a) => a.id === move.animalId)
    if (!animal || !isInPlay(animal)) continue

    const steps = Math.max(0, Math.min(move.distance, maxDistance))
    const before = coord(animal.col, animal.row)
    let moved = 0

    // One square at a time toward the token, closing the larger gap first so the animal
    // takes the straightest line it can. It stops on the token rather than passing it.
    for (let i = 0; i < steps; i += 1) {
      const dCol = target.col - animal.col
      const dRow = target.row - animal.row
      if (dCol === 0 && dRow === 0) break
      let dc = 0
      let dr = 0
      if (Math.abs(dCol) >= Math.abs(dRow)) dc = Math.sign(dCol)
      else dr = Math.sign(dRow)
      const result = slideAnimal(state, animal, dc, dr, 1)
      if (result.moved === 0) break
      moved += 1
      if (isFinished(animal)) break
    }

    entry.movedSoFar = moved
    if (moved > 0) {
      const owner = state.players.find((p) => p.id === animal.playerId)
      addLog(state, {
        kind: 'distraction-pull',
        playerId: animal.playerId,
        message: `A distracted animal of ${owner?.name ?? 'a player'} wandered from ` +
          `${before} to ${coord(animal.col, animal.row)}.`,
        detail: `Drawn ${moved} toward the Distraction at ${coord(target.col, target.row)}.`,
      })
    }
  }

  state.pendingDistraction = null
  refreshMissionProgress(state)
  return { ok: true, state }
}

////////////////////////////////////////////////////////////////////////////////////////////////
// Trading
////////////////////////////////////////////////////////////////////////////////////////////////

/** "the Swans' trade", not "the Swans's trade". Faction names are mostly plurals. */
function possessive(name: string): string {
  return name.endsWith('s') ? `${name}'` : `${name}'s`
}

function tradesLeft(state: GameState, player: Player): number {
  const used = state.tradesProposedThisTurn[player.id] ?? 0
  return Math.max(0, state.rules.trade.proposalsPerTurn - used)
}

function holdsTerms(player: Player, terms: TradeTerms): boolean {
  if (!RESOURCE_IDS.every((id) => player.resources[id] >= Math.max(0, terms.resources[id]))) {
    return false
  }
  return terms.cardInstanceIds.every((id) => player.hand.some((c) => c.instanceId === id))
}

function handleProposeTrade(
  state: GameState,
  toPlayerId: string,
  offer: TradeTerms,
  request: TradeProposal['request'],
): ActionResult {
  const player = requireTurn(state)
  if (typeof player === 'string') return fail(player)
  if (!state.rules.trade.enabled) return fail('Trading is switched off in the current rules.')
  if (state.pendingTrade) return fail('There is already a trade on the table.')
  state.tradeOutcome = null
  if (tradesLeft(state, player) <= 0) {
    return fail(`Only ${state.rules.trade.proposalsPerTurn} trade may be proposed a turn.`)
  }

  const other = state.players.find((p) => p.id === toPlayerId)
  if (!other) return fail('Unknown player.')
  if (other.id === player.id) return fail('You cannot trade with yourself.')
  if (!holdsTerms(player, offer)) return fail('You do not hold everything you are offering.')

  const offered = bagTotal(offer.resources) + offer.cardInstanceIds.length
  const wanted = bagTotal(request.resources) + Math.max(0, request.cardCount)
  if (offered === 0 && wanted === 0) return fail('A trade has to move something.')

  const actionError = spendAction(player, state.rules.trade.usesAction)
  if (actionError) return fail(actionError)

  state.tradesProposedThisTurn[player.id] = (state.tradesProposedThisTurn[player.id] ?? 0) + 1
  state.pendingTrade = {
    id: `trade-${state.nextLogId}`,
    fromPlayerId: player.id,
    toPlayerId: other.id,
    offer,
    request,
    status: 'awaiting-reply',
  }

  addLog(state, {
    kind: 'trade-offer',
    playerId: player.id,
    message: `${player.name} offered ${other.name} a trade.`,
    detail: `Offering ${describeTerms(offer)} for ` +
      `${describeTerms({ resources: request.resources, cardInstanceIds: [] },
        request.cardCount)}.`,
  })

  // No thinking time for a computer opponent: it has everything it needs the moment the
  // offer lands, so a pause before the answer would only be theatre.
  if (other.controller === 'ai') {
    const error = answerPendingTrade(state)
    if (error) return fail(error)
  }
  return { ok: true, state }
}

/**
 * The other player's answer: take it, leave it, or name terms of their own.
 *
 * Returns an error message, or null once the trade has been answered. A computer opponent
 * answers inside the same action that proposed the deal, so the offer and the reply arrive
 * together rather than the proposer watching an empty table for a moment.
 */
function answerPendingTrade(state: GameState): string | null {
  const proposal = state.pendingTrade
  if (!proposal) return 'There is no trade waiting for an answer.'
  if (proposal.status !== 'awaiting-reply') return 'That trade has already been answered.'

  const from = state.players.find((p) => p.id === proposal.fromPlayerId)
  const to = state.players.find((p) => p.id === proposal.toPlayerId)
  if (!from || !to) return 'Unknown player.'

  const verdict = judgeTrade(state, proposal)
  // The answer is reported in a popup to whoever is sitting at the keyboard, and only to
  // them: two computer players haggling is the log's business, not an interruption.
  const tell = (outcome: TradeOutcome) => {
    state.tradeOutcome = from.controller === 'human' ? outcome : null
  }

  if (verdict.answer === 'accept') {
    const given: TradeTerms = {
      resources: proposal.request.resources,
      cardInstanceIds: to.hand.slice(0, proposal.request.cardCount).map((c) => c.instanceId),
    }
    settleTrade(from, to, proposal.offer, given)
    state.pendingTrade = null
    addLog(state, {
      kind: 'trade-accepted',
      playerId: to.id,
      message: `${to.name} accepted ${possessive(from.name)} trade.`,
      detail: verdict.reply,
    })
    tell({
      status: 'accepted',
      fromPlayerId: from.id,
      toPlayerId: to.id,
      headline: `${to.name} took the deal.`,
      detail: verdict.reply,
      terms: `You gave ${describeTerms(proposal.offer)} and got ${describeTerms(given)}.`,
    })
    clearUndo(state)
    return null
  }

  if (verdict.answer === 'counter' && verdict.counter) {
    proposal.status = 'countered'
    proposal.counter = verdict.counter
    proposal.reply = verdict.reply
    addLog(state, {
      kind: 'trade-counter',
      playerId: to.id,
      message: `${to.name} countered ${possessive(from.name)} offer.`,
      detail: verdict.reply,
    })
    tell({
      status: 'countered',
      fromPlayerId: from.id,
      toPlayerId: to.id,
      headline: `${to.name} want a different deal.`,
      detail: verdict.reply,
      terms: `They will give ${describeTerms(verdict.counter)} for your ` +
        `${describeTerms(proposal.offer)}.`,
    })
    return null
  }

  state.pendingTrade = null
  addLog(state, {
    kind: 'trade-declined',
    playerId: to.id,
    message: `${to.name} turned ${possessive(from.name)} trade down.`,
    detail: verdict.reply,
  })
  tell({
    status: 'declined',
    fromPlayerId: from.id,
    toPlayerId: to.id,
    headline: `That is a no from ${to.name}.`,
    detail: verdict.reply,
    terms: `You offered ${describeTerms(proposal.offer)} for ` +
      `${describeTerms({ resources: proposal.request.resources, cardInstanceIds: [] },
        proposal.request.cardCount)}.`,
  })
  return null
}

function handleAnswerTrade(state: GameState): ActionResult {
  const error = answerPendingTrade(state)
  return error ? fail(error) : { ok: true, state }
}

/** The proposer's last word on a counter-offer. */
function handleSettleTrade(state: GameState, accept: boolean): ActionResult {
  const proposal = state.pendingTrade
  if (!proposal) return fail('There is no trade to settle.')
  if (proposal.status !== 'countered') return fail('There is no counter-offer to answer.')

  const from = state.players.find((p) => p.id === proposal.fromPlayerId)
  const to = state.players.find((p) => p.id === proposal.toPlayerId)
  if (!from || !to || !proposal.counter) return fail('That trade is no longer valid.')

  if (!accept) {
    state.pendingTrade = null
    state.tradeOutcome = null
    addLog(state, {
      kind: 'trade-declined',
      playerId: from.id,
      message: `${from.name} turned down ${possessive(to.name)} counter-offer.`,
    })
    return { ok: true, state }
  }

  // Both sides are re-checked here: a counter is answered after other things have happened.
  if (!holdsTerms(from, proposal.offer) || !holdsTerms(to, proposal.counter)) {
    state.pendingTrade = null
    return fail('That trade can no longer be honoured, so it has been taken off the table.')
  }

  settleTrade(from, to, proposal.offer, proposal.counter)
  state.pendingTrade = null
  state.tradeOutcome = null
  addLog(state, {
    kind: 'trade-accepted',
    playerId: from.id,
    message: `${from.name} took ${possessive(to.name)} counter-offer.`,
    detail: `${describeTerms(proposal.offer)} for ${describeTerms(proposal.counter)}.`,
  })
  clearUndo(state)
  return { ok: true, state }
}

function handleWithdrawTrade(state: GameState): ActionResult {
  if (!state.pendingTrade) return fail('There is no trade to withdraw.')
  const from = state.players.find((p) => p.id === state.pendingTrade?.fromPlayerId)
  state.pendingTrade = null
  state.tradeOutcome = null
  addLog(state, {
    kind: 'trade-withdrawn',
    playerId: from?.id ?? null,
    message: `${from?.name ?? 'A player'} withdrew the trade.`,
  })
  return { ok: true, state }
}

function handleSetDamExclusion(
  state: GameState,
  damId: string,
  animalId: string,
): ActionResult {
  const dam = state.dams.find((d) => d.id === damId)
  if (!dam) return fail('That dam is not on the board.')

  const player = state.players.find((p) => p.id === dam.ownerPlayerId)
  if (!player) return fail('Unknown dam owner.')
  if (state.rules.dam.exclusionsPerRound <= 0) {
    return fail('Dam exclusions are switched off in the current rules.')
  }
  if (dam.excludedForRound === state.round) {
    return fail('That dam has already barred an animal this round.')
  }

  const animal = state.animals.find((a) => a.id === animalId)
  if (!animal) return fail('Choose an animal.')

  dam.excludedAnimalId = animal.id
  dam.excludedForRound = state.round

  addLog(state, {
    kind: 'dam-exclusion',
    playerId: player.id,
    message: `${player.name} barred one animal from the dam at ${coord(dam.col, dam.row)}.`,
    detail: `The animal at ${coord(animal.col, animal.row)} gets no shelter this round.`,
  })
  return { ok: true, state }
}

function handleResolveCurrent(state: GameState): ActionResult {
  if (state.phase !== 'current') {
    return fail('The Current Phase can only be resolved after every player has acted.')
  }
  if (state.currentResolvedForRound === state.round) {
    return fail('The Current Phase has already been resolved this round.')
  }

  state.currentSteps = resolveCurrentPhase(state)
  state.currentResolvedForRound = state.round
  clearRoundEffects(state)
  endRound(state)
  return { ok: true, state }
}

function handlePlaceCollector(
  state: GameState,
  playerId: string,
  area: ResourceId,
): ActionResult {
  if (state.phase !== 'resource') return fail('Collectors are placed in the Resource Phase.')
  const player = state.players.find((p) => p.id === playerId)
  if (!player) return fail('Unknown player.')
  const left = collectorsLeft(state, player)
  if (left <= 0) return fail('All of your collectors are already placed.')

  player.collectors.push(area)
  const remaining = left - 1
  addLog(state, {
    kind: 'collector',
    playerId: player.id,
    message: `${player.name} put a collector in ${RESOURCE_LABELS[area]}.`,
    detail: remaining > 0
      ? `${remaining} still to place.`
      : `Collectors in ${describeCollectors(player)}.`,
  })
  return { ok: true, state }
}

/** Lets a player take a collector back before the card is turned over. */
function handleRemoveCollector(
  state: GameState,
  playerId: string,
  index: number,
): ActionResult {
  if (state.phase !== 'resource') return fail('Collectors are placed in the Resource Phase.')
  const player = state.players.find((p) => p.id === playerId)
  if (!player) return fail('Unknown player.')
  if (index < 0 || index >= player.collectors.length) return fail('No collector there.')

  const [area] = player.collectors.splice(index, 1)
  addLog(state, {
    kind: 'collector',
    playerId: player.id,
    message: `${player.name} took a collector back out of ${RESOURCE_LABELS[area]}.`,
  })
  return { ok: true, state }
}

function handleResolveProduction(state: GameState): ActionResult {
  if (state.phase !== 'resource') return fail('Not in the Resource Phase.')
  if (!allCollectorsPlaced(state)) return fail('Every collector must be placed first.')
  if (state.resourcesCollectedForRound === state.round) {
    return fail('Resources have already been collected this round.')
  }

  resolveProduction(state)
  state.resourcesCollectedForRound = state.round
  state.phase = 'player-turns'
  state.activePlayerIndex = 0
  refreshMissionProgress(state)
  startTurn(state)
  return { ok: true, state }
}

function handleMoveAnimal(
  state: GameState,
  animalId: string,
  col: number,
  row: number,
): ActionResult {
  const player = requireTurn(state)
  if (typeof player === 'string') return fail(player)

  const animal = state.animals.find((a) => a.id === animalId)
  if (!animal) return fail('Unknown animal.')
  if (animal.playerId !== player.id) return fail('That animal is not yours.')
  if (!isInPlay(animal)) return fail('That animal is no longer in play.')

  const tileBefore = tileAt(state.board, col, row)
  const willReveal = Boolean(tileBefore && tileBefore.hidden && !tileBefore.revealed)

  const result = moveAnimalStep(state, animal, col, row)
  if (!result.ok) return fail(result.error ?? 'That move is not legal.')

  refreshMissionProgress(state)
  // Walking onto a hidden current reveals information, so the turn cannot be rewound past it.
  if (willReveal) clearUndo(state)
  return { ok: true, state }
}

function handleUndo(state: GameState): ActionResult {
  if (!state.rules.game.allowUndo) return fail('Undo is switched off in the current rules.')
  const snapshot = state.undoStack.pop()
  if (!snapshot) return fail('There is nothing to undo.')
  const restored = JSON.parse(snapshot) as GameState
  restored.undoStack = state.undoStack
  return { ok: true, state: restored }
}

////////////////////////////////////////////////////////////////////////////////////////////////
// Dispatcher
////////////////////////////////////////////////////////////////////////////////////////////////

/** Actions that can be rewound. Anything that reveals hidden information is not on this list. */
const UNDOABLE: ReadonlySet<GameAction['type']> = new Set([
  'move-animal',
  'buy-equipment',
  'place-dam',
  'use-raft',
  'use-rope',
  'use-anchor',
  'destroy-dam',
  'set-dam-exclusion',
  'play-power-card',
])

export function applyAction(state: GameState, action: GameAction): ActionResult {
  if (state.phase === 'finished' && action.type !== 'undo') {
    return fail('The game is over.')
  }

  if (action.type === 'undo') return handleUndo(state)

  // A played Distraction token freezes everything else until its drags have been chosen,
  // so an animal cannot be moved out from under a roll that has already been made.
  if (state.pendingDistraction && action.type !== 'resolve-distraction') {
    return fail('Finish the Distraction first: choose how far each animal is drawn in.')
  }

  // Likewise a trade: it has to be answered before the turn carries on, so nobody can spend
  // the resources they have just offered somebody else.
  const TRADE_ACTIONS = new Set([
    'answer-trade', 'settle-trade', 'withdraw-trade', 'dismiss-trade-outcome',
  ])
  if (state.pendingTrade && !TRADE_ACTIONS.has(action.type)) {
    return fail('There is a trade on the table. Settle it before doing anything else.')
  }

  const draft = clone(state)
  if (draft.phase === 'player-turns' && UNDOABLE.has(action.type)) {
    pushUndo(draft)
  }

  switch (action.type) {
    case 'place-collector':
      return handlePlaceCollector(draft, action.playerId, action.area)
    case 'resolve-production':
      return handleResolveProduction(draft)
    case 'move-animal':
      return handleMoveAnimal(draft, action.animalId, action.col, action.row)
    case 'buy-equipment':
      return handleBuyEquipment(draft, action.item)
    case 'place-dam':
      return handlePlaceDam(draft, action.col, action.row)
    case 'use-raft':
      return handleUseRaft(draft, action.animalId)
    case 'use-rope':
      return handleUseRope(draft, action.animalId, action.towardAnimalId, action.distance,
        action.axis)
    case 'use-anchor':
      return handleUseAnchor(draft, action.animalId)
    case 'destroy-dam':
      return handleDestroyDam(draft, action.damId)
    case 'set-dam-exclusion':
      return handleSetDamExclusion(draft, action.damId, action.animalId)
    case 'buy-power-card':
      return handleBuyPowerCard(draft, action.payment)
    case 'play-power-card':
      return handlePlayPowerCard(draft, action.playerId, action.instanceId, action.target)
    case 'saboteur-surge':
      return handleSaboteurSurge(draft, action.playerId, action.tileId)
    case 'play-distraction':
      return handlePlayDistraction(draft, action.col, action.row)
    case 'resolve-distraction':
      return handleResolveDistraction(draft, action.moves)
    case 'remove-collector':
      return handleRemoveCollector(draft, action.playerId, action.index)
    case 'propose-trade':
      return handleProposeTrade(draft, action.toPlayerId, action.offer, action.request)
    case 'answer-trade':
      return handleAnswerTrade(draft)
    case 'settle-trade':
      return handleSettleTrade(draft, action.accept)
    case 'withdraw-trade':
      return handleWithdrawTrade(draft)
    case 'dismiss-trade-outcome':
      draft.tradeOutcome = null
      return { ok: true, state: draft }
    case 'end-turn': {
      const player = requireTurn(draft)
      if (typeof player === 'string') return fail(player)
      endTurnInternal(draft)
      return { ok: true, state: draft }
    }
    case 'resolve-current':
      return handleResolveCurrent(draft)
    default:
      return fail('Unknown action.')
  }
}

////////////////////////////////////////////////////////////////////////////////////////////////
// Queries used by the interface and the AI
////////////////////////////////////////////////////////////////////////////////////////////////

export function animalsOf(state: GameState, playerId: string): Animal[] {
  return state.animals.filter((a) => a.playerId === playerId)
}

export function activeAnimalsOf(state: GameState, playerId: string): Animal[] {
  return animalsOf(state, playerId).filter((a) => isInPlay(a))
}

export function animalsAcross(state: GameState, playerId: string): number {
  return animalsOf(state, playerId).filter((a) => a.status === 'finished').length
}

export function distanceToFinish(state: GameState, animal: Animal): number {
  return bottomBankRow(state.board) - animal.row
}

/** Places an animal without charging anything, for tests and scenario setup. */
export function debugPlaceAnimal(
  state: GameState,
  animalId: string,
  col: number,
  row: number,
): void {
  const animal = state.animals.find((a) => a.id === animalId)
  if (animal) placeAnimal(state, animal, col, row)
}
