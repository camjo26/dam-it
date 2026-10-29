////////////////////////////////////////////////////////////////////////////////////////////////
// The four faction panels: animals, resources, equipment, cards, mission and role.
//
// Secret information is only shown for the seat whose turn it is, or behind a hold-to-peek
// button, so a hot seat game does not give everything away to whoever is looking at the screen.
////////////////////////////////////////////////////////////////////////////////////////////////

import { useState } from 'react'

import { activePlayer } from '../game/engine'
import { evaluateMission, missionById } from '../game/missions'
import { ROLE_LABELS, ROLE_TEXT } from '../game/roles'
import type { GameState, Player, ResourceId } from '../game/types'
import { EQUIPMENT_IDS, RESOURCE_IDS, RESOURCE_LABELS } from '../game/types'
import { bg, equipmentArt, resourceArt } from './art'

export interface FactionPanelsProps {
  state: GameState
  onSelectAnimalOwner?: (playerId: string) => void
}

export function FactionPanels({ state }: FactionPanelsProps) {
  const active = activePlayer(state)

  return (
    <div className="panel">
      <header>Factions</header>
      <div className="body tight">
        {state.players.map((player) => (
          <FactionCard
            key={player.id}
            state={state}
            player={player}
            isActive={state.phase === 'player-turns' && active?.id === player.id}
          />
        ))}
      </div>
    </div>
  )
}

function FactionCard({
  state,
  player,
  isActive,
}: {
  state: GameState
  player: Player
  isActive: boolean
}) {
  const [peeking, setPeeking] = useState(false)
  const faction = state.rules.factions[player.factionId]
  const owned = state.animals.filter((a) => a.playerId === player.id)
  const across = owned.filter((a) => a.status === 'finished').length
  const onBank = owned.filter((a) => a.status === 'bank').length
  const inRiver = owned.filter((a) => a.status === 'river').length

  const gameOver = state.phase === 'finished'
  // Secrets are visible to the seat that owns them, or once the game is over.
  const canSeeSecrets = gameOver || peeking || (isActive && player.controller === 'human')

  const mission = missionById(state, player.missionId)
  const progress = evaluateMission(state, player)

  return (
    <div className={`faction ${player.factionId}${isActive ? ' active' : ''}`}>
      <div className="name-row">
        <span>{player.name}</span>
        {player.controller === 'ai' && <span className="tag">{player.aiDifficulty} AI</span>}
        {isActive && <span className="tag" style={{ background: '#2f9ad6', color: '#fff' }}>
          Turn
        </span>}
        <span className="right faint">{across} across</span>
      </div>

      <div className="counts">
        <span>Bank <b>{onBank}</b></span>
        <span>River <b>{inRiver}</b></span>
        <span>Across <b>{across}</b></span>
        <span>of <b>{faction.startingAnimals}</b></span>
      </div>

      <div className="resources">
        {RESOURCE_IDS.map((id) => (
          <span key={id} className={`res ${id}`} title={RESOURCE_LABELS[id]}>
            <span className="swatch" style={bg(resourceArt(id))} />
            {player.resources[id]}
          </span>
        ))}
      </div>

      {isActive && (
        <div className="counts" style={{ marginTop: 6 }}>
          <span>Movement <b>{player.movementRemaining}</b></span>
          <span>Actions <b>{player.actionsRemaining}</b></span>
        </div>
      )}

      {EQUIPMENT_IDS.some((id) => player.equipment[id] > 0) && (
        <div className="counts" style={{ marginTop: 4 }}>
          {EQUIPMENT_IDS.filter((id) => player.equipment[id] > 0).map((id) => (
            <span key={id} title={id}>
              <span className="kit-icon" style={bg(equipmentArt(id))} />
              <b>{player.equipment[id]}</b>
            </span>
          ))}
        </div>
      )}

      <div className="counts" style={{ marginTop: 4 }}>
        <span>Cards <b>{player.hand.length}</b></span>
        {player.collectorArea && (
          <span>Collector <b>{RESOURCE_LABELS[player.collectorArea as ResourceId]}</b></span>
        )}
      </div>

      {state.rules.missions.enabled && (
        <div style={{ marginTop: 6 }}>
          {canSeeSecrets && mission ? (
            <div className="faint">
              <b style={{ color: 'var(--text)' }}>Mission: {mission.name}</b> (+{mission.points})
              <div>{mission.text}</div>
              {progress && (
                <div style={{ marginTop: 3 }}>
                  <div className="meter">
                    <span
                      style={{
                        width: `${Math.min(100, (progress.current / Math.max(1, progress.target)) * 100)}%`,
                      }}
                    />
                  </div>
                  <div style={{ marginTop: 2 }}>
                    {progress.label}
                    {progress.complete ? ' - done' : ''}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="faint">
              Secret mission held
              {player.controller === 'human' && !gameOver && (
                <button
                  className="btn tiny ghost"
                  style={{ marginLeft: 6 }}
                  onMouseDown={() => setPeeking(true)}
                  onMouseUp={() => setPeeking(false)}
                  onMouseLeave={() => setPeeking(false)}
                  onTouchStart={() => setPeeking(true)}
                  onTouchEnd={() => setPeeking(false)}
                >
                  Hold to peek
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {state.rolesDealt && (
        <div className="faint" style={{ marginTop: 4 }}>
          {gameOver ? (
            <>
              <b style={{ color: 'var(--text)' }}>Role: {ROLE_LABELS[player.roleId ?? 'none']}</b>
              <div>{ROLE_TEXT[player.roleId ?? 'none']}</div>
            </>
          ) : canSeeSecrets ? (
            <b style={{ color: 'var(--text)' }}>
              Role: {ROLE_LABELS[player.roleId ?? 'none']}
            </b>
          ) : (
            'Secret role held'
          )}
        </div>
      )}
    </div>
  )
}
