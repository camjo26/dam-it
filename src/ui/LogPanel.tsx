////////////////////////////////////////////////////////////////////////////////////////////////
// The game log: every rules-visible event, newest first, filterable and exportable.
////////////////////////////////////////////////////////////////////////////////////////////////

import { useMemo, useState } from 'react'

import { logToCsv } from '../game/log'
import type { GameState } from '../game/types'
import { downloadText } from '../state/storage'

const FILTERS: Array<{ id: string; label: string; kinds: string[] }> = [
  { id: 'all', label: 'All', kinds: [] },
  {
    id: 'movement',
    label: 'Movement',
    kinds: ['move', 'current-move', 'current-hold', 'raft', 'rope', 'dam-sweep'],
  },
  { id: 'current', label: 'Current', kinds: ['current-start', 'current-move', 'current-hold'] },
  {
    id: 'economy',
    label: 'Economy',
    kinds: ['collect', 'production', 'build', 'power-card-bought'],
  },
  { id: 'cards', label: 'Cards', kinds: ['power-card', 'power-card-bought'] },
]

export function LogPanel({ state }: { state: GameState }) {
  const [filter, setFilter] = useState('all')
  const [roundOnly, setRoundOnly] = useState(false)

  const entries = useMemo(() => {
    const selected = FILTERS.find((f) => f.id === filter)
    let list = state.log
    if (selected && selected.kinds.length > 0) {
      list = list.filter((entry) => selected.kinds.includes(entry.kind))
    }
    if (roundOnly) list = list.filter((entry) => entry.round === state.round)
    return list
  }, [state.log, state.round, filter, roundOnly])

  return (
    <div className="panel">
      <header>
        Game log
        <span className="spacer" />
        <button
          className="btn tiny ghost"
          onClick={() => downloadText(`dam-it-log-${state.id}.csv`, logToCsv(state.log),
            'text/csv')}
          title="Export the whole log as CSV"
        >
          CSV
        </button>
      </header>
      <div className="body tight">
        <div className="row wrap" style={{ marginBottom: 6 }}>
          {FILTERS.map((f) => (
            <button
              key={f.id}
              className={`btn tiny${filter === f.id ? ' primary' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
          <button
            className={`btn tiny${roundOnly ? ' primary' : ''}`}
            onClick={() => setRoundOnly((v) => !v)}
          >
            This round
          </button>
        </div>

        <div className="log">
          {entries
            .slice()
            .reverse()
            .map((entry) => {
              const player = state.players.find((p) => p.id === entry.playerId)
              return (
                <div key={entry.id} className={`log-entry kind-${entry.kind}`}>
                  <div className="meta">
                    R{entry.round} - {entry.phase}
                    {player ? ` - ${player.name}` : ''}
                  </div>
                  <div>{entry.message}</div>
                  {entry.detail && <div className="detail">{entry.detail}</div>}
                </div>
              )
            })}
          {entries.length === 0 && <div className="faint" style={{ padding: 8 }}>
            Nothing logged yet.
          </div>}
        </div>
      </div>
    </div>
  )
}
