////////////////////////////////////////////////////////////////////////////////////////////////
// The active player's controls: collectors in the Resource Phase, then movement, the one
// action, equipment, Power Cards and ending the turn.
////////////////////////////////////////////////////////////////////////////////////////////////

import { useState } from 'react'

import { cardById } from '../game/cards'
import { assessCurrent } from '../game/current'
import {
  activePlayer,
  canAfford,
  distractionLanding,
  equipmentCost,
  totalResources,
} from '../game/engine'
import type { GameAction, RopeAxis } from '../game/engine'
import { coord, describeTile, isInPlay, isUnprotectedBonusAnimal } from '../game/movement'
import { collectorsLeft } from '../game/production'
import { cardPlaysAllowed, COLLECTOR_AREAS } from '../game/rules'
import type { Animal, EquipmentId, GameState, Player, ResourceId } from '../game/types'
import { EQUIPMENT_IDS, FACTION_IDS, RESOURCE_IDS, RESOURCE_LABELS } from '../game/types'
import { bg, equipmentArt, factionArt, resourceArt } from './art'
import { TradePanel } from './TradePanel'
import { startCardTargeting, targetingPrompt, type Targeting } from './targeting'

export interface TurnPanelProps {
  state: GameState
  dispatch: (action: GameAction) => boolean
  selectedAnimalId: string | null
  setSelectedAnimalId: (id: string | null) => void
  targeting: Targeting
  setTargeting: (targeting: Targeting) => void
}

export function TurnPanel(props: TurnPanelProps) {
  const { state } = props

  if (state.phase === 'resource') return <ResourcePhasePanel {...props} />
  if (state.phase === 'player-turns') return <PlayerTurnPanel {...props} />
  return null
}

////////////////////////////////////////////////////////////////////////////////////////////////

