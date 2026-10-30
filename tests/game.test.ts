////////////////////////////////////////////////////////////////////////////////////////////////
// Whole-game tests: four AI players must reach a final score from any seed, at any difficulty,
// and the same seed must always give the same game.
////////////////////////////////////////////////////////////////////////////////////////////////

import { describe, expect, it } from 'vitest'

import { playOutGame } from '../src/game/runner'
import { defaultRules, type GameRules } from '../src/game/rules'
import { createGame } from '../src/game/setup'
import { FACTION_IDS, type AiDifficulty } from '../src/game/types'

function aiGame(
  seed: string,
  difficulty: AiDifficulty = 'normal',
  rounds = 10,
  tweak?: (rules: GameRules) => void,
) {
  const rules = defaultRules()
  rules.game.rounds = rounds
  rules.ai.stepDelayMs = 0
  tweak?.(rules)
  return createGame({
    rules,
    seed,
    players: FACTION_IDS.map((factionId) => ({
      factionId,
      name: rules.factions[factionId].name,
      controller: 'ai' as const,
      aiDifficulty: difficulty,
    })),
  })
}

describe('full games', () => {
  const seeds = ['A1', 'B2', 'C3', 'D4', 'E5', 'F6', 'G7', 'H8']

  for (const difficulty of ['easy', 'normal', 'hard'] as AiDifficulty[]) {
    it(`completes ten rounds on ${difficulty} for every seed`, () => {
      for (const seed of seeds) {
        const finished = playOutGame(aiGame(seed, difficulty))
        expect(finished.phase).toBe('finished')
        expect(finished.round).toBe(10)
        expect(finished.result).not.toBeNull()
        expect(finished.result!.winningPlayerIds.length).toBeGreaterThan(0)

        // Nothing may be left in an impossible position.
        for (const animal of finished.animals) {
          expect(animal.col).toBeGreaterThanOrEqual(0)
          expect(animal.col).toBeLessThan(finished.board.width)
          expect(animal.row).toBeGreaterThanOrEqual(0)
          expect(animal.row).toBeLessThanOrEqual(finished.board.riverDepth + 1)
        }
      }
    })
  }

  it('gives an identical game from the same seed', () => {
    const first = playOutGame(aiGame('REPEAT'))
    const second = playOutGame(aiGame('REPEAT'))

    expect(second.log.map((e) => e.message)).toEqual(first.log.map((e) => e.message))
    expect(second.result!.breakdowns.map((b) => b.total))
      .toEqual(first.result!.breakdowns.map((b) => b.total))
  })

  it('gives a different game from a different seed', () => {
    const first = playOutGame(aiGame('ONE'))
    const second = playOutGame(aiGame('TWO'))
    expect(second.log.map((e) => e.message)).not.toEqual(first.log.map((e) => e.message))
  })

  it('resolves the current exactly once per round', () => {
    const finished = playOutGame(aiGame('ONCE'))
    const starts = finished.log.filter((e) => e.kind === 'current-start')
    expect(starts).toHaveLength(10)
    expect(starts.map((e) => e.round)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  // Roles are parked by default. This switches them on so the mechanic stays covered and
  // can be trusted if Cam decides to bring it back.
  it('deals secret roles exactly once when they are switched on', () => {
    const finished = playOutGame(
      aiGame('ROLES', 'normal', 10, (rules) => { rules.roles.enabled = true }),
    )
    expect(finished.log.filter((e) => e.kind === 'roles-dealt')).toHaveLength(1)
    const special = finished.players.filter((p) => p.roleId !== 'none')
    expect(special).toHaveLength(1)
  })

  it('never lets a player hold more Power Cards than they bought', () => {
    const finished = playOutGame(aiGame('CARDS'))
    for (const player of finished.players) {
      expect(player.hand.length).toBeLessThanOrEqual(player.stats.powerCardsBought)
      expect(player.stats.powerCardsPlayed).toBeLessThanOrEqual(player.stats.powerCardsBought)
    }
  })

  it('keeps the Power Card deck and discard pile consistent', () => {
    const finished = playOutGame(aiGame('DECK'))
    const inHands = finished.players.reduce((sum, p) => sum + p.hand.length, 0)
    const total = finished.powerDeck.length + finished.powerDiscard.length + inHands
    const expected = finished.rules.powerCards.deck.reduce((sum, c) => sum + c.copies, 0)
    expect(total).toBe(expected)
    expect(expected).toBe(34)
  })
})
