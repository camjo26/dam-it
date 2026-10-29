////////////////////////////////////////////////////////////////////////////////////////////////
// Playtesting diagnostics: what each faction earned, spent, built and crossed, and whether
// anything is stuck. Exportable as JSON or CSV so runs can be compared.
////////////////////////////////////////////////////////////////////////////////////////////////

import { logToCsv } from '../game/log'
import { distanceToFinish } from '../game/engine'
import { evaluateMission, missionById } from '../game/missions'
import type { GameState, Player } from '../game/types'
import { RESOURCE_IDS, RESOURCE_LABELS } from '../game/types'
import { downloadJson, downloadText } from '../state/storage'

export function Diagnostics({
  state,
  onClose,
}: {
  state: GameState
  onClose: () => void
}) {
  const sum = (bag: Record<string, number>) => Object.values(bag).reduce((a, b) => a + b, 0)

  const crossings = state.animals
    .filter((a) => a.status === 'finished')
    .sort((a, b) => (a.finishedOnRound ?? 0) - (b.finishedOnRound ?? 0))

  const stuck = (player: Player) =>
    state.animals.filter(
      (a) => a.playerId === player.id && a.status === 'bank' && state.round > 3,
    ).length

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <header>
          <h2>Playtest diagnostics</h2>
          <span className="spacer" />
          <span className="chip">
            seed <strong>{state.rng.seed}</strong>
          </span>
          <span className="chip">
            round <strong>{state.round}</strong> of {state.rules.game.rounds}
          </span>
          <button className="btn ghost" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="body">
          <div className="section-title">Economy</div>
          <table className="score-table">
            <thead>
              <tr>
                <th>Faction</th>
                {RESOURCE_IDS.map((id) => (
                  <th key={id} className="num">
                    {RESOURCE_LABELS[id]} in
                  </th>
                ))}
                <th className="num">Total in</th>
                <th className="num">Spent</th>
                <th className="num">Held</th>
              </tr>
            </thead>
            <tbody>
              {state.players.map((player) => (
                <tr key={player.id}>
                  <td>
                    <span className={`pip ${player.factionId}`} style={{ marginRight: 6 }} />
                    {player.name}
                  </td>
                  {RESOURCE_IDS.map((id) => (
                    <td key={id} className="num">
                      {player.stats.resourcesGained[id]}
                    </td>
                  ))}
                  <td className="num">{sum(player.stats.resourcesGained)}</td>
                  <td className="num">{sum(player.stats.resourcesSpent)}</td>
                  <td className="num">{sum(player.resources)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="section-title">Progress</div>
          <table className="score-table">
            <thead>
              <tr>
                <th>Faction</th>
                <th className="num">Across</th>
                <th className="num">In water</th>
                <th className="num">Still on bank</th>
                <th className="num">Avg rows to go</th>
                <th className="num">Carried by current</th>
                <th>Mission progress</th>
              </tr>
            </thead>
            <tbody>
              {state.players.map((player) => {
                const owned = state.animals.filter((a) => a.playerId === player.id)
                const inWater = owned.filter((a) => a.status === 'river')
                const across = owned.filter((a) => a.status === 'finished')
                const togo = inWater.length
                  ? inWater.reduce((t, a) => t + distanceToFinish(state, a), 0) / inWater.length
                  : 0
                const progress = evaluateMission(state, player)
                const mission = missionById(state, player.missionId)
                return (
                  <tr key={player.id}>
                    <td>
                      <span className={`pip ${player.factionId}`} style={{ marginRight: 6 }} />
                      {player.name}
                    </td>
                    <td className="num">{across.length}</td>
                    <td className="num">{inWater.length}</td>
                    <td className="num">{stuck(player)}</td>
                    <td className="num">{togo.toFixed(1)}</td>
                    <td className="num">{player.stats.currentMovesSuffered}</td>
                    <td className="faint">
                      {state.phase === 'finished'
                        ? `${mission?.name ?? 'none'}: ${progress?.label ?? ''}`
                        : 'hidden until the end'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div className="section-title">Cards and building</div>
          <table className="score-table">
            <thead>
              <tr>
                <th>Faction</th>
                <th className="num">Cards bought</th>
                <th className="num">Cards played</th>
                <th className="num">In hand</th>
                <th className="num">Built</th>
                <th className="num">Dams destroyed</th>
              </tr>
            </thead>
            <tbody>
              {state.players.map((player) => (
                <tr key={player.id}>
                  <td>{player.name}</td>
                  <td className="num">{player.stats.powerCardsBought}</td>
                  <td className="num">{player.stats.powerCardsPlayed}</td>
                  <td className="num">{player.hand.length}</td>
                  <td className="num">{player.stats.structuresBuilt}</td>
                  <td className="num">{player.stats.damsDestroyed}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="faint" style={{ marginTop: 4 }}>
            Power Card deck: {state.powerDeck.length} left, {state.powerDiscard.length}{' '}
            discarded. Production deck: {state.production.drawPile.length} left,{' '}
            {state.production.discardPile.length} discarded.
          </div>

          <div className="section-title">Every crossing ({crossings.length})</div>
          {crossings.length === 0 ? (
            <div className="faint">Nothing has reached the far bank yet.</div>
          ) : (
            <table className="score-table">
              <thead>
                <tr>
                  <th>Round</th>
                  <th>Faction</th>
                  <th className="num">Islands visited</th>
                  <th className="num">Current rides</th>
                  <th>Through a whirlpool</th>
                </tr>
              </thead>
              <tbody>
                {crossings.map((animal) => {
                  const owner = state.players.find((p) => p.id === animal.playerId)
                  return (
                    <tr key={animal.id}>
                      <td>{animal.finishedOnRound}</td>
                      <td>
                        <span className={`pip ${animal.factionId}`} style={{ marginRight: 6 }} />
                        {owner?.name}
                      </td>
                      <td className="num">{animal.islandsVisited.length}</td>
                      <td className="num">{animal.movedByCurrentCount}</td>
                      <td>{animal.crossedWhirlpool ? 'yes' : 'no'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          <div className="section-title">Animals across, round by round</div>
          <table className="score-table">
            <thead>
              <tr>
                <th>Faction</th>
                {Array.from({ length: state.rules.game.rounds }, (_, i) => (
                  <th key={i} className="num">{i + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.players.map((player) => (
                <tr key={player.id}>
                  <td>{player.name}</td>
                  {Array.from({ length: state.rules.game.rounds }, (_, i) => (
                    <td key={i} className="num">
                      {player.stats.acrossByRound[i] ?? '-'}
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
              downloadJson(`dam-it-diagnostics-${state.rng.seed}.json`, {
                seed: state.rng.seed,
                round: state.round,
                phase: state.phase,
                rules: state.rules,
                players: state.players.map((p) => ({
                  name: p.name,
                  faction: p.factionId,
                  controller: p.controller,
                  resources: p.resources,
                  stats: p.stats,
                })),
                animals: state.animals,
                dams: state.dams,
                log: state.log,
              })
            }
          >
            Export JSON
          </button>
          <button
            className="btn"
            onClick={() =>
              downloadText(`dam-it-log-${state.rng.seed}.csv`, logToCsv(state.log), 'text/csv')
            }
          >
            Export log CSV
          </button>
          <span style={{ flex: 1 }} />
          <button className="btn primary" onClick={onClose}>
            Back to the game
          </button>
        </footer>
      </div>
    </div>
  )
}
