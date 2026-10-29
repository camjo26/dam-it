////////////////////////////////////////////////////////////////////////////////////////////////
// The active player's controls: collectors in the Resource Phase, then movement, the one
// action, equipment, Power Cards and ending the turn.
////////////////////////////////////////////////////////////////////////////////////////////////

import { cardById } from '../game/cards'
import { assessCurrent } from '../game/current'
import { activePlayer, canAfford, equipmentCost, totalResources } from '../game/engine'
import type { GameAction } from '../game/engine'
import { coord, describeTile } from '../game/movement'
import { COLLECTOR_AREAS } from '../game/rules'
import type { Animal, EquipmentId, GameState, Player, ResourceId } from '../game/types'
import { EQUIPMENT_IDS, RESOURCE_IDS, RESOURCE_LABELS } from '../game/types'
import { bg, equipmentArt, resourceArt } from './art'
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
  const waiting = state.players.filter(
    (p) => p.collectorArea === null && p.controller === 'human',
  )
  const next = waiting[0]

  return (
    <div className="panel">
      <header>Phase A - Collectors</header>
      <div className="body">
        <div className="hint" style={{ marginBottom: 10 }}>
          Put each collector in a resource area. A production card is then turned over and says
          what every area produces this round. Nobody sees the card before choosing.
        </div>

        {state.players.map((player) => (
          <div key={player.id} className="row" style={{ marginBottom: 6 }}>
            <span style={{ width: 76, fontSize: 13 }}>{player.name}</span>
            {player.collectorArea ? (
              <span className={`res ${player.collectorArea}`}>
                <span className="swatch" style={bg(resourceArt(player.collectorArea))} />
                {RESOURCE_LABELS[player.collectorArea]}
              </span>
            ) : player.controller === 'ai' ? (
              <span className="faint">choosing...</span>
            ) : (
              <span className="faint">waiting</span>
            )}
          </div>
        ))}

        {next && (
          <>
            <div className="section-title" style={{ marginTop: 14 }}>
              {next.name}, choose an area
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
    (a) => a.playerId === player.id && a.status !== 'finished',
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

      {animal.distracted && (
        <div className="error" style={{ marginTop: 6 }}>
          Distracted this turn and cannot move.
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

  return (
    <div>
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
              title={blocked ?? `Build a ${item}`}
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
    player.powerCardsPlayedThisRound >= state.rules.powerCards.playsPerPlayerPerRound

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
function DirectionAndResourcePicks({
  targeting,
  setTargeting,
}: {
  targeting: Extract<Targeting, { kind: 'card' }>
  setTargeting: (targeting: Targeting) => void
}) {
  const pick = targeting.picks[targeting.step]

  if (pick === 'direction-sideways' || pick === 'direction-forward-back') {
    const options: Array<'left' | 'right' | 'forward' | 'backward'> =
      pick === 'direction-sideways' ? ['left', 'right'] : ['forward', 'backward']
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
