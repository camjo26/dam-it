////////////////////////////////////////////////////////////////////////////////////////////////
// React binding for the engine.
//
// The hook owns one GameState, dispatches actions through applyAction, drives AI turns on a
// timer so they can be watched, and keeps the save in local storage up to date.
////////////////////////////////////////////////////////////////////////////////////////////////

import { useCallback, useEffect, useRef, useState } from 'react'

import { applyAction, type GameAction } from '../game/engine'
import { autoStep } from '../game/runner'
import type { GameRules } from '../game/rules'
import { createGame, type PlayerSetup } from '../game/setup'
import type { GameState } from '../game/types'
import { clearGame, loadGame, saveGame } from './storage'

export interface UseGame {
  state: GameState | null
  error: string | null
  busy: boolean
  dispatch: (action: GameAction) => boolean
  newGame: (rules: GameRules, seed: string, players: PlayerSetup[]) => void
  abandon: () => void
  clearError: () => void
  /** Replaces the rules of a game already in progress. */
  applyRulesMidGame: (rules: GameRules) => void
}

export function useGame(): UseGame {
  const [state, setState] = useState<GameState | null>(() => loadGame())
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const timer = useRef<number | null>(null)

  // Keep the save current, but never let a storage failure interrupt play.
  useEffect(() => {
    if (!state) return
    saveGame(state)
  }, [state])

  // Drive AI turns and automatic phase steps.
  useEffect(() => {
    if (!state || state.phase === 'finished') {
      setBusy(false)
      return
    }

    const next = autoStep(state)
    if (!next) {
      setBusy(false)
      return
    }

    setBusy(true)
    const delay = Math.max(0, state.rules.ai.stepDelayMs)
    timer.current = window.setTimeout(() => setState(next), delay)

    return () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current)
        timer.current = null
      }
    }
  }, [state])

  // The latest state, readable synchronously so dispatch can validate without a state updater.
  const latest = useRef(state)
  useEffect(() => {
    latest.current = state
  }, [state])

  const commit = useCallback((next: GameState | null) => {
    latest.current = next
    setState(next)
  }, [])

  const dispatch = useCallback(
    (action: GameAction): boolean => {
      const current = latest.current
      if (!current) return false
      const result = applyAction(current, action)
      if (!result.ok) {
        setError(result.error)
        return false
      }
      setError(null)
      commit(result.state)
      return true
    },
    [commit],
  )

  const newGame = useCallback(
    (rules: GameRules, seed: string, players: PlayerSetup[]) => {
      setError(null)
      commit(createGame({ rules, seed, players }))
    },
    [commit],
  )

  const abandon = useCallback(() => {
    clearGame()
    commit(null)
    setError(null)
  }, [commit])

  const applyRulesMidGame = useCallback(
    (rules: GameRules) => {
      const current = latest.current
      if (!current) return
      commit({ ...current, rules })
    },
    [commit],
  )

  const clearError = useCallback(() => setError(null), [])

  return { state, error, busy, dispatch, newGame, abandon, clearError, applyRulesMidGame }
}
