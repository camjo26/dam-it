////////////////////////////////////////////////////////////////////////////////////////////////
// The rules added in v0.07: the river bursting through a broken dam, the rope's longer reach
// and its choice of direction, the Ducks' one extra square, the square limit on a Distraction
// drag, and a computer opponent answering a trade on the spot.
////////////////////////////////////////////////////////////////////////////////////////////////

import { describe, expect, it } from 'vitest'

import { animalsOnTile } from '../src/game/movement'
import type { GameRules } from '../src/game/rules'
import type { DistractionRoll, GameState } from '../src/game/types'
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

/** Moves one animal one square forward, paying whatever movement that costs. */
function stepForward(state: GameState, animalId: string): GameState {
  const animal = state.animals.find((a) => a.id === animalId)!
  return must(state, {
    type: 'move-animal',
    animalId,
    col: animal.col,
    row: animal.row + 1,
  })
}

function strengthAt(state: GameState, col: number, row: number): number {
  return state.board.tiles.find((t) => t.col === col && t.row === row)!.current
}

describe('a dam that is destroyed bursts', () => {
  it('brings every square it was calming up to the burst strength', () => {
    let state = makeGame({ currentStrength: 1 })
    state = startPlayerTurns(state)
    stockUp(state, 'ducks')
    state = must(state, { type: 'buy-equipment', item: 'dam' })
    state = must(state, { type: 'place-dam', col: 5, row: 4 })
    const damId = state.dams[0].id

    // The owner has spent their action, so the next player does the destroying.
    state = must(state, { type: 'end-turn' })
    stockUp(state, 'swans')
    state = must(state, { type: 'destroy-dam', damId })

    const burst = state.rules.dam.burstCurrent
    expect(strengthAt(state, 4, 4)).toBe(burst)
    expect(strengthAt(state, 5, 4)).toBe(burst)
    expect(strengthAt(state, 6, 4)).toBe(burst)
    // Above and below are nothing to do with it: the dam was never holding those.
    expect(strengthAt(state, 5, 3)).toBe(1)
    expect(strengthAt(state, 5, 5)).toBe(1)
  })

  it('shows the burst water face up, without anybody having to walk onto it', () => {
    let state = makeGame({ currentStrength: 1, visibleCurrents: 0 })
    state = startPlayerTurns(state)
    stockUp(state, 'ducks')
    state = must(state, { type: 'buy-equipment', item: 'dam' })
    state = must(state, { type: 'place-dam', col: 5, row: 4 })
    const damId = state.dams[0].id
    state = must(state, { type: 'end-turn' })
    stockUp(state, 'swans')
    state = must(state, { type: 'destroy-dam', damId })

    const tile = state.board.tiles.find((t) => t.col === 5 && t.row === 4)!
    expect(tile.revealed).toBe(true)
  })
})

describe('the rope', () => {
  it('reaches six squares, counted in straight lines', () => {
    const state = startPlayerTurns(makeGame())
    playerOf(state, 'ducks').equipment.rope = 1
    const mine = animalsOf(state, 'ducks')
    // Three across and three down is six steps, which is exactly the reach.
    put(state, state.animals.find((a) => a.id === mine[0].id)!, 1, 1)
    put(state, state.animals.find((a) => a.id === mine[1].id)!, 4, 4)

    const after = must(state, {
      type: 'use-rope',
      animalId: mine[0].id,
      towardAnimalId: mine[1].id,
    })
    // Six squares apart, so three of pull closes half of it.
    const pulled = after.animals.find((a) => a.id === mine[0].id)!
    expect(pulled.col + pulled.row).toBe(5)
  })

  it('spends its squares on whichever axis the player picks', () => {
    const state = startPlayerTurns(makeGame())
    playerOf(state, 'ducks').equipment.rope = 1
    const mine = animalsOf(state, 'ducks')
    put(state, state.animals.find((a) => a.id === mine[0].id)!, 1, 1)
    put(state, state.animals.find((a) => a.id === mine[1].id)!, 4, 4)

    const across = must(state, {
      type: 'use-rope',
      animalId: mine[0].id,
      towardAnimalId: mine[1].id,
      axis: 'across',
    })
    expect(across.animals.find((a) => a.id === mine[0].id)).toMatchObject({ col: 4, row: 1 })

    const along = must(state, {
      type: 'use-rope',
      animalId: mine[0].id,
      towardAnimalId: mine[1].id,
      axis: 'along',
    })
    expect(along.animals.find((a) => a.id === mine[0].id)).toMatchObject({ col: 1, row: 4 })
  })
})

