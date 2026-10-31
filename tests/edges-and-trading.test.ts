////////////////////////////////////////////////////////////////////////////////////////////////
// The rules added in v0.05: animals swept over the side, ranges counted in straight lines,
// dams holding the water either side of them, and trading.
////////////////////////////////////////////////////////////////////////////////////////////////

import { describe, expect, it } from 'vitest'

import { assessCurrent } from '../src/game/current'
import { applyAction, orthogonalDistance } from '../src/game/engine'
import { judgeTrade, valueGaining } from '../src/game/trade'
import type { TradeProposal } from '../src/game/types'
import {
  animalsOf,
  expectRejected,
  makeGame,
  must,
  playerOf,
  put,
  reachCurrentPhase,
  startPlayerTurns,
  stockUp,
} from './helpers'

describe('swept over the edge', () => {
  it('takes an animal out of the game when the current carries it past the side', () => {
    // Every tile pushes left at strength 2, so an animal near the left edge goes over it.
    // A beaver, because Swans resist the current and Ducks ride an extra square: this test
    // is about the edge, not about a faction ability.
    let state = makeGame({ currentStrength: 2, directionWeights: [1, 0, 0, 0] })
    state = startPlayerTurns(state)
    const beaver = animalsOf(state, 'beavers')[0]
    put(state, state.animals.find((a) => a.id === beaver.id)!, 1, 3)

    state = must(reachCurrentPhase(state), { type: 'resolve-current' })

    const after = state.animals.find((a) => a.id === beaver.id)!
    expect(after.status).toBe('lost')
    expect(playerOf(state, 'beavers').stats.animalsLost).toBe(1)
    expect(state.log.some((e) => e.kind === 'current-lost')).toBe(true)
  })

  it('scores nothing for an animal it loses', () => {
    let state = makeGame({ currentStrength: 3, directionWeights: [1, 0, 0, 0] })
    state = startPlayerTurns(state)
    const swan = animalsOf(state, 'swans')[0]
    put(state, state.animals.find((a) => a.id === swan.id)!, 0, 3)

    state = must(reachCurrentPhase(state), { type: 'resolve-current' })
    const lost = state.animals.find((a) => a.id === swan.id)!
    expect(lost.status).toBe('lost')
    // Lost is not finished, so it never reaches the scoreboard.
    expect(state.animals.filter((a) => a.status === 'finished')).toHaveLength(0)
  })

  it('leaves them at the edge when the rule says stop instead', () => {
    let state = makeGame({
      currentStrength: 2,
      directionWeights: [1, 0, 0, 0],
      tweak: (rules) => { rules.current.edgeBehaviour = 'stop-at-edge' },
    })
    state = startPlayerTurns(state)
    const swan = animalsOf(state, 'swans')[0]
    put(state, state.animals.find((a) => a.id === swan.id)!, 1, 3)

    state = must(reachCurrentPhase(state), { type: 'resolve-current' })
    const after = state.animals.find((a) => a.id === swan.id)!
    expect(after.status).not.toBe('lost')
    expect(after.col).toBe(0)
  })

  it('takes every faction over, at every strength, from the edge square itself', () => {
    // The case Cam kept seeing: already standing on the edge with the arrow pointing at it.
    for (const strength of [1, 2, 3, 4]) {
      for (const faction of ['ducks', 'swans', 'frogs', 'beavers'] as const) {
        let state = makeGame({ currentStrength: strength, directionWeights: [1, 0, 0, 0] })
        state = startPlayerTurns(state)
        const animal = animalsOf(state, faction)[0]
        put(state, state.animals.find((a) => a.id === animal.id)!, 0, 3)
        state = must(reachCurrentPhase(state), { type: 'resolve-current' })
        expect(
          state.animals.find((a) => a.id === animal.id)!.status,
          `${faction} on a current of ${strength}`,
        ).toBe('lost')
      }
    }
  })

  it('does not take an animal a dam, an island or an anchor is actually sheltering', () => {
    // Resistance only makes a push smaller, but these make an animal immune, and immunity
    // has to mean immunity or an anchor at the edge would be worthless.
    let state = makeGame({
      currentStrength: 3,
      directionWeights: [1, 0, 0, 0],
      islands: [{ col: 0, row: 3, size: 'small' }],
    })
    state = startPlayerTurns(state)
    const beaver = animalsOf(state, 'beavers')[0]
    put(state, state.animals.find((a) => a.id === beaver.id)!, 0, 3)

    state = must(reachCurrentPhase(state), { type: 'resolve-current' })
    expect(state.animals.find((a) => a.id === beaver.id)!.status).not.toBe('lost')
  })

  it('leaves still water alone at the edge', () => {
    let state = makeGame({ currentStrength: 0, directionWeights: [1, 0, 0, 0] })
    state = startPlayerTurns(state)
    const beaver = animalsOf(state, 'beavers')[0]
    put(state, state.animals.find((a) => a.id === beaver.id)!, 0, 3)

    state = must(reachCurrentPhase(state), { type: 'resolve-current' })
    expect(state.animals.find((a) => a.id === beaver.id)!.status).not.toBe('lost')
  })

  it('never lets a rope push an animal over the side', () => {
    const state = startPlayerTurns(makeGame())
    playerOf(state, 'ducks').equipment.rope = 1
    const mine = animalsOf(state, 'ducks')
    // Pulling the animal at B3 toward one sitting on the left edge must stop at the edge.
    put(state, state.animals.find((a) => a.id === mine[0].id)!, 0, 3)
    put(state, state.animals.find((a) => a.id === mine[1].id)!, 1, 3)

    const after = must(state, {
      type: 'use-rope', animalId: mine[1].id, towardAnimalId: mine[0].id,
    })
    expect(after.animals.find((a) => a.id === mine[1].id)!.status).not.toBe('lost')
  })

  it('takes a lost animal off the board for good', () => {
    let state = makeGame({ currentStrength: 2, directionWeights: [1, 0, 0, 0] })
    state = startPlayerTurns(state)
    const swan = animalsOf(state, 'swans')[0]
    put(state, state.animals.find((a) => a.id === swan.id)!, 1, 3)
    state = must(reachCurrentPhase(state), { type: 'resolve-current' })

    // It cannot be moved, and it does not block the square it drowned next to.
    expectRejected(state, { type: 'move-animal', animalId: swan.id, col: 0, row: 4 })
  })
})