function ResourcePhasePanel({ state, dispatch }: TurnPanelProps) {
  const next = state.players.find(
    (p) => p.controller === 'human' && collectorsLeft(state, p) > 0,
  )
  const perPlayer = state.rules.production.collectorsPerPlayer

  return (
    <div className="panel">
      <header>Phase A - Collectors</header>
      <div className="body">
        <div className="hint" style={{ marginBottom: 10 }}>
          You have {perPlayer} collectors. Put them in resource areas - spread them across two
          areas, or stack both on one to double up on a hunch. A production card is then turned
          over and says what one collector in each area brings back. Nobody sees it first.
        </div>

        {state.players.map((player) => (
          <div key={player.id} className="row" style={{ marginBottom: 6 }}>
            <span style={{ width: 76, fontSize: 13 }}>{player.name}</span>
            {player.collectors.map((area, index) => (
              <span key={`${area}-${index}`} className={`res ${area}`}>
                <span className="swatch" style={bg(resourceArt(area))} />
                {RESOURCE_LABELS[area]}
              </span>
            ))}
            {collectorsLeft(state, player) > 0 && (
              <span className="faint">
                {player.controller === 'ai' ? 'choosing...' : 'waiting'}
              </span>
            )}
          </div>
        ))}

        {next && (
          <>
            <div className="section-title" style={{ marginTop: 14 }}>
              {next.name}, place collector {next.collectors.length + 1} of {perPlayer}
            </div>
            <div className="row wrap">
              {COLLECTOR_AREAS.map((area) => (
                <button
                  key={area}
                  className="btn"
                  onClick={() =>
                    dispatch({ type: 'place-collector', playerId: next.id, area })
                  }
                >
                  <span className={`res ${area}`} style={{ border: 'none', background: 'none' }}>
                    <span className="swatch" style={bg(resourceArt(area))} />
                  </span>
                  {RESOURCE_LABELS[area]}
                </button>
              ))}
            </div>
            {next.collectors.length > 0 && (
              <div className="row wrap" style={{ marginTop: 8 }}>
                <span className="faint">Changed your mind?</span>
                {next.collectors.map((area, index) => (
                  <button
                    key={`undo-${area}-${index}`}
                    className="btn tiny ghost"
                    onClick={() =>
                      dispatch({ type: 'remove-collector', playerId: next.id, index })
                    }
                  >
                    Take back {RESOURCE_LABELS[area]}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {!next && (
          <div className="faint" style={{ marginTop: 10 }}>
            All collectors are placed. Turning over the production card...
          </div>
        )}
      </div>
    </div>
  )
}

////////////////////////////////////////////////////////////////////////////////////////////////

function PlayerTurnPanel({
  state,
  dispatch,
  selectedAnimalId,
  setSelectedAnimalId,
  targeting,
  setTargeting,
}: TurnPanelProps) {
  const player = activePlayer(state)
  if (!player) return null

  if (player.controller === 'ai') {
    return (
      <div className="panel">
        <header>{player.name} is thinking</header>
        <div className="body">
          <div className="faint">
            Watch the board, or read what it did in the log. Set the AI delay to 0 in the rules
            editor to make its turns instant.
          </div>
        </div>
      </div>
    )
  }

  const selected = state.animals.find((a) => a.id === selectedAnimalId) ?? null
  const prompt = targetingPrompt(targeting)
  const named = state.animals.find((a) => a.id === player.bonusAnimalId)

  return (
    <div className="panel">
      <header>
        {player.name}
        <span className="spacer" />
        <span className="chip active">
          <strong>{player.movementRemaining}</strong> move
        </span>
        <span className="chip active">
          <strong>{player.actionsRemaining}</strong> act
        </span>
        {player.bonusAnimalMoveRemaining > 0 && (
          <span
            className="chip"
            title={
              named
                ? 'This faction moves one animal an extra square, and it is this one from ' +
                  'now on.'
                : 'This faction moves one animal an extra square. Whichever animal spends ' +
                  'it is the one that keeps it for the rest of the game.'
            }
          >
            +{player.bonusAnimalMoveRemaining} for{' '}
            <strong>{named ? coord(named.col, named.row) : 'one animal'}</strong>
          </span>
        )}
      </header>
      <div className="body">
        {prompt && (
          <div className="hint" style={{ borderColor: 'var(--warn)', marginBottom: 10 }}>
            {prompt}
            <button
              className="btn tiny ghost"
              style={{ marginLeft: 8 }}
              onClick={() => setTargeting(null)}
            >
              Cancel
            </button>
            {targeting?.kind === 'card' && <DirectionAndResourcePicks
              targeting={targeting}
              setTargeting={setTargeting}
            />}
            {targeting?.kind === 'rope' && targeting.animalId && targeting.towardAnimalId && (
              <RopeAxisPicks
                animalId={targeting.animalId}
                towardAnimalId={targeting.towardAnimalId}
                dispatch={dispatch}
                setTargeting={setTargeting}
              />
            )}
          </div>
        )}

        <SelectedAnimal
          state={state}
          player={player}
          animal={selected}
          dispatch={dispatch}
          setTargeting={setTargeting}
          setSelectedAnimalId={setSelectedAnimalId}
        />

        <div className="section-title">Build and buy (uses your action)</div>
        <Shop state={state} player={player} dispatch={dispatch} />

        <DistractionControls
          state={state}
          player={player}
          setTargeting={setTargeting}
        />

        <TradePanel state={state} player={player} dispatch={dispatch} />

        <DamControls state={state} player={player} dispatch={dispatch} />

        <div className="section-title">Power Cards in hand ({player.hand.length})</div>
        <Hand
          state={state}
          player={player}
          setTargeting={setTargeting}
          windowLabel="turn"
        />

        <div className="row" style={{ marginTop: 14 }}>
          <button
            className="btn primary"
            style={{ flex: 1 }}
            onClick={() => {
              setSelectedAnimalId(null)
              setTargeting(null)
              dispatch({ type: 'end-turn' })
            }}
          >
            End turn
          </button>
          {state.rules.game.allowUndo && (
            <button
              className="btn"
              disabled={state.undoStack.length === 0}
              onClick={() => dispatch({ type: 'undo' })}
              title={
                state.undoStack.length === 0
                  ? 'Nothing to undo, or the turn has revealed hidden information'
                  : 'Undo the last action'
              }
            >
              Undo
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

////////////////////////////////////////////////////////////////////////////////////////////////

function SelectedAnimal({
  state,
  player,
  animal,
  dispatch,
  setTargeting,
  setSelectedAnimalId,
}: {
  state: GameState
  player: Player
  animal: Animal | null
  dispatch: (action: GameAction) => boolean
  setTargeting: (targeting: Targeting) => void
  setSelectedAnimalId: (id: string | null) => void
}) {
  const mine = state.animals.filter(
    (a) => a.playerId === player.id && isInPlay(a),
  )

  if (!animal) {
    return (
      <div className="hint">
        Click one of your animals on the board to select it, then click a highlighted square to
        move. You have {mine.length} animals still crossing.
      </div>
    )
  }

  const assessment = assessCurrent(state, animal)
  const faction = state.rules.factions[player.factionId]
  const neverProtected = isUnprotectedBonusAnimal(state, animal)

  return (
    <div style={{ marginBottom: 10 }}>
      <div className="row">
        <span className={`pip ${animal.factionId} selected`} />
        <b style={{ fontSize: 13 }}>At {coord(animal.col, animal.row)}</b>
        <span className="faint">{describeTile(state, animal.col, animal.row)}</span>
        <button
          className="btn tiny ghost right"
          onClick={() => setSelectedAnimalId(null)}
        >
          Clear
        </button>
      </div>

      <div className="faint" style={{ marginTop: 4 }}>
        If the current ran now: <b style={{ color: 'var(--text)' }}>
          {assessment.effectiveStrength === 0
            ? 'it would not move'
            : `pushed ${assessment.effectiveStrength} ${assessment.direction}`}
        </b>
        <div style={{ marginTop: 2 }}>{assessment.reasons.join(' ')}</div>
      </div>

      {neverProtected && (
        <div className="faint" style={{ marginTop: 6 }}>
          This one carries your extra square, so it is never out of the current: no anchor,
          no Current Shield.
        </div>
      )}

      <div className="row wrap" style={{ marginTop: 8 }}>
        {player.equipment.raft > 0 && (
          <button
            className="btn small"
            onClick={() => dispatch({ type: 'use-raft', animalId: animal.id })}
          >
            Use raft ({player.equipment.raft})
          </button>
        )}
        {player.equipment.anchor > 0 && !faction.forbiddenEquipment.includes('anchor') && (
          <button
            className="btn small"
            disabled={neverProtected}
            title={
              neverProtected
                ? `This is the animal with ${faction.name} extra square, and that one is ` +
                  'never out of the current. An anchor will not stick to it.'
                : undefined
            }
            onClick={() => dispatch({ type: 'use-anchor', animalId: animal.id })}
          >
            Drop anchor ({player.equipment.anchor})
          </button>
        )}
        {player.equipment.rope > 0 && !faction.forbiddenEquipment.includes('rope') && (
          <button
            className="btn small"
            onClick={() => setTargeting({ kind: 'rope', animalId: animal.id })}
          >
            Use rope ({player.equipment.rope})
          </button>
        )}
        {player.equipment.dam > 0 && (
          <button className="btn small" onClick={() => setTargeting({ kind: 'place-dam' })}>
            Place dam ({player.equipment.dam})
          </button>
        )}
      </div>
    </div>
  )
}

////////////////////////////////////////////////////////////////////////////////////////////////

/** "a dam", but "an anchor". Only ever used on the four equipment names. */
function article(word: string): string {
  return 'aeiou'.includes(word[0]) ? 'an' : 'a'
}

/**
 * What each piece of equipment actually does, in the player's own numbers. Built from the
 * rules rather than written out, so editing a distance in the rules editor changes the
 * explanation too and the two can never disagree.
 */
/**
 * The factions shut out of an item, as a sentence. Read off the rules rather than written
 * out, because which factions those are is a knob now and has moved once already.
 */
function bannedFor(state: GameState, item: EquipmentId): string {
  const names = FACTION_IDS
    .filter((id) => state.rules.factions[id].forbiddenEquipment.includes(item))
    .map((id) => state.rules.factions[id].name)
  if (names.length === 0) return ''
  return ` ${names.join(' and ')} cannot use ${item}s.`
}

function equipmentInfo(state: GameState, item: EquipmentId): string[] {
  const rules = state.rules
  const fx = rules.equipmentEffects
  const lines: string[] = []

  if (item === 'dam') {
    const axis = rules.dam.calmAxis === 'vertical' ? 'above and below' : 'either side of'
    lines.push(
      `Place it on a river tile. It calms the water ${axis} it, within ` +
        `${rules.dam.calmRadius} ${rules.dam.calmRadius === 1 ? 'square' : 'squares'}` +
        `${rules.dam.calmsOwnTile ? ', including its own square' : ''}.`,
      'An animal in calmed water ignores the current completely that round.',
    )
    if (rules.dam.exclusionsPerRound > 0) {
      lines.push('You may bar one animal a round from its shelter, so it only helps who you ' +
        'want it to help.')
    }
    lines.push(
      'It stays until somebody destroys it. When it goes, anything just downstream is ' +
        `swept ${rules.dam.sweepDistance} squares.`,
    )
    if (rules.dam.burstCurrent > 0) {
      lines.push(
        'And the water it was holding back bursts through: every square it was calming ' +
          `runs at ${rules.dam.burstCurrent} from then on, which is worse than it was ` +
          'before the dam went up.',
      )
    }
  }

  if (item === 'raft') {
    lines.push(
      `Moves one of your animals ${fx.raftDistance} ` +
        `${fx.raftDistance === 1 ? 'square' : 'squares'} straight toward the far bank.`,
      'It spends no movement points, so it is progress on top of your normal 3.',
      'Single use: the raft is gone once you use it.',
    )
  }

  if (item === 'rope') {
    lines.push(
      `Pulls one of your animals up to ${fx.ropeDistance} squares toward another of your ` +
        `animals, from as far as ${fx.ropeRange} squares away.`,
      'You say which way it sets off, across the river or up and down it, so the pull ' +
        'need not all be spent on the same line.',
      'The way out of a bad tile when you have no movement left, or a way to gather a group.',
      `Single use.${bannedFor(state, 'rope')}`,
    )
  }

  if (item === 'anchor') {
    const rounds = fx.anchorRounds
    lines.push(
      `The animal ignores the current entirely for ${rounds} ` +
        `${rounds === 1 ? 'round' : 'rounds'}, however strong it is.`,
    )
    const player = activePlayer(state)
    if (player && rules.factions[player.factionId].bonusAnimalUnprotected) {
      lines.push(
        'It will not stick to the animal carrying your extra square, though: that one is ' +
          'never out of the current.',
      )
    }
    lines.push(
      'The answer to sitting on a 4 you cannot get off, or to holding a good square.',
      `Single use.${bannedFor(state, 'anchor')}`,
    )
  }

  const equipment = rules.equipment[item]
  lines.push(
    equipment.purchaseUsesAction
      ? 'Building it uses your one action for the turn.'
      : 'Building it is free and does not use your action.',
  )
  lines.push(
    equipment.useUsesAction
      ? 'Using it later uses an action as well.'
      : 'Using it later is free, because buying it already cost you the action.',
  )
  return lines
}

function EquipmentInfo({
  state,
  item,
  onClose,
}: {
  state: GameState
  item: EquipmentId
  onClose: () => void
}) {
  const cost = state.rules.equipment[item].cost
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal small" onClick={(event) => event.stopPropagation()}>
        <header>
          <span className="kit-icon big" style={bg(equipmentArt(item))} />
          <h2 style={{ textTransform: 'capitalize' }}>{item}</h2>
          <span className="spacer" />
          <button className="btn ghost" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="body">
          <div className="row wrap" style={{ marginBottom: 10 }}>
            <span className="faint">Full price</span>
            {RESOURCE_IDS.filter((id) => cost[id] > 0).map((id) => (
              <span key={id} className={`res ${id}`}>
                <span className="swatch" style={bg(resourceArt(id))} />
                {cost[id]} {RESOURCE_LABELS[id]}
              </span>
            ))}
          </div>
          <ul className="rules-list">
            {equipmentInfo(state, item).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

/**
 * Spells out what a player is short of, rather than leaving a disabled button and a
 * tooltip saying only "not enough resources". Returns null when the cost is met.
 */
function shortfall(player: Player, cost: Record<ResourceId, number>): string | null {
  const missing = RESOURCE_IDS.filter((id) => player.resources[id] < cost[id]).map(
    (id) => `${cost[id] - player.resources[id]} more ${RESOURCE_LABELS[id].toLowerCase()}`,
  )
  return missing.length === 0 ? null : `Need ${missing.join(' and ')}`
}

function Shop({
  state,
  player,
  dispatch,
}: {
  state: GameState
  player: Player
  dispatch: (action: GameAction) => boolean
}) {
  const faction = state.rules.factions[player.factionId]
  const [info, setInfo] = useState<EquipmentId | null>(null)

  return (
    <div>
      {info && <EquipmentInfo state={state} item={info} onClose={() => setInfo(null)} />}
      {EQUIPMENT_IDS.filter((id) => state.rules.equipment[id].enabled).map((item) => {
        const cost = equipmentCost(state.rules, player.factionId, item)
        const forbidden = faction.forbiddenEquipment.includes(item)
        const affordable = canAfford(player, cost)
        const noAction = player.actionsRemaining <= 0
        const blocked = forbidden
          ? `${faction.name} cannot use ${item}s`
          : !affordable
            ? shortfall(player, cost)
            : noAction
              ? 'No action left this turn'
              : null
        return (
          <div
            key={item}
            className={`shop-item${!affordable || forbidden ? ' unaffordable' : ''}`}
          >
            <div className="info">
              <div className="label" style={{ textTransform: 'capitalize' }}>
                <span className="kit-icon" style={bg(equipmentArt(item))} />
                {item}
                {faction.buildDiscount > 0 && (
                  <span className="tag" style={{ marginLeft: 6 }}>
                    -{faction.buildDiscount}
                  </span>
                )}
                <button
                  className="info-btn"
                  onClick={() => setInfo(item)}
                  title={`What does ${article(item)} ${item} do?`}
                  aria-label={`What does ${article(item)} ${item} do?`}
                >
                  ?
                </button>
              </div>
              <div className="cost">
                {RESOURCE_IDS.filter((id) => cost[id] > 0).map((id) => (
                  <span key={id} className={`res ${id}`}>
                    <span className="swatch" style={bg(resourceArt(id))} />
                    {cost[id]}
                  </span>
                ))}
                {RESOURCE_IDS.every((id) => cost[id] === 0) && (
                  <span className="faint">free</span>
                )}
              </div>
              {blocked && <div className="blocked">{blocked}</div>}
            </div>
            <button
              className="btn small"
              disabled={forbidden || !affordable || noAction}
              title={blocked ?? `Build ${article(item)} ${item}`}
              onClick={() => dispatch({ type: 'buy-equipment', item: item as EquipmentId })}
            >
              Build
            </button>
          </div>
        )
      })}

      {state.rules.powerCards.enabled && (() => {
        const short = state.rules.powerCards.cost - totalResources(player)
        const blocked =
          state.powerDeck.length === 0
            ? 'The Power Card deck is empty'
            : short > 0
              ? `Need ${short} more resource${short === 1 ? '' : 's'}, any mix`
              : player.actionsRemaining <= 0
                ? 'No action left this turn'
                : null
        return (
          <div className={`shop-item${blocked ? ' unaffordable' : ''}`}>
            <div className="info">
              <div className="label">Power Card</div>
              <div className="cost">
                <span className="faint">
                  {state.rules.powerCards.cost} resources, any mix - drawn face down
                </span>
              </div>
              {blocked && <div className="blocked">{blocked}</div>}
            </div>
            <button
              className="btn small"
              disabled={blocked !== null}
              onClick={() => dispatch({ type: 'buy-power-card' })}
              title={blocked ?? `${state.powerDeck.length} cards left in the deck`}
            >
              Draw
            </button>
          </div>
        )
      })()}
    </div>
  )
}

////////////////////////////////////////////////////////////////////////////////////////////////

function DistractionControls({
  state,
  player,
  setTargeting,
}: {
  state: GameState
  player: Player
  setTargeting: (targeting: Targeting) => void
}) {
  const rules = state.rules.distraction
  if (!rules.enabled) return null

  const noAction = rules.playUsesAction && player.actionsRemaining <= 0
  const blocked = player.distractionTokens <= 0
    ? 'You have already used your Distraction token'
    : noAction
      ? 'No action left this turn'
      : null

  return (
    <>
      <div className="section-title">Distraction</div>
      <div className={`shop-item${blocked ? ' unaffordable' : ''}`}>
        <div className="info">
          <div className="label">
            Distraction token
            <span className="tag" style={{ marginLeft: 6 }}>
              {player.distractionTokens} left
            </span>
          </div>
          <div className="cost">
            <span className="faint">
              Drop it on a river tile. Every animal within {rules.radius} squares, yours
              included, rolls a d{rules.dieSides}: {rules.avoidOnRoll - 1} or less and it
              looks away. Ducks need a {rules.hardAvoidOnRoll}. You then drag each
              distracted animal up to {rules.pullDistance} squares toward the token.
            </span>
          </div>
          {blocked && <div className="blocked">{blocked}</div>}
        </div>
        <button
          className="btn small"
          disabled={blocked !== null}
          title={blocked ?? 'Choose a river tile to drop it on'}
          onClick={() => setTargeting({ kind: 'distraction' })}
        >
          Play
        </button>
      </div>
    </>
  )
}

////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * The panel that appears once a Distraction token has landed and its dice have been rolled.
 * Every caught animal gets its own slider, because dragging an opponent is usually worth the
 * full distance while dragging your own animal rarely is, and the rule is "up to".
 */
export function DistractionResolution({
  state,
  dispatch,
}: {
  state: GameState
  dispatch: (action: GameAction) => boolean
}) {
  const pending = state.pendingDistraction
  const max = state.rules.distraction.pullDistance
  const [moves, setMoves] = useState<Record<string, number>>({})

  if (!pending) return null
  const placer = state.players.find((p) => p.id === pending.placerId)
  if (!placer || placer.controller !== 'human') return null

  const caught = pending.rolls.filter((roll) => roll.distracted)
  const missed = pending.rolls.length - caught.length
  const distanceFor = (animalId: string) => moves[animalId] ?? max

  // Everything is being dragged toward one square, and only four animals fit on a square.
  // Counted here as well as refused in the engine, so the player can see it coming rather
  // than press the button and be told no.
  const chosen = caught.map((roll) => ({
    animalId: roll.animalId,
    distance: distanceFor(roll.animalId),
  }))
  const cap = state.rules.board.maxAnimalsPerTile
  const landing = distractionLanding(state, pending, chosen)
  const overfull = landing.arriving > landing.room

  return (
    <div className="panel">
      <header>Distraction at {coord(pending.col, pending.row)}</header>
      <div className="body">
        <div className="hint" style={{ marginBottom: 10 }}>
          {pending.rolls.length} {pending.rolls.length === 1 ? 'animal' : 'animals'} were in
          range. {caught.length} looked away and {missed} did not. Choose how far to draw each
          distracted animal toward the token - up to {max} squares, or leave it where it is.
        </div>

        {caught.length === 0 && (
          <div className="faint" style={{ marginBottom: 10 }}>
            Nobody was caught. The token is spent either way.
          </div>
        )}

        {overfull && (
          <div className="error" style={{ marginBottom: 10 }}>
            <span style={{ flex: 1 }}>
              Only {cap} animals fit on {coord(pending.col, pending.row)} and{' '}
              {landing.standing} {landing.standing === 1 ? 'is' : 'are'} there already, so{' '}
              {landing.room} more can come in. Draw{' '}
              {landing.arriving - landing.room} of them in fewer squares.
            </span>
          </div>
        )}

        {caught.map((roll) => {
          const animal = state.animals.find((a) => a.id === roll.animalId)
          const owner = state.players.find((p) => p.id === roll.playerId)
          const mine = roll.playerId === placer.id
          if (!animal) return null
          return (
            <div key={roll.animalId} className="shop-item">
              <div className="info">
                <div className="label">
                  <span
                    className={`pip ${roll.factionId}`}
                    style={bg(factionArt(roll.factionId))}
                  />
                  {owner?.name ?? roll.factionId} at {coord(animal.col, animal.row)}
                  {mine && <span className="tag" style={{ marginLeft: 6 }}>yours</span>}
                </div>
                <div className="cost">
                  <span className="faint">
                    Rolled {roll.roll}, needed {roll.neededRoll}
                  </span>
                </div>
              </div>
              <div className="row">
                {Array.from({ length: max + 1 }, (_, n) => (
                  <button
                    key={n}
                    className={`btn tiny${distanceFor(roll.animalId) === n ? ' primary' : ''}`}
                    onClick={() => setMoves({ ...moves, [roll.animalId]: n })}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )
        })}

        <button
          className="btn primary"
          style={{ width: '100%', marginTop: 12 }}
          disabled={overfull}
          onClick={() => {
            dispatch({ type: 'resolve-distraction', moves: chosen })
            setMoves({})
          }}
        >
          {caught.length === 0 ? 'Carry on' : 'Draw them in'}
        </button>
      </div>
    </div>
  )
}

////////////////////////////////////////////////////////////////////////////////////////////////

function DamControls({
  state,
  player,
  dispatch,
}: {
  state: GameState
  player: Player
  dispatch: (action: GameAction) => boolean
}) {
  if (state.dams.length === 0) return null

  return (
    <>
      <div className="section-title">Dams on the board</div>
      {state.dams.map((dam) => {
        const owner = state.players.find((p) => p.id === dam.ownerPlayerId)
        const cost = state.rules.dam.destroyCost
        const affordable = canAfford(player, cost)
        const blocked = !affordable
          ? shortfall(player, cost)
          : player.actionsRemaining <= 0
            ? 'No action left this turn'
            : null
        return (
          <div key={dam.id} className={`shop-item${blocked ? ' unaffordable' : ''}`}>
            <div className="info">
              <div className="label">
                {coord(dam.col, dam.row)} - {owner?.name ?? 'unknown'}
              </div>
              <div className="cost">
                {RESOURCE_IDS.filter((id) => cost[id] > 0).map((id) => (
                  <span key={id} className={`res ${id}`}>
                    <span className="swatch" style={bg(resourceArt(id))} />
                    {cost[id]}
                  </span>
                ))}
                <span className="faint">to destroy</span>
              </div>
              {blocked && <div className="blocked">{blocked}</div>}
            </div>
            <button
              className="btn small danger"
              disabled={!affordable || player.actionsRemaining <= 0}
              title={blocked ?? 'Destroy this dam'}
              onClick={() => dispatch({ type: 'destroy-dam', damId: dam.id })}
            >
              Destroy
            </button>
          </div>
        )
      })}
    </>
  )
}

////////////////////////////////////////////////////////////////////////////////////////////////

export function Hand({
  state,
  player,
  setTargeting,
  windowLabel,
}: {
  state: GameState
  player: Player
  setTargeting: (targeting: Targeting) => void
  windowLabel: 'turn' | 'before-current'
}) {
  if (player.hand.length === 0) {
    return <div className="faint">No Power Cards in hand.</div>
  }

  const limitReached =
    player.powerCardsPlayedThisRound >= cardPlaysAllowed(state.rules, player.factionId)

  return (
    <>
      {limitReached && (
        <div className="faint" style={{ marginBottom: 6 }}>
          Already played a Power Card this round.
        </div>
      )}
      <div className="card-grid">
        {player.hand.map((held) => {
          const card = cardById(state, held.cardId)
          if (!card) return null
          const inWindow =
            windowLabel === 'turn' ? card.timing === 'turn' : card.timing !== 'turn'
          const playable = inWindow && !limitReached
          return (
            <div key={held.instanceId} className={`pcard${playable ? ' playable' : ''}`}>
              <div className="title">{card.name}</div>
              <div className="text">{card.text}</div>
              <span className={`timing timing-${card.timing}`}>
                {card.timing === 'turn'
                  ? 'During your turn'
                  : card.timing === 'before-current'
                    ? 'Before the Current Phase'
                    : 'When a whirlpool resolves'}
              </span>
              <button
                className="btn small"
                style={{ marginTop: 6, width: '100%' }}
                disabled={!playable}
                onClick={() => setTargeting(startCardTargeting(held.instanceId, card.id))}
              >
                Play
              </button>
            </div>
          )
        })}
      </div>
    </>
  )
}

////////////////////////////////////////////////////////////////////////////////////////////////

/** The picks that cannot be made on the board: directions and resource choices. */
/**
 * The rope's last question. It reaches six squares and pulls two, so it usually stops well
 * short of the animal at the other end: whether its squares are spent across the river or
 * along it changes where the animal actually ends up, and that is the player's call rather
 * than something the engine should decide quietly.
 */
function RopeAxisPicks({
  animalId,
  towardAnimalId,
  dispatch,
  setTargeting,
}: {
  animalId: string
  towardAnimalId: string
  dispatch: (action: GameAction) => boolean
  setTargeting: (targeting: Targeting) => void
}) {
  const pull = (axis: RopeAxis) => {
    if (dispatch({ type: 'use-rope', animalId, towardAnimalId, axis })) setTargeting(null)
  }
  return (
    <div className="row wrap" style={{ marginTop: 8 }}>
      <button className="btn tiny primary" onClick={() => pull('across')}>
        Across the river first
      </button>
      <button className="btn tiny" onClick={() => pull('along')}>
        Up or down it first
      </button>
    </div>
  )
}

function DirectionAndResourcePicks({
  targeting,
  setTargeting,
}: {
  targeting: Extract<Targeting, { kind: 'card' }>
  setTargeting: (targeting: Targeting) => void
}) {
  const pick = targeting.picks[targeting.step]

  if (
    pick === 'direction-sideways' ||
    pick === 'direction-forward-back' ||
    pick === 'direction-any'
  ) {
    const options: Array<'left' | 'right' | 'forward' | 'backward'> =
      pick === 'direction-sideways'
        ? ['left', 'right']
        : pick === 'direction-forward-back'
          ? ['forward', 'backward']
          : ['left', 'right', 'forward', 'backward']
    return (
      <div className="row wrap" style={{ marginTop: 6 }}>
        {options.map((direction) => (
          <button
            key={direction}
            className="btn small"
            onClick={() =>
              setTargeting({
                ...targeting,
                step: targeting.step + 1,
                target: { ...targeting.target, direction },
              })
            }
          >
            {direction}
          </button>
        ))}
      </div>
    )
  }

  if (pick === 'two-resources') {
    const chosen = targeting.target.resources ?? []
    return (
      <div className="row wrap" style={{ marginTop: 6 }}>
        {RESOURCE_IDS.map((id: ResourceId) => {
          const already = chosen.includes(id)
          return (
            <button
              key={id}
              className={`btn small${already ? ' primary' : ''}`}
              disabled={already}
              onClick={() => {
                const next = [...chosen, id]
                setTargeting({
                  ...targeting,
                  step: next.length >= 2 ? targeting.step + 1 : targeting.step,
                  target: { ...targeting.target, resources: next },
                })
              }}
            >
              {RESOURCE_LABELS[id]}
            </button>
          )
        })}
      </div>
    )
  }

  return null
}