describe('the Ducks move one animal an extra square', () => {
  it('is spent after the shared movement, and only by one animal', () => {
    let state = startPlayerTurns(makeGame())
    const [first, second] = animalsOf(state, 'ducks')
    expect(playerOf(state, 'ducks').bonusAnimalMoveRemaining).toBe(1)
    expect(playerOf(state, 'ducks').bonusAnimalId).toBeNull()

    // The three shared points go on one animal, and the extra square is still untouched.
    for (let i = 0; i < 3; i += 1) state = stepForward(state, second.id)
    expect(playerOf(state, 'ducks').movementRemaining).toBe(0)
    expect(playerOf(state, 'ducks').bonusAnimalMoveRemaining).toBe(1)
    expect(playerOf(state, 'ducks').bonusAnimalId).toBeNull()

    // Whichever animal spends it is named by the spending.
    state = stepForward(state, first.id)
    expect(playerOf(state, 'ducks').bonusAnimalId).toBe(first.id)
    expect(playerOf(state, 'ducks').bonusAnimalMoveRemaining).toBe(0)

    const error = expectRejected(state, {
      type: 'move-animal',
      animalId: second.id,
      col: second.col,
      row: 4,
    })
    expect(error).toMatch(/movement/i)
  })

  it('keeps it with the same animal in later rounds', () => {
    let state = startPlayerTurns(makeGame())
    const [first, second] = animalsOf(state, 'ducks')

    // Four squares on one animal: three shared, then the faction's extra.
    for (let i = 0; i < 4; i += 1) state = stepForward(state, first.id)
    expect(playerOf(state, 'ducks').bonusAnimalId).toBe(first.id)

    state = must(reachCurrentPhase(state), { type: 'resolve-current' })
    state = startPlayerTurns(state)
    expect(playerOf(state, 'ducks').bonusAnimalMoveRemaining).toBe(1)

    // A second animal cannot borrow it, however much the first one has left to do.
    for (let i = 0; i < 3; i += 1) state = stepForward(state, second.id)
    const held = state.animals.find((a) => a.id === second.id)!
    const error = expectRejected(state, {
      type: 'move-animal',
      animalId: second.id,
      col: held.col,
      row: held.row + 1,
    })
    expect(error).toMatch(/movement/i)

    // The animal it belongs to still has it.
    state = stepForward(state, first.id)
    expect(playerOf(state, 'ducks').bonusAnimalMoveRemaining).toBe(0)
  })

  it('lapses when the animal holding it leaves the board', () => {
    let state = startPlayerTurns(makeGame())
    const [first] = animalsOf(state, 'ducks')
    for (let i = 0; i < 4; i += 1) state = stepForward(state, first.id)
    expect(playerOf(state, 'ducks').bonusAnimalId).toBe(first.id)

    // Put it on the far bank, where it scores and leaves play.
    put(state, state.animals.find((a) => a.id === first.id)!, first.col, 8)
    state = must(reachCurrentPhase(state), { type: 'resolve-current' })
    state = startPlayerTurns(state)
    expect(playerOf(state, 'ducks').bonusAnimalId).toBeNull()
    expect(playerOf(state, 'ducks').bonusAnimalMoveRemaining).toBe(1)
  })
})