describe('ranges counted in straight lines', () => {
  it('counts a diagonal as two steps, not one', () => {
    expect(orthogonalDistance({ col: 0, row: 0 }, { col: 1, row: 1 })).toBe(2)
    expect(orthogonalDistance({ col: 0, row: 0 }, { col: 3, row: 3 })).toBe(6)
    expect(orthogonalDistance({ col: 0, row: 0 }, { col: 3, row: 0 })).toBe(3)
  })

  it('leaves a diagonal corner outside a Distraction of radius 3', () => {
    let state = startPlayerTurns(makeGame())
    const swan = animalsOf(state, 'swans')[0]
    const frog = animalsOf(state, 'frogs')[0]
    // Three straight along is in range; two-and-two diagonally is four steps and is not.
    put(state, state.animals.find((a) => a.id === swan.id)!, 8, 4)
    put(state, state.animals.find((a) => a.id === frog.id)!, 7, 2)

    state = must(state, { type: 'play-distraction', col: 5, row: 4 })
    const caught = state.pendingDistraction!.rolls.map((r) => r.animalId)
    expect(caught).toContain(swan.id)
    expect(caught).not.toContain(frog.id)
  })

  it('measures the rope the same way', () => {
    const state = startPlayerTurns(makeGame())
    playerOf(state, 'ducks').equipment.rope = 1
    const mine = animalsOf(state, 'ducks')
    // Two across and two down is four steps, past a rope range of 3.
    put(state, state.animals.find((a) => a.id === mine[0].id)!, 4, 2)
    put(state, state.animals.find((a) => a.id === mine[1].id)!, 6, 4)

    const error = expectRejected(state, {
      type: 'use-rope', animalId: mine[1].id, towardAnimalId: mine[0].id,
    })
    expect(error).toMatch(/squares apart/)
  })
})

describe('dams hold the water either side', () => {
  it('calms its own square and both neighbours, and nothing above or below', () => {
    let state = makeGame({ currentStrength: 3 })
    state = startPlayerTurns(state)
    stockUp(state, 'ducks')
    state = must(state, { type: 'buy-equipment', item: 'dam' })
    state = must(state, { type: 'place-dam', col: 5, row: 4 })

    const duck = animalsOf(state, 'ducks')[0]
    const strengthAt = (col: number, row: number) => {
      put(state, state.animals.find((a) => a.id === duck.id)!, col, row)
      return assessCurrent(state, state.animals.find((a) => a.id === duck.id)!).effectiveStrength
    }

    expect(strengthAt(4, 4)).toBe(0)
    expect(strengthAt(5, 4)).toBe(0)
    expect(strengthAt(6, 4)).toBe(0)
    expect(strengthAt(5, 3)).toBe(3)
    expect(strengthAt(5, 5)).toBe(3)
  })
})

