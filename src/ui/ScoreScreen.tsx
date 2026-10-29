////////////////////////////////////////////////////////////////////////////////////////////////
// The final scoreboard: animals across, mission points, secret roles revealed, and the winner.
////////////////////////////////////////////////////////////////////////////////////////////////

import { ROLE_LABELS } from '../game/roles'
import type { GameState } from '../game/types'
import { downloadJson } from '../state/storage'

export interface ScoreScreenProps {
  state: GameState
  onNewGame: () => void
  onReplaySameSeed: () => void
  onClose: () => void
}

export function ScoreScreen({
  state,
  onNewGame,
  onReplaySameSeed,
  onClose,
}: ScoreScreenProps) {
  const result = state.result
  if (!result) return null

  const winners = result.breakdowns.filter((b) =>
    result.winningPlayerIds.includes(b.playerId),
  )
  const ordered = [...result.breakdowns].sort((a, b) => b.total - a.total)

  return (
    <div className="overlay">
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <header>
          <h2>
            {winners.length > 1
              ? `${winners.map((w) => w.playerName).join(' and ')} share the win`
              : `${winners[0]?.playerName} wins`}
          </h2>
          <span className="spacer" />
          <span className="chip">
            seed <strong>{state.rng.seed}</strong>
          </span>
          <button className="btn ghost" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="body">
          {result.tieExplanation && (
            <div className="hint" style={{ borderColor: 'var(--warn)', marginBottom: 12 }}>
              {result.tieExplanation}
            </div>
          )}

          <table className="score-table">
            <thead>
              <tr>
                <th>Faction</th>
                <th className="num">Across</th>
                <th className="num">Animal pts</th>
                <th>Mission</th>
                <th className="num">Mission pts</th>
                <th>Secret role</th>
                <th className="num">Role pts</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((row) => (
                <tr
                  key={row.playerId}
                  className={result.winningPlayerIds.includes(row.playerId) ? 'winner' : ''}
                >
                  <td>
                    <span className={`pip ${row.factionId}`} style={{ marginRight: 6 }} />
                    {row.playerName}
                  </td>
                  <td className="num">{row.animalsAcross}</td>
                  <td className="num">{row.animalPoints}</td>
                  <td>
                    {row.missionName ?? 'none'}
                    {row.missionName && (
                      <span className="faint">
                        {' '}
                        {row.missionComplete ? '(done)' : '(not done)'}
                      </span>
                    )}
                  </td>
                  <td className="num">{row.missionPoints}</td>
                  <td>
                    {ROLE_LABELS[row.roleId ?? 'none']}
                    {row.roleId && row.roleId !== 'none' && (
                      <div className="faint">{row.roleExplanation}</div>
                    )}
                  </td>
                  <td className="num">{row.roleBonus}</td>
                  <td className="num total-cell">{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="section-title">How the game went</div>
          <table className="score-table">
            <thead>
              <tr>
                <th>Faction</th>
                <th className="num">Resources in</th>
                <th className="num">Spent</th>
                <th className="num">Built</th>
                <th className="num">Dams destroyed</th>
                <th className="num">Cards bought</th>
                <th className="num">Cards played</th>
                <th className="num">Carried by current</th>
              </tr>
            </thead>
            <tbody>
              {state.players.map((player) => {
                const sum = (bag: Record<string, number>) =>
                  Object.values(bag).reduce((a, b) => a + b, 0)
                return (
                  <tr key={player.id}>
                    <td>
                      <span className={`pip ${player.factionId}`} style={{ marginRight: 6 }} />
                      {player.name}
                    </td>
                    <td className="num">{sum(player.stats.resourcesGained)}</td>
                    <td className="num">{sum(player.stats.resourcesSpent)}</td>
                    <td className="num">{player.stats.structuresBuilt}</td>
                    <td className="num">{player.stats.damsDestroyed}</td>
                    <td className="num">{player.stats.powerCardsBought}</td>
                    <td className="num">{player.stats.powerCardsPlayed}</td>
                    <td className="num">{player.stats.currentMovesSuffered}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div className="section-title">Animals across, round by round</div>
          <table className="score-table">
            <thead>
              <tr>
                <th>Faction</th>
                {Array.from({ length: state.rules.game.rounds }, (_, i) => (
                  <th key={i} className="num">
                    {i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.players.map((player) => (
                <tr key={player.id}>
                  <td>{player.name}</td>
                  {Array.from({ length: state.rules.game.rounds }, (_, i) => (
                    <td key={i} className="num">
                      {player.stats.acrossByRound[i] ?? 0}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <footer>
          <button
            className="btn"
            onClick={() =>
              downloadJson(`dam-it-result-${state.rng.seed}.json`, {
                seed: state.rng.seed,
                rounds: state.rules.game.rounds,
                result,
                players: state.players.map((p) => ({
                  name: p.name,
                  faction: p.factionId,
                  controller: p.controller,
                  stats: p.stats,
                })),
                rules: state.rules,
                log: state.log,
              })
            }
          >
            Export this game as JSON
          </button>
          <span style={{ flex: 1 }} />
          <button className="btn" onClick={onReplaySameSeed}>
            Play seed {state.rng.seed} again
          </button>
          <button className="btn primary" onClick={onNewGame}>
            New game
          </button>
        </footer>
      </div>
    </div>
  )
}
