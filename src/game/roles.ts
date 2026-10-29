////////////////////////////////////////////////////////////////////////////////////////////////
// The secret role twist.
//
// At the end of a configurable round (5 by default) exactly one player is dealt a special role
// and the others are dealt an ordinary one. Roles stay secret until the end of the last round.
//
// Saboteur powers are not settled. The provisional ability is a single free current increase
// per round, which is small, reversible and easy to turn off in the rules editor.
////////////////////////////////////////////////////////////////////////////////////////////////

import { addLog } from './log'
import { nextInt } from './rng'
import type { GameState, Player, RoleId } from './types'

export const SPECIAL_ROLES: RoleId[] = ['saboteur', 'hoarder', 'champion']

export const ROLE_LABELS: Record<RoleId, string> = {
  saboteur: 'Saboteur',
  hoarder: 'Hoarder',
  champion: 'Champion',
  none: 'No special role',
}

export const ROLE_TEXT: Record<RoleId, string> = {
  saboteur:
    'Disrupt your rivals, but still get at least 2 animals across to claim your bonus.',
  hoarder:
    'Finish with more total resources than every other player, and at least 2 animals across.',
  champion:
    'Finish with more animals across than every other player, and at least 2 animals across.',
  none: 'You have no special role this game. Score the usual way.',
}

export function totalResources(player: Player): number {
  return Object.values(player.resources).reduce((sum, n) => sum + n, 0)
}

export function animalsAcross(state: GameState, player: Player): number {
  return state.animals.filter((a) => a.playerId === player.id && a.status === 'finished').length
}

/** Deals one special role at random and gives everybody else the ordinary card. */
export function dealRoles(state: GameState): void {
  if (!state.rules.roles.enabled || state.rolesDealt) return

  const [index, rng] = nextInt(state.rng, 0, state.players.length - 1)
  state.rng = rng
  const [roleIndex, rng2] = nextInt(state.rng, 0, SPECIAL_ROLES.length - 1)
  state.rng = rng2
  const specialRole = SPECIAL_ROLES[roleIndex]

  state.players.forEach((player, i) => {
    player.roleId = i === index ? specialRole : 'none'
  })
  state.rolesDealt = true

  addLog(state, {
    kind: 'roles-dealt',
    message: 'Secret roles were dealt. One player has a special role.',
    detail: 'Roles stay hidden until the end of the final round.',
  })
}

export interface RoleOutcome {
  bonus: number
  qualified: boolean
  explanation: string
}

/** Works out whether a player's role paid out, and says why in plain words. */
export function evaluateRole(state: GameState, player: Player): RoleOutcome {
  const rules = state.rules.roles
  const role = player.roleId

  if (!rules.enabled || !role || role === 'none') {
    return { bonus: 0, qualified: false, explanation: 'No special role.' }
  }

  const across = animalsAcross(state, player)
  const others = state.players.filter((p) => p.id !== player.id)

  if (across < rules.minAnimalsAcross) {
    return {
      bonus: 0,
      qualified: false,
      explanation: `${ROLE_LABELS[role]} needs at least ${rules.minAnimalsAcross} animals ` +
        `across and only got ${across}.`,
    }
  }

  if (role === 'hoarder') {
    const mine = totalResources(player)
    const best = Math.max(...others.map(totalResources))
    const unique = mine > best
    return {
      bonus: unique ? rules.bonusPoints : 0,
      qualified: unique,
      explanation: unique
        ? `Hoarder finished with ${mine} resources, ahead of the next best ${best}.`
        : `Hoarder finished with ${mine} resources and did not lead outright ` +
          `(best rival ${best}).`,
    }
  }

  if (role === 'champion') {
    const best = Math.max(...others.map((p) => animalsAcross(state, p)))
    const unique = across > best
    return {
      bonus: unique ? rules.bonusPoints : 0,
      qualified: unique,
      explanation: unique
        ? `Champion got ${across} animals across, ahead of the next best ${best}.`
        : `Champion got ${across} animals across and did not lead outright ` +
          `(best rival ${best}).`,
    }
  }

  // Saboteur: the provisional condition is simply the shared minimum crossing requirement.
  return {
    bonus: rules.bonusPoints,
    qualified: true,
    explanation: `Saboteur got ${across} animals across, meeting the minimum of ` +
      `${rules.minAnimalsAcross}.`,
  }
}

export function saboteurUsesLeft(state: GameState, player: Player): number {
  const rules = state.rules.roles
  if (!rules.enabled || !rules.saboteur.abilityEnabled) return 0
  if (player.roleId !== 'saboteur') return 0
  const used = state.saboteurUsesThisRound[player.id] ?? 0
  return Math.max(0, rules.saboteur.usesPerRound - used)
}