describe('a Distraction drag obeys the square limit', () => {
  const rollFor = (state: GameState, animalId: string): DistractionRoll => {
    const animal = state.animals.find((a) => a.id === animalId)!
    return {
      animalId,
      playerId: animal.playerId,
      factionId: animal.factionId,
      roll: 1,
      neededRoll: 4,
      distracted: true,
      movedSoFar: 0,
    }
  }

  /** Five animals exactly three squares from a token on F4, all of them looking away. */
  function fiveClosingIn(): { state: GameState; ids: string[] } {
    const state = startPlayerTurns(makeGame())
    const movers = animalsOf(state, 'swans').slice(0, 5)
    const spots: Array<[number, number]> = [[2, 4], [8, 4], [5, 1], [5, 7], [3, 3]]
    movers.forEach((animal, i) => {
      put(state, state.animals.find((a) => a.id === animal.id)!, spots[i][0], spots[i][1])
    })
    state.pendingDistraction = {
      placerId: playerOf(state, 'ducks').id,
      col: 5,
      row: 4,
      rolls: movers.map((animal) => rollFor(state, animal.id)),
    }
    return { state, ids: movers.map((a) => a.id) }
  }

  it('refuses the whole set rather than quietly stopping the last one short', () => {
    const { state, ids } = fiveClosingIn()
    const error = expectRejected(state, {
      type: 'resolve-distraction',
      moves: ids.map((animalId) => ({ animalId, distance: 3 })),
    })
    expect(error).toMatch(/4 animals fit on F4/)
    expect(error).toMatch(/Draw 1 of them in fewer squares/)
  })

  it('takes the same drags once one of them is told to stop short', () => {
    const { state, ids } = fiveClosingIn()
    const after = must(state, {
      type: 'resolve-distraction',
      moves: ids.map((animalId, i) => ({ animalId, distance: i === 4 ? 0 : 3 })),
    })
    expect(animalsOnTile(after, 5, 4)).toBe(4)
    expect(after.pendingDistraction).toBeNull()
  })

  it('still allows a drag onto a square the river has already overfilled', () => {
    // The current carries every animal standing on a tile, limit or no limit, so a square
    // can already hold five through nobody's choice. A drag that adds nothing to it has to
    // stay legal, or the player would be left with no legal answer at all.
    const state = startPlayerTurns(makeGame())
    const crowd = animalsOf(state, 'swans').slice(0, 5)
    for (const animal of crowd) {
      put(state, state.animals.find((a) => a.id === animal.id)!, 5, 4)
    }
    const walker = animalsOf(state, 'frogs')[0]
    put(state, state.animals.find((a) => a.id === walker.id)!, 2, 4)

    state.pendingDistraction = {
      placerId: playerOf(state, 'ducks').id,
      col: 5,
      row: 4,
      rolls: [...crowd.map((a) => rollFor(state, a.id)), rollFor(state, walker.id)],
    }

    const after = must(state, {
      type: 'resolve-distraction',
      moves: [
        ...crowd.map((a) => ({ animalId: a.id, distance: 0 })),
        { animalId: walker.id, distance: 2 },
      ],
    })
    expect(after.animals.find((a) => a.id === walker.id)).toMatchObject({ col: 4, row: 4 })
  })
})

