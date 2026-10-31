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
  return write(GAME_KEY, {
    fingerprint: rulesFingerprint(),
    state: { ...state, undoStack: [] },
  })
}

export function loadGame(): GameState | null {
  const saved = read<{ fingerprint?: string; state?: GameState }>(GAME_KEY)
  if (!saved) return null

  // A game carries the rules it was started with, which is the point of it. That also means
  // a game in progress goes on being played under rules that no longer exist, which in a
  // build whose whole job is testing rule changes is worse than losing the game. So when the
  // defaults move, the game in progress goes with them.
  if (saved.fingerprint !== rulesFingerprint() || !saved.state) {
    console.info('The rules have changed since this game was saved, so it was not resumed.')
    clearGame()
    return null
  }

  const state = saved.state
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
  return write(RULES_KEY, { fingerprint: rulesFingerprint(), rules })
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

/**
 * A short fingerprint of the default rules.
 *
 * Saved rules are merged over the defaults, so a stored value always wins. That is right for
 * a setting Cam has deliberately tuned, and wrong for every default that has since changed
 * underneath it: a rules file written before the river swept animals off the board carried
 * `edgeBehaviour: 'stop-at-edge'` forward and quietly cancelled the new rule, along with the
 * dam axis and both card decks.
 *
 * Relying on remembering to bump a version number is what let that happen twice. This is
 * derived from the defaults themselves, so any change to them invalidates the saved file
 * automatically and the newest rules always win.
 */
export function rulesFingerprint(): string {
  const text = JSON.stringify(defaultRules())
  let h = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}

interface StoredRules {
  fingerprint?: string
  rules?: GameRules
}

export function loadRules(): GameRules {
  const stored = read<StoredRules>(RULES_KEY)
  if (!stored) return defaultRules()

  // Anything written before the fingerprint existed, or against different defaults, is from
  // an older set of rules and is dropped rather than allowed to override the new ones.
  if (stored.fingerprint !== rulesFingerprint() || !stored.rules) {
    console.info('The default rules have changed, so the saved rules were not carried over.')
    return defaultRules()
  }
  return mergeRules(defaultRules(), stored.rules)
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
