////////////////////////////////////////////////////////////////////////////////////////////////
// Phase C: the window before the current is resolved, and the report afterwards that says
// exactly which animal moved and why.
////////////////////////////////////////////////////////////////////////////////////////////////

import { useEffect, useState } from 'react'

import { assessCurrent } from '../game/current'
import type { GameAction } from '../game/engine'
import { coord } from '../game/movement'
import { CURRENT_ORDER_LABELS } from '../game/rules'
import { saboteurUsesLeft } from '../game/roles'
import type { CurrentStep, GameState } from '../game/types'
import { Hand } from './TurnPanel'
import type { Targeting } from './targeting'

export interface CurrentPhasePanelProps {
  state: GameState
  dispatch: (action: GameAction) => boolean
  setTargeting: (targeting: Targeting) => void
}

export function CurrentPhasePanel({ state, dispatch, setTargeting }: CurrentPhasePanelProps) {
  const humans = state.players.filter((p) => p.controller === 'human')
  const [seat, setSeat] = useState(humans[0]?.id ?? '')
  const player = state.players.find((p) => p.id === seat) ?? humans[0]

  const inWater = state.animals.filter((a) => a.status === 'river')

  return (
    <div className="panel">
      <header>Phase C - The Current</header>
      <div className="body">
        <div className="hint" style={{ marginBottom: 10 }}>
          Every player has acted. Cards that are played <b>before the Current Phase</b> can be
          played now. When everyone is ready, resolve the current.
        </div>

        <div className="faint" style={{ marginBottom: 10 }}>
          {inWater.length} animals are in the water. Resolution order:{' '}
          <b style={{ color: 'var(--text)' }}>
            {CURRENT_ORDER_LABELS[state.rules.current.resolutionOrder]}
          </b>
        </div>

        {humans.length > 1 && (
          <div className="row wrap" style={{ marginBottom: 8 }}>
            {humans.map((p) => (
              <button
                key={p.id}
                className={`btn small${p.id === player?.id ? ' primary' : ''}`}
                onClick={() => setSeat(p.id)}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}

        {player && (
          <>
            <div className="section-title">{player.name}&apos;s cards for this window</div>
            <Hand
              state={state}
              player={player}
              setTargeting={setTargeting}
              windowLabel="before-current"
            />

            {saboteurUsesLeft(state, player) > 0 && (
              <button
                className="btn small"
                style={{ marginTop: 8 }}
                onClick={() => setTargeting({ kind: 'saboteur' })}
              >
                Use your secret ability ({saboteurUsesLeft(state, player)} left)
              </button>
            )}
          </>
        )}

        <div className="section-title">What the current will do</div>
        <div className="scroll-y" style={{ maxHeight: 180 }}>
          {inWater.length === 0 && <div className="faint">Nothing is in the water.</div>}
          {inWater.map((animal) => {
            const assessment = assessCurrent(state, animal)
            const owner = state.players.find((p) => p.id === animal.playerId)
            return (
              <div key={animal.id} className="row" style={{ fontSize: 12, padding: '3px 0' }}>
                <span className={`pip ${animal.factionId}`} />
                <span style={{ width: 34 }}>{coord(animal.col, animal.row)}</span>
                <span className="faint" style={{ flex: 1 }}>
                  {owner?.name}:{' '}
                  {assessment.effectiveStrength === 0
                    ? 'holds position'
                    : `${assessment.effectiveStrength} ${assessment.direction}`}
                </span>
              </div>
            )
          })}
        </div>

        <button
          className="btn good"
          style={{ width: '100%', marginTop: 12 }}
          disabled={state.currentResolvedForRound === state.round}
          onClick={() => {
            setTargeting(null)
            dispatch({ type: 'resolve-current' })
          }}
        >
          Resolve the Current Phase
        </button>
      </div>
    </div>
  )
}

////////////////////////////////////////////////////////////////////////////////////////////////

export interface CurrentReportProps {
  state: GameState
  steps: CurrentStep[]
  round: number
  autoReport: boolean
  onAutoReportChange: (value: boolean) => void
  onClose: () => void
}

/** Steps through what the current did, one animal at a time, with the reason for each. */
export function CurrentReport({
  state,
  steps,
  round,
  autoReport,
  onAutoReportChange,
  onClose,
}: CurrentReportProps) {
  const [cursor, setCursor] = useState(0)

  useEffect(() => {
    setCursor(0)
  }, [steps])

  const moved = steps.filter((s) => s.from.col !== s.to.col || s.from.row !== s.to.row)
  const finished = steps.filter((s) => s.finished)
  const shown = steps.slice(0, cursor + 1)
  const atEnd = cursor >= steps.length - 1

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <header>
          <h2>Current Phase - round {round}</h2>
          <span className="spacer" />
          <span className="chip">
            <strong>{moved.length}</strong> moved
          </span>
          <span className="chip">
            <strong>{finished.length}</strong> reached the far bank
          </span>
          <button className="btn ghost" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="body">
          {steps.length === 0 && (
            <div className="hint">Nothing was in the water, so the current did nothing.</div>
          )}

          <div className="scroll-y">
            {shown.map((step, index) => {
              const owner = state.players.find((p) => {
                const animal = state.animals.find((a) => a.id === step.animalId)
                return animal ? p.id === animal.playerId : false
              })
              const didMove = step.from.col !== step.to.col || step.from.row !== step.to.row
              return (
                <div
                  key={step.animalId}
                  className={`step${index === cursor ? ' current-step' : ''}`}
                >
                  <div className="head">
                    <span className={`pip ${step.factionId}`} style={{ marginRight: 6 }} />
                    {owner?.name ?? step.factionId}:{' '}
                    {didMove
                      ? `${coord(step.from.col, step.from.row)} to ` +
                        `${coord(step.to.col, step.to.row)}`
                      : `held at ${coord(step.from.col, step.from.row)}`}
                    {step.finished && ' - scored'}
                    {step.whirlpool && ` - whirlpool rolled ${step.whirlpool.direction}`}
                  </div>
                  <div className="why">{step.reason}</div>
                </div>
              )
            })}
          </div>
        </div>

        <footer>
          <button
            className="btn"
            disabled={cursor === 0}
            onClick={() => setCursor((c) => Math.max(0, c - 1))}
          >
            Back
          </button>
          <button
            className="btn primary"
            disabled={atEnd}
            onClick={() => setCursor((c) => Math.min(steps.length - 1, c + 1))}
          >
            Next animal
          </button>
          <button
            className="btn"
            disabled={atEnd}
            onClick={() => setCursor(Math.max(0, steps.length - 1))}
          >
            Show all
          </button>
          <label className="row faint" style={{ gap: 5, marginLeft: 10 }}>
            <input
              type="checkbox"
              checked={autoReport}
              onChange={(event) => onAutoReportChange(event.target.checked)}
            />
            Show this every round
          </label>
          <span className="spacer" style={{ flex: 1 }} />
          <button className="btn good" onClick={onClose}>
            {round >= state.rules.game.rounds
              ? 'See the final score'
              : `Continue to round ${round + 1}`}
          </button>
        </footer>
      </div>
    </div>
  )
}