describe('a computer opponent answers a trade on the spot', () => {
  function tradeWithAiSwans(): GameState {
    const state = startPlayerTurns(makeGame())
    playerOf(state, 'swans').controller = 'ai'
    playerOf(state, 'ducks').resources = { wood: 5, stone: 0, clay: 0, reeds: 0 }
    playerOf(state, 'swans').resources = { wood: 0, stone: 0, clay: 4, reeds: 0 }
    return state
  }

  const offer = {
    type: 'propose-trade' as const,
    toPlayerId: 'p2',
    offer: { resources: { wood: 4, stone: 0, clay: 0, reeds: 0 }, cardInstanceIds: [] },
    request: { resources: { wood: 0, stone: 0, clay: 1, reeds: 0 }, cardCount: 0 },
  }

  it('settles the deal inside the action that proposed it', () => {
    const state = tradeWithAiSwans()
    const after = must(state, { ...offer, toPlayerId: playerOf(state, 'swans').id })

    expect(after.pendingTrade).toBeNull()
    expect(playerOf(after, 'ducks').resources).toMatchObject({ wood: 1, clay: 1 })
    expect(after.tradeOutcome?.status).toBe('accepted')
    expect(after.tradeOutcome?.headline).toMatch(/Swans/)
    expect(after.tradeOutcome?.terms).toMatch(/4 Wood/)
  })

  it('clears the answer once it has been read', () => {
    const state = tradeWithAiSwans()
    let after = must(state, { ...offer, toPlayerId: playerOf(state, 'swans').id })
    expect(after.tradeOutcome).not.toBeNull()
    after = must(after, { type: 'dismiss-trade-outcome' })
    expect(after.tradeOutcome).toBeNull()
  })

  it('reports a refusal rather than leaving the offer on the table', () => {
    const state = tradeWithAiSwans()
    playerOf(state, 'swans').resources = { wood: 0, stone: 0, clay: 0, reeds: 0 }
    const after = must(state, { ...offer, toPlayerId: playerOf(state, 'swans').id })

    expect(after.pendingTrade).toBeNull()
    expect(after.tradeOutcome?.status).toBe('declined')
  })

  it('says nothing to anybody when two computer players are haggling', () => {
    const state = tradeWithAiSwans()
    playerOf(state, 'ducks').controller = 'ai'
    const after = must(state, { ...offer, toPlayerId: playerOf(state, 'swans').id })

    expect(after.tradeOutcome).toBeNull()
    expect(playerOf(after, 'ducks').resources).toMatchObject({ wood: 1, clay: 1 })
  })
})

describe('the animal with the extra square is never out of the current', () => {
  /** Names the Ducks' first animal by spending the shared pool and then the extra square. */
  function nameTheFastDuck(tweak?: (rules: GameRules) => void) {
    let state = startPlayerTurns(makeGame({ currentStrength: 2, tweak }))
    const ducks = animalsOf(state, 'ducks')
    stockUp(state, 'ducks')
    state = must(state, { type: 'buy-equipment', item: 'anchor' })
    for (let i = 0; i < 4; i += 1) state = stepForward(state, ducks[0].id)
    expect(playerOf(state, 'ducks').bonusAnimalId).toBe(ducks[0].id)
    return { state, ducks }
  }

  it('refuses an anchor on it', () => {
    const { state, ducks } = nameTheFastDuck()
    const error = expectRejected(state, { type: 'use-anchor', animalId: ducks[0].id })
    expect(error).toMatch(/never out of the current/)
  })

  it('still lets the rest of the flock be anchored', () => {
    const { state, ducks } = nameTheFastDuck()
    const after = must(state, { type: 'use-anchor', animalId: ducks[1].id })
    const settled = must(reachCurrentPhase(after), { type: 'resolve-current' })
    expect(settled.animals.find((a) => a.id === ducks[1].id)!.col).toBe(ducks[1].col)
  })

  it('is carried by the current even when it was anchored before it was named', () => {
    // The anchor goes on first and the animal is named afterwards, by spending the extra
    // square. Nothing can be protecting it by the time the river runs, however it got there.
    let state = startPlayerTurns(makeGame({ currentStrength: 2 }))
    const ducks = animalsOf(state, 'ducks')
    stockUp(state, 'ducks')
    state = must(state, { type: 'buy-equipment', item: 'anchor' })
    state = must(state, { type: 'use-anchor', animalId: ducks[0].id })
    for (let i = 0; i < 4; i += 1) state = stepForward(state, ducks[0].id)

    const before = state.animals.find((a) => a.id === ducks[0].id)!.col
    state = must(reachCurrentPhase(state), { type: 'resolve-current' })
    expect(state.animals.find((a) => a.id === ducks[0].id)!.col).toBe(before + 2)
  })

  it('takes the anchor again with the price switched off', () => {
    const { state, ducks } = nameTheFastDuck((rules) => {
      rules.factions.ducks.bonusAnimalUnprotected = false
    })
    const after = must(state, { type: 'use-anchor', animalId: ducks[0].id })
    const settled = must(reachCurrentPhase(after), { type: 'resolve-current' })
    const held = settled.animals.find((a) => a.id === ducks[0].id)!
    expect(held.col).toBe(after.animals.find((a) => a.id === ducks[0].id)!.col)
  })
})
