////////////////////////////////////////////////////////////////////////////////////////////////
// Mission cards.
//
// Each check is a small pure function of the game state, registered by id. Adding a mission
// means adding a card to the rules and, only if it needs a new kind of condition, one entry in
// MISSION_CHECKS. Points and targets are edited in the rules, not here.
////////////////////////////////////////////////////////////////////////////////////////////////

import type { GameState, MissionCheckId, MissionDef, Player } from './types'
import { RESOURCE_IDS } from './types'

export interface MissionProgress {
  complete: boolean
  current: number
  target: number
  label: string
}

type MissionCheck = (state: GameState, player: Player, mission: MissionDef) => MissionProgress

function animalsOf(state: GameState, player: Player) {
  return state.animals.filter((animal) => animal.playerId === player.id)
}

export const MISSION_CHECKS: Record<MissionCheckId, MissionCheck> = {
  'animals-across': (state, player, mission) => {
    const current = animalsOf(state, player).filter((a) => a.status === 'finished').length
    return {
      complete: current >= mission.target,
      current,
      target: mission.target,
      label: `${current} of ${mission.target} animals across`,
    }
  },

  'dams-destroyed': (_state, player, mission) => {
    const current = player.stats.damsDestroyed
    return {
      complete: current >= mission.target,
      current,
      target: mission.target,
      label: `${current} of ${mission.target} dams destroyed`,
    }
  },

  'structures-built': (_state, player, mission) => {
    const current = player.stats.structuresBuilt
    return {
      complete: current >= mission.target,
      current,
      target: mission.target,
      label: `${current} of ${mission.target} structures built`,
    }
  },

  'one-of-each-resource': (_state, player, mission) => {
    const current = RESOURCE_IDS.filter((id) => player.resources[id] >= mission.target).length
    return {
      complete: current === RESOURCE_IDS.length,
      current,
      target: RESOURCE_IDS.length,
      label: `${current} of ${RESOURCE_IDS.length} resources held`,
    }
  },

  'whirlpool-survivor': (state, player, mission) => {
    const current = animalsOf(state, player).filter(
      (a) => a.status === 'finished' && a.crossedWhirlpool,
    ).length
    return {
      complete: current >= mission.target,
      current,
      target: mission.target,
      label: `${current} of ${mission.target} whirlpool survivors across`,
    }
  },

  'power-cards-bought': (_state, player, mission) => {
    const current = player.stats.powerCardsBought
    return {
      complete: current >= mission.target,
      current,
      target: mission.target,
      label: `${current} of ${mission.target} Power Cards bought`,
    }
  },

  'island-hopper': (state, player, mission) => {
    const best = animalsOf(state, player).reduce(
      (max, a) => Math.max(max, a.islandsVisited.length),
      0,
    )
    return {
      complete: best >= mission.target,
      current: best,
      target: mission.target,
      label: `best animal has visited ${best} of ${mission.target} islands`,
    }
  },

  'current-rider': (state, player, mission) => {
    const best = animalsOf(state, player)
      .filter((a) => a.status === 'finished')
      .reduce((max, a) => Math.max(max, a.movedByCurrentCount), 0)
    return {
      complete: best >= mission.target,
      current: best,
      target: mission.target,
      label: `best finisher rode the current ${best} of ${mission.target} times`,
    }
  },
}

/**
 * Whether a once-true condition stays true. Cumulative counters latch; conditions about what
 * a player is holding right now do not, because spending the resources undoes them. "Finish
 * the game with at least 1 of each resource" is therefore only ever tested at scoring time.
 */
export const MISSION_CHECK_LATCHES: Record<MissionCheckId, boolean> = {
  'animals-across': true,
  'dams-destroyed': true,
  'structures-built': true,
  'one-of-each-resource': false,
  'whirlpool-survivor': true,
  'power-cards-bought': true,
  'island-hopper': true,
  'current-rider': true,
}

export function missionById(state: GameState, id: string | null): MissionDef | undefined {
  if (!id) return undefined
  return state.rules.missions.cards.find((card) => card.id === id)
}

/** The authoritative "is this mission done" test, used by scoring and by the UI. */
export function isMissionComplete(state: GameState, player: Player): boolean {
  const mission = missionById(state, player.missionId)
  if (!mission) return false
  if (MISSION_CHECK_LATCHES[mission.check]) return player.missionComplete
  return evaluateMission(state, player)?.complete ?? false
}

export function evaluateMission(state: GameState, player: Player): MissionProgress | null {
  const mission = missionById(state, player.missionId)
  if (!mission) return null
  const check = MISSION_CHECKS[mission.check]
  if (!check) return null
  return check(state, player, mission)
}

/**
 * Re-checks every player's mission after a phase. Cumulative missions latch here so later
 * spending cannot take the achievement away; the rest are left to be tested at scoring time.
 */
export function refreshMissionProgress(state: GameState): void {
  if (!state.rules.missions.enabled) return
  for (const player of state.players) {
    const mission = missionById(state, player.missionId)
    if (!mission || !MISSION_CHECK_LATCHES[mission.check]) continue
    const progress = evaluateMission(state, player)
    if (progress?.complete) player.missionComplete = true
  }
}
