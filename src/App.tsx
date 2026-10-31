////////////////////////////////////////////////////////////////////////////////////////////////
// Top level: the setup screen, the game screen and the modals.
//
// All board clicks arrive here, where they are routed either to movement or to whatever is
// currently being aimed: a dam, a rope, a card or the Saboteur's ability.
////////////////////////////////////////////////////////////////////////////////////////////////

import { useEffect, useMemo, useState } from 'react'

import { activePlayer } from './game/engine'
import { isInPlay, legalDestinations } from './game/movement'
import type { GameRules } from './game/rules'
import type { PlayerSetup } from './game/setup'
import type { Animal, AiDifficulty, CurrentStep, GameState, Tile } from './game/types'
import { loadRules, saveRules } from './state/storage'
import { useGame } from './state/useGame'
import { Board } from './ui/Board'
import { CurrentPhasePanel, CurrentReport } from './ui/CurrentPhase'
import { Diagnostics } from './ui/Diagnostics'
import { FactionPanels } from './ui/FactionPanels'
import { LogPanel } from './ui/LogPanel'
import { ProductionCard } from './ui/ProductionCard'
import { RulesEditor } from './ui/RulesEditor'
import { RulesReference } from './ui/RulesReference'
import { ScoreScreen } from './ui/ScoreScreen'
import { SetupScreen } from './ui/SetupScreen'
import { TradeReply } from './ui/TradePanel'
import { DistractionResolution, TurnPanel } from './ui/TurnPanel'
import { targetingComplete, type Targeting } from './ui/targeting'
import { VERSION } from './version'

type Modal = 'none' | 'rules' | 'reference' | 'diagnostics' | 'score' | 'current-report'

const AUTO_REPORT_KEY = 'dam-it.autoReport'

const PHASE_LABELS: Record<GameState['phase'], string> = {
  setup: 'Setting up',
  resource: 'A - Resources',
  'player-turns': 'B - Player turns',
  current: 'C - The current',
  finished: 'Finished',
}

