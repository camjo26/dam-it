////////////////////////////////////////////////////////////////////////////////////////////////
// Game log helpers. Every rules-visible event goes through here so the log is a complete,
// exportable record of the game.
////////////////////////////////////////////////////////////////////////////////////////////////

import type { GameState, LogEntry } from './types'

export interface LogInput {
  kind: string
  message: string
  playerId?: string | null
  detail?: string
}

/** Appends a log entry in place. Callers already hold a draft copy of the state. */
export function addLog(state: GameState, input: LogInput): void {
  const entry: LogEntry = {
    id: state.nextLogId,
    round: state.round,
    phase: state.phase,
    playerId: input.playerId ?? null,
    kind: input.kind,
    message: input.message,
    detail: input.detail,
  }
  state.log.push(entry)
  state.nextLogId += 1
}

export function logToCsv(log: LogEntry[]): string {
  const header = ['id', 'round', 'phase', 'playerId', 'kind', 'message', 'detail']
  const escape = (value: string | number | null | undefined): string => {
    const text = value === null || value === undefined ? '' : String(value)
    return `"${text.replace(/"/g, '""')}"`
  }
  const rows = log.map((entry) =>
    [entry.id, entry.round, entry.phase, entry.playerId, entry.kind, entry.message, entry.detail]
      .map(escape)
      .join(','),
  )
  return [header.join(','), ...rows].join('\n')
}
