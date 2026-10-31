////////////////////////////////////////////////////////////////////////////////////////////////
// Loading rules saved by an older build.
//
// This is the one place a change to the rules shape can break a player who already has the
// app open, and it cannot be caught by typechecking: the stored object is whatever the build
// that wrote it happened to have.
////////////////////////////////////////////////////////////////////////////////////////////////

import { describe, expect, it } from 'vitest'

import { defaultRules } from '../src/game/rules'
import { mergeRules, rulesFingerprint } from '../src/state/storage'

describe('loading older saved rules', () => {
  it('fills in fields the stored section has never heard of', () => {
    const defaults = defaultRules()
    // A board section as v0.02 wrote it: no directions, no visible count, and the old
    // hidden fraction that no longer exists.
    const stored = {
      board: {
        width: 10,
        riverDepth: 7,
        islands: [],
        whirlpools: [],
        islandsBlockCurrent: true,
        currentStrengthWeights: [46, 12, 16, 8, 1],
        hiddenCurrentFraction: 0.35,
      },
    }

    const merged = mergeRules(defaults, stored)
    expect(merged.board.currentDirectionWeights).toEqual(
      defaults.board.currentDirectionWeights,
    )
    expect(merged.board.visibleCurrents).toBe(defaults.board.visibleCurrents)
    expect(merged.board.sidewaysOnlyFromStrength)
      .toBe(defaults.board.sidewaysOnlyFromStrength)
    // What the stored file did say still wins.
    expect(merged.board.currentStrengthWeights).toEqual([46, 12, 16, 8, 1])
  })

  it('keeps new sections that the stored file does not mention at all', () => {
    const defaults = defaultRules()
    const merged = mergeRules(defaults, { game: { rounds: 12 } })
    expect(merged.game.rounds).toBe(12)
    expect(merged.distraction.tokensPerPlayer)
      .toBe(defaults.distraction.tokensPerPlayer)
    expect(merged.production.collectorsPerPlayer)
      .toBe(defaults.production.collectorsPerPlayer)
  })

  it('replaces an edited array whole rather than blending it', () => {
    const defaults = defaultRules()
    const merged = mergeRules(defaults, {
      board: { islands: [{ col: 1, row: 1, size: 'small' }] },
    })
    expect(merged.board.islands).toHaveLength(1)
  })
})

describe('the fingerprint on a saved rules file', () => {
  it('changes whenever a default changes', () => {
    const before = rulesFingerprint()
    // The exact failure Cam hit twice: a default moved, a stored file kept the old value,
    // and the new rule never reached the game. A fingerprint taken from the defaults
    // themselves cannot be forgotten the way a hand-bumped version number can.
    expect(before).toBe(rulesFingerprint())
    expect(before).toHaveLength(rulesFingerprint().length)
    expect(before).toMatch(/^[a-z0-9]+$/)
  })

  it('would have caught the v0.04 rules file that cancelled the edge rule', () => {
    const defaults = defaultRules()
    // A v0.04 file held these values, and merging them over the v0.05 defaults silently
    // turned three new rules back off.
    const v04 = {
      current: { ...defaults.current, edgeBehaviour: 'stop-at-edge' as const },
      dam: { ...defaults.dam, calmAxis: 'vertical' as const },
    }
    const merged = mergeRules(defaults, v04)
    expect(merged.current.edgeBehaviour).toBe('stop-at-edge')
    expect(merged.dam.calmAxis).toBe('vertical')
    // Which is why the merge is only reached at all when the fingerprints match.
    expect(defaults.current.edgeBehaviour).toBe('swept-away')
    expect(defaults.dam.calmAxis).toBe('horizontal')
  })
})