export default function App() {
  const game = useGame()
  const [rules, setRules] = useState<GameRules>(() => loadRules())
  const [modal, setModal] = useState<Modal>('none')
  const [showSetup, setShowSetup] = useState(() => game.state === null)
  const [selectedAnimalId, setSelectedAnimalId] = useState<string | null>(null)
  const [targeting, setTargeting] = useState<Targeting>(null)
  const [report, setReport] = useState<{ steps: CurrentStep[]; round: number } | null>(null)
  const [lastReported, setLastReported] = useState<number | null>(null)
  const [autoReport, setAutoReport] = useState(() => {
    try {
      return window.localStorage.getItem(AUTO_REPORT_KEY) !== 'off'
    } catch {
      return true
    }
  })
  const [lastSetup, setLastSetup] = useState<{
    players: PlayerSetup[]
    difficulty: AiDifficulty
  } | null>(null)

  const state = game.state

  // Show the Current Phase report once, as soon as a round's current has been resolved.
  useEffect(() => {
    if (!state) return
    const resolved = state.currentResolvedForRound
    if (resolved === null || resolved === lastReported) return
    setLastReported(resolved)
    if (state.currentSteps.length === 0) return
    setReport({ steps: state.currentSteps, round: resolved })
    // A phase where nothing actually moved is not worth interrupting for.
    const somethingHappened = state.currentSteps.some(
      (step) => step.from.col !== step.to.col || step.from.row !== step.to.row || step.finished,
    )
    if (autoReport && somethingHappened) setModal('current-report')
  }, [state, lastReported, autoReport])

  // Reveal the final score as soon as the game ends.
  useEffect(() => {
    if (state?.phase === 'finished' && modal === 'none') setModal('score')
  }, [state?.phase, modal])

  // A selected animal that has crossed, or belongs to somebody else now, is cleared.
  useEffect(() => {
    if (!state || !selectedAnimalId) return
    const animal = state.animals.find((a) => a.id === selectedAnimalId)
    const active = activePlayer(state)
    if (!animal || !isInPlay(animal) || animal.playerId !== active?.id) {
      setSelectedAnimalId(null)
    }
  }, [state, selectedAnimalId])

  const selectedAnimal = useMemo(
    () => state?.animals.find((a) => a.id === selectedAnimalId) ?? null,
    [state, selectedAnimalId],
  )

  const legal = useMemo(() => {
    if (!state || !selectedAnimal || targeting) return []
    if (state.phase !== 'player-turns') return []
    const active = activePlayer(state)
    if (!active || active.controller !== 'human') return []
    return legalDestinations(state, selectedAnimal)
  }, [state, selectedAnimal, targeting])

  const targetable = useMemo(() => {
    if (!state || !targeting) return []
    if (
      targeting.kind === 'place-dam' ||
      targeting.kind === 'saboteur' ||
      targeting.kind === 'distraction'
    ) {
      return state.board.tiles
        .filter((t) => t.kind !== 'bank-top' && t.kind !== 'bank-bottom')
        .map((t) => t.id)
    }
    if (targeting.kind === 'card') {
      const pick = targeting.picks[targeting.step]
      if (pick === 'tile' || pick === 'second-tile') {
        return state.board.tiles
          .filter((t) => t.kind !== 'bank-top' && t.kind !== 'bank-bottom')
          .map((t) => t.id)
      }
      if (pick === 'adjacent-island') {
        const animal = state.animals.find((a) => a.id === targeting.target.animalId)
        if (!animal) return []
        // Next to means one square along a row or a column, never diagonally.
        return state.board.tiles
          .filter(
            (t) =>
              t.kind === 'island' &&
              Math.abs(t.col - animal.col) + Math.abs(t.row - animal.row) === 1,
          )
          .map((t) => t.id)
      }
    }
    return []
  }, [state, targeting])

  // Play a card as soon as every pick has been made.
  useEffect(() => {
    if (!state || !targeting || targeting.kind !== 'card') return
    if (!targetingComplete(targeting)) return
    const active = activePlayer(state)
    const owner =
      state.phase === 'current'
        ? state.players.find((p) => p.hand.some((c) => c.instanceId === targeting.instanceId))
        : active
    if (!owner) {
      setTargeting(null)
      return
    }
    game.dispatch({
      type: 'play-power-card',
      playerId: owner.id,
      instanceId: targeting.instanceId,
      target: targeting.target,
    })
    setTargeting(null)
  }, [state, targeting, game])

  if (!state || showSetup) {
    return (
      <>
        <SetupScreen
          rules={rules}
          hasSavedGame={state !== null}
          onResume={() => setShowSetup(false)}
          onStart={(seed, players, difficulty) => {
            const next = { ...rules, ai: { ...rules.ai, difficulty } }
            setRules(next)
            saveRules(next)
            setLastSetup({ players, difficulty })
            setLastReported(null)
            game.newGame(next, seed, players)
            setShowSetup(false)
            setModal('none')
          }}
          onOpenRules={() => setModal('rules')}
          onOpenReference={() => setModal('reference')}
        />
        {modal === 'rules' && (
          <RulesEditor
            rules={rules}
            gameInProgress={false}
            onApply={(next) => {
              setRules(next)
              saveRules(next)
              setModal('none')
            }}
            onClose={() => setModal('none')}
            onStartNewGame={(next) => {
              setRules(next)
              saveRules(next)
              setModal('none')
            }}
          />
        )}
        {modal === 'reference' && (
          <RulesReference rules={rules} onClose={() => setModal('none')} />
        )}
      </>
    )
  }

  const active = activePlayer(state)
  const humanTurn =
    state.phase === 'player-turns' && active?.controller === 'human'

  const onTileClick = (tile: Tile) => {
    if (!targeting) {
      if (!humanTurn || !selectedAnimal) return
      const isLegal = legal.some((l) => l.col === tile.col && l.row === tile.row)
      if (!isLegal) return
      game.dispatch({
        type: 'move-animal',
        animalId: selectedAnimal.id,
        col: tile.col,
        row: tile.row,
      })
      return
    }

    if (targeting.kind === 'place-dam') {
      if (game.dispatch({ type: 'place-dam', col: tile.col, row: tile.row })) {
        setTargeting(null)
      }
      return
    }

    if (targeting.kind === 'distraction') {
      if (game.dispatch({ type: 'play-distraction', col: tile.col, row: tile.row })) {
        setTargeting(null)
      }
      return
    }

    if (targeting.kind === 'saboteur') {
      const saboteur = state.players.find((p) => p.roleId === 'saboteur')
      if (saboteur && game.dispatch({
        type: 'saboteur-surge',
        playerId: saboteur.id,
        tileId: tile.id,
      })) {
        setTargeting(null)
      }
      return
    }

    if (targeting.kind === 'card') {
      const pick = targeting.picks[targeting.step]
      if (pick === 'tile' || pick === 'adjacent-island') {
        setTargeting({
          ...targeting,
          step: targeting.step + 1,
          target: { ...targeting.target, tileId: tile.id },
        })
      } else if (pick === 'second-tile') {
        setTargeting({
          ...targeting,
          step: targeting.step + 1,
          target: { ...targeting.target, secondTileId: tile.id },
        })
      }
    }
  }

  const onAnimalClick = (animal: Animal) => {
    if (targeting?.kind === 'rope') {
      if (targeting.animalId === null) {
        setTargeting({ kind: 'rope', animalId: animal.id })
        return
      }
      if (game.dispatch({
        type: 'use-rope',
        animalId: targeting.animalId,
        towardAnimalId: animal.id,
      })) {
        setTargeting(null)
      }
      return
    }

    if (targeting?.kind === 'card') {
      const pick = targeting.picks[targeting.step]
      if (pick === 'own-animal' || pick === 'enemy-animal' || pick === 'any-animal') {
        setTargeting({
          ...targeting,
          step: targeting.step + 1,
          target: { ...targeting.target, animalId: animal.id },
        })
      } else if (pick === 'second-own-animal') {
        setTargeting({
          ...targeting,
          step: targeting.step + 1,
          target: { ...targeting.target, secondAnimalId: animal.id },
        })
      }
      return
    }

    if (!humanTurn) return
    if (animal.playerId !== active?.id) return
    setSelectedAnimalId(animal.id === selectedAnimalId ? null : animal.id)
  }

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          DAM IT
          <small>River crossing playtest</small>
        </div>

        <div className="phase-chips">
          <span className="chip">
            Round <strong>{state.round}</strong> of {state.rules.game.rounds}
          </span>
          <span className="chip active">{PHASE_LABELS[state.phase]}</span>
          {active && state.phase === 'player-turns' && (
            <span className="chip active">
              <strong>{active.name}</strong>
              {active.controller === 'ai' ? ' (AI)' : ''}
            </span>
          )}
          <span className="chip">
            seed <strong>{state.rng.seed}</strong>
          </span>
          {game.busy && <span className="chip">working...</span>}
        </div>

        <span className="spacer" />

        {report && (
          <button className="btn small" onClick={() => setModal('current-report')}>
            Last current
          </button>
        )}
        <button className="btn small" onClick={() => setModal('diagnostics')}>
          Diagnostics
        </button>
        <button className="btn small" onClick={() => setModal('rules')}>
          Rules editor
        </button>
        <button className="btn small" onClick={() => setModal('reference')}>
          How to play
        </button>
        {state.phase === 'finished' && (
          <button className="btn small good" onClick={() => setModal('score')}>
            Final score
          </button>
        )}
        <button
          className="btn small danger"
          onClick={() => {
            const ok = window.confirm(
              'Abandon this game and go back to the setup screen? The game in progress will ' +
                'be lost.',
            )
            if (ok) {
              game.abandon()
              setShowSetup(true)
              setModal('none')
            }
          }}
        >
          Abandon
        </button>
      </div>

      {game.error && (
        <div style={{ padding: '0 12px', marginTop: 10 }}>
          <div className="error">
            <span style={{ flex: 1 }}>{game.error}</span>
            <button className="btn tiny ghost" onClick={game.clearError}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="layout">
        <div className="column">
          <FactionPanels state={state} />
        </div>

        <div className="column">
          <Board
            state={state}
            selectedAnimalId={selectedAnimalId}
            legal={legal}
            targetable={targetable}
            onTileClick={onTileClick}
            onAnimalClick={onAnimalClick}
            revealAllCurrents={state.phase === 'finished'}
          />
          <LogPanel state={state} />
        </div>

        <div className="column">
          <TradeReply state={state} dispatch={game.dispatch} />
          <DistractionResolution state={state} dispatch={game.dispatch} />
          <ProductionCard state={state} />
          <TurnPanel
            state={state}
            dispatch={game.dispatch}
            selectedAnimalId={selectedAnimalId}
            setSelectedAnimalId={setSelectedAnimalId}
            targeting={targeting}
            setTargeting={setTargeting}
          />
          {state.phase === 'current' && (
            <CurrentPhasePanel
              state={state}
              dispatch={game.dispatch}
              setTargeting={setTargeting}
            />
          )}
          {state.phase === 'finished' && (
            <div className="panel">
              <header>Game over</header>
              <div className="body">
                <button
                  className="btn primary"
                  style={{ width: '100%' }}
                  onClick={() => setModal('score')}
                >
                  See the final score
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="faint" style={{ textAlign: 'center', padding: '6px 0 16px' }}>
        Dam It playtest build v{VERSION}
      </div>

      {modal === 'current-report' && report && (
        <CurrentReport
          state={state}
          steps={report.steps}
          round={report.round}
          autoReport={autoReport}
          onAutoReportChange={(value) => {
            setAutoReport(value)
            try {
              window.localStorage.setItem(AUTO_REPORT_KEY, value ? 'on' : 'off')
            } catch {
              // Not remembered; the setting still applies for this session.
            }
          }}
          onClose={() => setModal('none')}
        />
      )}

      {modal === 'score' && (
        <ScoreScreen
          state={state}
          onClose={() => setModal('none')}
          onNewGame={() => {
            game.abandon()
            setShowSetup(true)
            setModal('none')
          }}
          onReplaySameSeed={() => {
            if (!lastSetup) {
              setShowSetup(true)
              setModal('none')
              return
            }
            setLastReported(null)
            game.newGame(state.rules, state.rng.seed, lastSetup.players)
            setModal('none')
          }}
        />
      )}

      {modal === 'diagnostics' && (
        <Diagnostics state={state} onClose={() => setModal('none')} />
      )}

      {modal === 'rules' && (
        <RulesEditor
          rules={state.rules}
          gameInProgress
          onApply={(next) => {
            setRules(next)
            saveRules(next)
            game.applyRulesMidGame(next)
            setModal('none')
          }}
          onClose={() => setModal('none')}
          onStartNewGame={(next) => {
            setRules(next)
            saveRules(next)
            game.abandon()
            setShowSetup(true)
            setModal('none')
          }}
        />
      )}

      {modal === 'reference' && (
        <RulesReference rules={state.rules} onClose={() => setModal('none')} />
      )}
    </div>
  )
}
