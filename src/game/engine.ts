////////////////////////////////////////////////////////////////////////////////////////////////
// The rules engine.
//
// Every change to a game goes through applyAction. It takes a state and an action and returns
// either a new state or an error message, and it never touches the DOM. The interface and the
// AI both drive the game through this one door, so the AI cannot make a move a player could
// not, and a sequence of actions replayed against the same seed gives the same game.
////////////////////////////////////////////////////////////////////////////////////////////////

import { bottomBankRow, tileAt } from './board'
import { applyCardEffect, cardById, cardPlayableNow, type CardTarget } from './cards'
import { clearRoundEffects, resolveCurrentPhase } from './current'
import { addLog } from './log'
import { coord, isFinished, moveAnimalStep, placeAnimal, slideAnimal } from './movement'
import { refreshMissionProgress } from './missions'
import { allCollectorsPlaced, resetCollectors, resolveProduction } from './production'
import { dealRoles, saboteurUsesLeft } from './roles'
import { rollDie, nextInt } from './rng'
import type { GameRules } from './rules'
import { scoreGame } from './scoring'
import type {
  Animal,
  ActionResult,
  EquipmentId,
  FactionId,
  GameState,
  Player,
  ResourceBag,
  ResourceId,
} from './types'
import { RESOURCE_IDS, RESOURCE_LABELS } from './types'

const MAX_UNDO_DEPTH = 40

export type GameAction =
  | { type: 'place-collector'; playerId: string; area: ResourceId }
  | { type: 'resolve-production' }
  | { type: 'move-animal'; animalId: string; col: number; row: number }
  | { type: 'buy-equipment'; item: EquipmentId }
  | { type: 'place-dam'; col: number; row: number }
  | { type: 'use-raft'; animalId: string }
  | { type: 'use-rope'; animalId: string; towardAnimalId: string; distance?: number }
  | { type: 'use-anchor'; animalId: string }
  | { type: 'destroy-dam'; damId: string }
  | { type: 'set-dam-exclusion'; damId: string; animalId: string }
  | { type: 'buy-power-card'; payment?: Partial<ResourceBag> }
  | { type: 'play-power-card'; playerId: string; instanceId: string; target: CardTarget }
  | { type: 'saboteur-surge'; playerId: string; tileId: string }
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

  for (const animal of state.animals) {
    if (animal.playerId !== player.id) continue
    animal.distracted = false
  }

  applyDistraction(state, player)
  clearUndo(state)

  addLog(state, {
    kind: 'turn-start',
    playerId: player.id,
    message: `${player.name}'s turn.`,
    detail: `${player.movementRemaining} movement, ${player.actionsRemaining} ` +
      `${player.actionsRemaining === 1 ? 'action' : 'actions'}.`,
  })
}

/** The optional Ducks weakness. Off by default until the rule is confirmed. */
function applyDistraction(state: GameState, player: Player): void {
  const rules = state.rules.distraction
  if (!rules.enabled) return
  if (!rules.appliesTo.includes(player.factionId)) return

  const [roll, rng] = rollDie(state.rng, rules.dieSides)
  state.rng = rng
  if (roll >= rules.avoidOnRoll) {
    addLog(state, {
      kind: 'distraction',
      playerId: player.id,
      message: `${player.name} rolled ${roll} and avoided distraction.`,
    })
    return
  }

  const candidates = state.animals.filter(
    (a) => a.playerId === player.id && a.status !== 'finished',
  )
  if (candidates.length === 0) return

  if (rules.scope === 'all-animals') {
    for (const animal of candidates) animal.distracted = true
    addLog(state, {
      kind: 'distraction',
      playerId: player.id,
      message: `${player.name} rolled ${roll} and the whole flock is distracted this turn.`,
    })
    return
  }

  const [index, rng2] = nextInt(state.rng, 0, candidates.length - 1)
  state.rng = rng2
  const victim = candidates[index]
  victim.distracted = true
  addLog(state, {
    kind: 'distraction',
    playerId: player.id,
    message: `${player.name} rolled ${roll}. One animal is distracted and cannot move.`,
    detail: `The animal at ${coord(victim.col, victim.row)} sits this turn out.`,
  })
}

function endTurnInternal(state: GameState): void {
  const player = activePlayer(state)
  if (player) {
    player.movementRemaining = 0
    player.actionsRemaining = 0
    for (const animal of state.animals) {
      if (animal.playerId !== player.id) continue
      animal.bonusMovement = 0
      animal.distracted = false
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
    detail: `It calms the water ${state.rules.dam.calmAxis === 'vertical' ? 'above and below' : 'left and right'} ` +
      `it, within ${state.rules.dam.calmRadius} square, until it is destroyed.`,
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

  // Everything immediately downstream of the dam is swept forward by the released water.
  const sweep = state.rules.dam.sweepDistance
  const direction = state.rules.current.direction === 'right' ? 1 : -1
  const downstreamCol = dam.col + direction
  const swept = state.animals.filter(
    (a) => a.status !== 'finished' && a.col === downstreamCol && a.row === dam.row,
  )
  for (const animal of swept) {
    const before = coord(animal.col, animal.row)
    const result = slideAnimal(state, animal, direction, 0, sweep)
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
  if (animal.status === 'finished') return fail('That animal has already crossed.')

  const actionError = spendAction(player, state.rules.equipment.raft.useUsesAction)
  if (actionError) return fail(actionError)

  const before = coord(animal.col, animal.row)
  const result = slideAnimal(state, animal, 0, 1, state.rules.equipmentEffects.raftDistance)
  if (result.moved === 0) {
    return fail('That animal has nowhere to go forward.')
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
  if (animal.status === 'finished' || anchorAnimal.status === 'finished') {
    return fail('Both animals must still be in play.')
  }

  const gap = Math.max(
    Math.abs(animal.col - anchorAnimal.col),
    Math.abs(animal.row - anchorAnimal.row),
  )
  const range = state.rules.equipmentEffects.ropeRange
  if (gap > range) return fail(`Those animals are more than ${range} squares apart.`)

  const actionError = spendAction(player, state.rules.equipment.rope.useUsesAction)
  if (actionError) return fail(actionError)

  const maxDistance = state.rules.equipmentEffects.ropeDistance
  const steps = Math.min(distance ?? maxDistance, maxDistance)
  const before = coord(animal.col, animal.row)
  let moved = 0

  // Step toward the other animal, closing the larger gap first so the path looks natural.
  for (let i = 0; i < steps; i += 1) {
    const dCol = anchorAnimal.col - animal.col
    const dRow = anchorAnimal.row - animal.row
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

  if (moved === 0) return fail('The rope could not move that animal any closer.')
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
  if (animal.status === 'finished') return fail('That animal has already crossed.')

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
  if (player.collectorArea !== null) return fail('That collector is already placed.')

  player.collectorArea = area
  addLog(state, {
    kind: 'collector',
    playerId: player.id,
    message: `${player.name} put their collector in ${RESOURCE_LABELS[area]}.`,
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
  if (animal.status === 'finished') return fail('That animal has already crossed.')
  if (animal.distracted) return fail('That animal is distracted and cannot move this turn.')

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
      return handleUseRope(draft, action.animalId, action.towardAnimalId, action.distance)
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
  return animalsOf(state, playerId).filter((a) => a.status !== 'finished')
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
