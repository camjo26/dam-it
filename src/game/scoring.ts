////////////////////////////////////////////////////////////////////////////////////////////////
// Final scoring.
//
// One point per animal across, plus the mission bonus, plus the secret role bonus. Ties are
// reported rather than broken silently.
////////////////////////////////////////////////////////////////////////////////////////////////

import { isMissionComplete, missionById } from './missions'
import { animalsAcross, evaluateRole } from './roles'
import type { GameResult, GameState, ScoreBreakdown } from './types'

export function scoreGame(state: GameState): GameResult {
  const breakdowns: ScoreBreakdown[] = state.players.map((player) => {
    const across = animalsAcross(state, player)
    const animalPoints = across * state.rules.scoring.pointsPerAnimalAcross

    const mission = missionById(state, player.missionId)
    const missionComplete = state.rules.missions.enabled && isMissionComplete(state, player)
    const missionPoints = missionComplete && mission ? mission.points : 0

    const role = evaluateRole(state, player)

    return {
      playerId: player.id,
      playerName: player.name,
      factionId: player.factionId,
      animalsAcross: across,
      animalPoints,
      missionId: player.missionId,
      missionName: mission?.name ?? null,
      missionComplete,
      missionPoints,
      roleId: player.roleId,
      roleBonus: role.bonus,
      roleQualified: role.qualified,
      roleExplanation: role.explanation,
      total: animalPoints + missionPoints + role.bonus,
    }
  })

  const best = Math.max(...breakdowns.map((b) => b.total))
  const winners = breakdowns.filter((b) => b.total === best)

  let tieExplanation: string | null = null
  if (winners.length > 1) {
    const names = winners.map((w) => w.playerName).join(', ')
    tieExplanation =
      `${names} all finished on ${best} points. The rules as written do not break this tie, ` +
      `so the game is a shared win.`
  }

  return {
    breakdowns,
    winningPlayerIds: winners.map((w) => w.playerId),
    tieExplanation,
  }
}

/** Running score used by the in-game scoreboard, before roles are revealed. */
export function provisionalScore(state: GameState, playerId: string): number {
  const player = state.players.find((p) => p.id === playerId)
  if (!player) return 0
  return animalsAcross(state, player) * state.rules.scoring.pointsPerAnimalAcross
}
