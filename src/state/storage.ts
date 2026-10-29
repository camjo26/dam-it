////////////////////////////////////////////////////////////////////////////////////////////////
// Saving and loading. Deliberately forgiving: a save that cannot be read is reported and
// ignored rather than thrown away silently or allowed to crash the app on start-up.
////////////////////////////////////////////////////////////////////////////////////////////////

import { defaultRules, type GameRules } from '../game/rules'
import type { GameState } from '../game/types'

const GAME_KEY = 'dam-it.game'
const RULES_KEY = 'dam-it.rules'
const SAVE_VERSION = 1

interface SaveEnvelope<T> {
  version: number
  savedAt: string
  payload: T
}

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const envelope = JSON.parse(raw) as SaveEnvelope<T>
    if (envelope.version !== SAVE_VERSION) return null
    return envelope.payload
  } catch (error) {
    console.warn(`Could not read ${key} from local storage:`, error)
    return null
  }
}

function write<T>(key: string, payload: T): boolean {
  try {
    const envelope: SaveEnvelope<T> = {
      version: SAVE_VERSION,
      savedAt: new Date().toISOString(),
      payload,
    }
    window.localStorage.setItem(key, JSON.stringify(envelope))
    return true
  } catch (error) {
    console.warn(`Could not save ${key} to local storage:`, error)
    return false
  }
}

export function saveGame(state: GameState): boolean {
  // The undo history is working memory, not progress, and it is by far the largest field.
  return write(GAME_KEY, { ...state, undoStack: [] })
}

export function loadGame(): GameState | null {
  const state = read<GameState>(GAME_KEY)
  if (!state) return null
  // A save from an older build may be missing newer fields, so fill in what is needed.
  if (!Array.isArray(state.undoStack)) state.undoStack = []
  if (!Array.isArray(state.pendingWhirlpoolRerolls)) state.pendingWhirlpoolRerolls = []
  if (!state.saboteurUsesThisRound) state.saboteurUsesThisRound = {}
  if (!state.rules) return null
  return state
}

export function clearGame(): void {
  try {
    window.localStorage.removeItem(GAME_KEY)
  } catch (error) {
    console.warn('Could not clear the saved game:', error)
  }
}

export function saveRules(rules: GameRules): boolean {
  return write(RULES_KEY, rules)
}

export function loadRules(): GameRules {
  const stored = read<GameRules>(RULES_KEY)
  if (!stored) return defaultRules()
  // Merge over the defaults so a rules file from an older build still loads.
  return { ...defaultRules(), ...stored }
}

export function clearRules(): void {
  try {
    window.localStorage.removeItem(RULES_KEY)
  } catch (error) {
    console.warn('Could not clear the saved rules:', error)
  }
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  triggerDownload(filename, blob)
}

export function downloadText(filename: string, text: string, mime = 'text/plain'): void {
  triggerDownload(filename, new Blob([text], { type: mime }))
}

function triggerDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
