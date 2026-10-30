////////////////////////////////////////////////////////////////////////////////////////////////
// Saving and loading. Deliberately forgiving: a save that cannot be read is reported and
// ignored rather than thrown away silently or allowed to crash the app on start-up.
////////////////////////////////////////////////////////////////////////////////////////////////

import { defaultRules, type GameRules } from '../game/rules'
import type { GameState } from '../game/types'

const GAME_KEY = 'dam-it.game'
const RULES_KEY = 'dam-it.rules'

/**
 * Raised whenever the rules change in a way that is not simply additive, which discards
 * both the saved game and the saved rules rather than resuming half of one ruleset.
 *
 * 2: v0.03. Nearly every tile now flows and carries its own direction, collectors went from
 * one to two, the production deck was replaced and roles were parked. A v0.02 rules file
 * merged over these defaults would quietly keep the old river and the old deck, so a player
 * who had the app open would never see the change at all.
 */
const SAVE_VERSION = 2

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
  if (!state.rules) return null

  // A save from an older build may be missing newer fields, so fill in what is needed.
  if (!Array.isArray(state.undoStack)) state.undoStack = []
  if (!Array.isArray(state.pendingWhirlpoolRerolls)) state.pendingWhirlpoolRerolls = []
  if (!state.saboteurUsesThisRound) state.saboteurUsesThisRound = {}
  if (state.pendingDistraction === undefined) state.pendingDistraction = null

  // v0.03 gave every tile its own direction and replaced the single collector with two.
  // A game saved before that cannot be patched into a sensible shape - a board with no
  // directions would silently push everything the same way - so it is dropped instead of
  // resumed wrong. Only a game in progress is lost; the saved rules are untouched.
  const firstTile = state.board?.tiles?.[0]
  const incompatible =
    !firstTile ||
    firstTile.direction === undefined ||
    state.players.some((player) => !Array.isArray(player.collectors))
  if (incompatible) {
    console.info('Discarded a saved game from an older build of the rules.')
    clearGame()
    return null
  }

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

/**
 * Merges a stored rules object over the defaults, section by section.
 *
 * It has to recurse. A shallow spread replaces a whole section with the stored one, so a
 * rules file written before a field existed would hand back a `board` with no
 * `currentDirectionWeights` at all and the board builder would throw on the first new game.
 * Arrays are taken from the stored side whole, because an edited island list or production
 * deck is meant to replace the default rather than be blended into it.
 */
export function mergeRules<T>(defaults: T, stored: unknown): T {
  if (stored === null || stored === undefined) return defaults
  if (Array.isArray(defaults) || Array.isArray(stored)) return stored as T
  if (typeof defaults !== 'object' || typeof stored !== 'object') return stored as T

  const out: Record<string, unknown> = { ...(defaults as Record<string, unknown>) }
  for (const [key, value] of Object.entries(stored as Record<string, unknown>)) {
    const fallback = (defaults as Record<string, unknown>)[key]
    out[key] = fallback === undefined ? value : mergeRules(fallback, value)
  }
  return out as T
}

export function loadRules(): GameRules {
  const stored = read<GameRules>(RULES_KEY)
  if (!stored) return defaultRules()
  return mergeRules(defaultRules(), stored)
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