describe('trading', () => {
  const offerOf = (state: ReturnType<typeof makeGame>, toId: string): TradeProposal => ({
    id: 't1',
    fromPlayerId: playerOf(state, 'ducks').id,
    toPlayerId: toId,
    offer: { resources: { wood: 4, stone: 0, clay: 0, reeds: 0 }, cardInstanceIds: [] },
    request: { resources: { wood: 0, stone: 0, clay: 1, reeds: 0 }, cardCount: 0 },
    status: 'awaiting-reply',
  })

  it('values a resource an opponent is short of above one they are sitting on', () => {
    const state = makeGame()
    const swans = playerOf(state, 'swans')
    swans.resources = { wood: 9, stone: 0, clay: 0, reeds: 0 }
    const wood = valueGaining(state.rules, swans, { wood: 1, stone: 0, clay: 0, reeds: 0 })
    const stone = valueGaining(state.rules, swans, { wood: 0, stone: 1, clay: 0, reeds: 0 })
    expect(stone).toBeGreaterThan(wood)
  })

  it('will not trade away the last of something it still needs', () => {
    const state = makeGame()
    const swans = playerOf(state, 'swans')
    // Exactly the stone a dam needs and nothing spare, so it is not surplus to give away.
    swans.resources = { wood: 0, stone: 2, clay: 0, reeds: 0 }
    const verdict = judgeTrade(state, {
      id: 't2',
      fromPlayerId: playerOf(state, 'ducks').id,
      toPlayerId: swans.id,
      offer: { resources: { wood: 1, stone: 0, clay: 0, reeds: 0 }, cardInstanceIds: [] },
      request: { resources: { wood: 0, stone: 2, clay: 0, reeds: 0 }, cardCount: 0 },
      status: 'awaiting-reply',
    })
    expect(verdict.answer).not.toBe('accept')
  })

  it('takes a deal that is clearly in its favour', () => {
    const state = makeGame()
    const swans = playerOf(state, 'swans')
    swans.resources = { wood: 0, stone: 0, clay: 3, reeds: 0 }
    const verdict = judgeTrade(state, offerOf(state, swans.id))
    expect(verdict.answer).toBe('accept')
  })

  it('declines when it cannot spare what was asked for', () => {
    const state = makeGame()
    const swans = playerOf(state, 'swans')
    swans.resources = { wood: 0, stone: 0, clay: 0, reeds: 0 }
    const verdict = judgeTrade(state, offerOf(state, swans.id))
    expect(verdict.answer).toBe('decline')
  })

  it('names its own terms rather than refusing outright when it can', () => {
    let state = startPlayerTurns(makeGame())
    const ducks = playerOf(state, 'ducks')
    const swans = playerOf(state, 'swans')
    // The swans hold plenty of spare stone but need wood, so one wood is worth something
    // to them - just not the four stone that was asked for.
    ducks.resources = { wood: 1, stone: 0, clay: 0, reeds: 0 }
    swans.resources = { wood: 0, stone: 6, clay: 0, reeds: 0 }

    state = must(state, {
      type: 'propose-trade',
      toPlayerId: swans.id,
      offer: { resources: { wood: 1, stone: 0, clay: 0, reeds: 0 }, cardInstanceIds: [] },
      request: { resources: { wood: 0, stone: 6, clay: 0, reeds: 0 }, cardCount: 0 },
    })
    state = must(state, { type: 'answer-trade' })

    const trade = state.pendingTrade
    expect(trade?.status).toBe('countered')
    expect(trade?.counter).toBeDefined()
    // It offers some stone, but fewer than the six it was asked for.
    const offered = trade!.counter!.resources.stone
    expect(offered).toBeGreaterThan(0)
    expect(offered).toBeLessThan(6)

    // Taking the counter moves exactly those terms, not the original ask.
    state = must(state, { type: 'settle-trade', accept: true })
    expect(state.pendingTrade).toBeNull()
    expect(playerOf(state, 'ducks').resources.stone).toBe(offered)
    expect(playerOf(state, 'ducks').resources.wood).toBe(0)
  })

  it('leaves everything alone when a counter-offer is turned down', () => {
    let state = startPlayerTurns(makeGame())
    const ducks = playerOf(state, 'ducks')
    const swans = playerOf(state, 'swans')
    ducks.resources = { wood: 1, stone: 0, clay: 0, reeds: 0 }
    swans.resources = { wood: 0, stone: 6, clay: 0, reeds: 0 }

    state = must(state, {
      type: 'propose-trade',
      toPlayerId: swans.id,
      offer: { resources: { wood: 1, stone: 0, clay: 0, reeds: 0 }, cardInstanceIds: [] },
      request: { resources: { wood: 0, stone: 6, clay: 0, reeds: 0 }, cardCount: 0 },
    })
    state = must(state, { type: 'answer-trade' })
    state = must(state, { type: 'settle-trade', accept: false })

    expect(state.pendingTrade).toBeNull()
    expect(playerOf(state, 'ducks').resources).toMatchObject({ wood: 1, stone: 0 })
    expect(playerOf(state, 'swans').resources).toMatchObject({ wood: 0, stone: 6 })
  })

  it('moves the goods both ways when a trade is accepted', () => {
    let state = startPlayerTurns(makeGame())
    const ducks = playerOf(state, 'ducks')
    const swans = playerOf(state, 'swans')
    ducks.resources = { wood: 5, stone: 0, clay: 0, reeds: 0 }
    swans.resources = { wood: 0, stone: 0, clay: 4, reeds: 0 }

    state = must(state, {
      type: 'propose-trade',
      toPlayerId: swans.id,
      offer: { resources: { wood: 4, stone: 0, clay: 0, reeds: 0 }, cardInstanceIds: [] },
      request: { resources: { wood: 0, stone: 0, clay: 1, reeds: 0 }, cardCount: 0 },
    })
    state = must(state, { type: 'answer-trade' })

    expect(state.pendingTrade).toBeNull()
    expect(playerOf(state, 'ducks').resources).toMatchObject({ wood: 1, clay: 1 })
    expect(playerOf(state, 'swans').resources).toMatchObject({ wood: 4, clay: 3 })
  })

  it('refuses to offer what the proposer does not hold', () => {
    const state = startPlayerTurns(makeGame())
    const swans = playerOf(state, 'swans')
    playerOf(state, 'ducks').resources = { wood: 1, stone: 0, clay: 0, reeds: 0 }

    expectRejected(state, {
      type: 'propose-trade',
      toPlayerId: swans.id,
      offer: { resources: { wood: 9, stone: 0, clay: 0, reeds: 0 }, cardInstanceIds: [] },
      request: { resources: { wood: 0, stone: 0, clay: 1, reeds: 0 }, cardCount: 0 },
    })
  })

  it('holds everything else up until the trade is settled', () => {
    let state = startPlayerTurns(makeGame())
    const swans = playerOf(state, 'swans')
    playerOf(state, 'ducks').resources = { wood: 4, stone: 0, clay: 0, reeds: 0 }

    state = must(state, {
      type: 'propose-trade',
      toPlayerId: swans.id,
      offer: { resources: { wood: 4, stone: 0, clay: 0, reeds: 0 }, cardInstanceIds: [] },
      request: { resources: { wood: 0, stone: 0, clay: 1, reeds: 0 }, cardCount: 0 },
    })
    expectRejected(state, { type: 'end-turn' })

    state = must(state, { type: 'withdraw-trade' })
    expect(applyAction(state, { type: 'end-turn' }).ok).toBe(true)
  })

  it('allows only one offer a turn', () => {
    let state = startPlayerTurns(makeGame())
    const swans = playerOf(state, 'swans')
    const ducks = playerOf(state, 'ducks')
    ducks.resources = { wood: 8, stone: 0, clay: 0, reeds: 0 }
    swans.resources = { wood: 0, stone: 0, clay: 0, reeds: 0 }

    const offer = {
      type: 'propose-trade' as const,
      toPlayerId: swans.id,
      offer: { resources: { wood: 1, stone: 0, clay: 0, reeds: 0 }, cardInstanceIds: [] },
      request: { resources: { wood: 0, stone: 0, clay: 0, reeds: 0 }, cardCount: 0 },
    }
    state = must(state, offer)
    // The swans have nothing to give, so that one is declined and clears the table.
    state = must(state, { type: 'answer-trade' })
    expectRejected(state, offer)
  })
})
