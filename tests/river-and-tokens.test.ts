////////////////////////////////////////////////////////////////////////////////////////////////
// The rules added in v0.03: per-tile current directions, a mostly face-down river, two
// collectors each, and Distraction tokens.
////////////////////////////////////////////////////////////////////////////////////////////////

import { describe, expect, it } from 'vitest'

import { assessCurrent } from '../src/game/current'
import {
  animalsOf,
  expectRejected,
  makeGame,
  must,
  playerOf,
  put,
  reachCurrentPhase,
  startPlayerTurns,
} from './helpers'

describe('tile directions', () => {
  it('pushes forward toward the far bank, and over it to score', () => {
    let state = makeGame({ currentStrength: 2, directionWeights: [0, 0, 1, 0] })
    state = startPlayerTurns(state)
    const duck = animalsOf(state, 'ducks')[0]
    const finishRow = state.board.riverDepth + 1
    put(state, state.animals.find((a) => a.id === duck.id)!, 3, finishRow - 2)

    state = must(reachCurrentPhase(state), { type: 'resolve-current' })
    expect(state.animals.find((a) => a.id === duck.id)!.status).toBe('finished')
  })

  it('pushes back toward the starting bank without going off the board', () => {
    let state = makeGame({ currentStrength: 3, directionWeights: [0, 0, 0, 1] })
    state = startPlayerTurns(state)
    // A swan rather than a duck, so the Ducks' extra square is not in the way.
    const swan = animalsOf(state, 'swans')[0]
    put(state, state.animals.find((a) => a.id === swan.id)!, 4, 2)

    state = must(reachCurrentPhase(state), { type: 'resolve-current' })
    const after = state.animals.find((a) => a.id === swan.id)!
    expect(after.row).toBe(0)
    expect(after.col).toBe(4)
    expect(after.status).toBe('bank')
  })

  it('never rolls forward or back at the sideways-only strength', () => {
    // Every weight is equal, so a forward or back tile would certainly appear if it could.
    const state = makeGame({ currentStrength: 4, directionWeights: [1, 1, 1, 1] })
    const flowing = state.board.tiles.filter((t) => t.kind === 'river' && t.current === 4)
    expect(flowing.length).toBeGreaterThan(0)
    for (const tile of flowing) {
      expect(['left', 'right']).toContain(tile.direction)
    }
  })

  it('still rolls forward and back below that strength', () => {
    const state = makeGame({ currentStrength: 2, directionWeights: [1, 1, 1, 1] })
    const directions = new Set(
      state.board.tiles.filter((t) => t.kind === 'river').map((t) => t.direction),
    )
    expect(directions.has('forward')).toBe(true)
    expect(directions.has('back')).toBe(true)
  })

  it('turns the tile own direction around with Redirect, whichever way it ran', () => {
    let state = makeGame({ currentStrength: 2, directionWeights: [0, 0, 0, 1] })
    state = startPlayerTurns(state)
    const duck = animalsOf(state, 'ducks')[0]
    put(state, state.animals.find((a) => a.id === duck.id)!, 5, 3)

    const ducks = playerOf(state, 'ducks')
    ducks.hand.push({ instanceId: 'redirect-1', cardId: 'redirect' })
    const tile = state.board.tiles.find((t) => t.col === 5 && t.row === 3)!
    expect(tile.direction).toBe('back')

    state = must(reachCurrentPhase(state), {
      type: 'play-power-card',
      playerId: ducks.id,
      instanceId: 'redirect-1',
      target: { tileId: tile.id },
    })

    const assessment = assessCurrent(state, state.animals.find((a) => a.id === duck.id)!)
    expect(assessment.direction).toBe('forward')
  })
})

describe('a mostly face-down river', () => {
  it('leaves exactly the configured number of currents face up', () => {
    const state = makeGame({ currentStrength: 2, visibleCurrents: 5 })
    const flowing = state.board.tiles.filter((t) => t.kind === 'river' && t.current > 0)
    expect(flowing.length).toBeGreaterThan(5)
    expect(flowing.filter((t) => !t.hidden)).toHaveLength(5)
  })

  it('never hides still water, an island or a whirlpool', () => {
    const state = makeGame({
      currentStrength: 2,
      visibleCurrents: 0,
      whirlpools: [{ col: 4, row: 3 }],
      islands: [{ col: 2, row: 2, size: 'small' }],
    })
    for (const tile of state.board.tiles) {
      if (tile.kind === 'river' && tile.current > 0) continue
      expect(tile.hidden).toBe(false)
    }
  })
})

describe('two collectors', () => {
  it('pays each collector separately, so stacking two doubles that area up', () => {
    let state = makeGame()
    const ducks = playerOf(state, 'ducks')
    const swans = playerOf(state, 'swans')

    state = must(state, { type: 'place-collector', playerId: ducks.id, area: 'clay' })
    state = must(state, { type: 'place-collector', playerId: ducks.id, area: 'clay' })
    state = must(state, { type: 'place-collector', playerId: swans.id, area: 'clay' })
    state = must(state, { type: 'place-collector', playerId: swans.id, area: 'wood' })
    // Re-read the player each time, because every action returns a fresh cloned state and
    // the reference taken before the loop would never see its own collectors go down.
    for (const id of state.players.map((p) => p.id)) {
      while (state.players.find((p) => p.id === id)!.collectors.length < 2) {
        state = must(state, { type: 'place-collector', playerId: id, area: 'reeds' })
      }
    }
    state = must(state, { type: 'resolve-production' })

    const card = state.rules.production.cards.find(
      (c) => c.id === state.production.lastRevealedCardId,
    )!
    expect(playerOf(state, 'ducks').resources.clay).toBe(card.yields.clay * 2)
    expect(playerOf(state, 'swans').resources.clay).toBe(card.yields.clay)
    expect(playerOf(state, 'swans').resources.wood).toBe(card.yields.wood)
  })

  it('refuses a third collector and allows one to be taken back', () => {
    let state = makeGame()
    const ducks = playerOf(state, 'ducks')
    state = must(state, { type: 'place-collector', playerId: ducks.id, area: 'wood' })
    state = must(state, { type: 'place-collector', playerId: ducks.id, area: 'stone' })
    expectRejected(state, { type: 'place-collector', playerId: ducks.id, area: 'clay' })

    state = must(state, { type: 'remove-collector', playerId: ducks.id, index: 0 })
    expect(playerOf(state, 'ducks').collectors).toEqual(['stone'])
  })

  it('pays every area at least one on every card in the deck', () => {
    const state = makeGame()
    for (const card of state.rules.production.cards) {
      for (const amount of Object.values(card.yields)) {
        expect(amount).toBeGreaterThanOrEqual(1)
      }
    }
  })
})

describe('distraction tokens', () => {
  it('rolls for every animal in range, the placer own animals included', () => {
    let state = startPlayerTurns(makeGame())
    const ducks = playerOf(state, 'ducks')
    const duck = animalsOf(state, 'ducks')[0]
    const swan = animalsOf(state, 'swans')[0]
    const frog = animalsOf(state, 'frogs')[0]

    put(state, state.animals.find((a) => a.id === duck.id)!, 5, 3)
    put(state, state.animals.find((a) => a.id === swan.id)!, 6, 4)
    // Well outside the radius of 3.
    put(state, state.animals.find((a) => a.id === frog.id)!, 0, 7)

    state = must(state, { type: 'play-distraction', col: 5, row: 4 })
    const pending = state.pendingDistraction!
    const ids = pending.rolls.map((r) => r.animalId)
    expect(ids).toContain(duck.id)
    expect(ids).toContain(swan.id)
    expect(ids).not.toContain(frog.id)
    expect(playerOf(state, 'ducks').distractionTokens).toBe(0)
    expect(pending.placerId).toBe(ducks.id)
  })

  it('makes Ducks the hardest faction to keep looking ahead', () => {
    let state = startPlayerTurns(makeGame())
    const duck = animalsOf(state, 'ducks')[0]
    const swan = animalsOf(state, 'swans')[0]
    put(state, state.animals.find((a) => a.id === duck.id)!, 5, 3)
    put(state, state.animals.find((a) => a.id === swan.id)!, 5, 3)

    state = must(state, { type: 'play-distraction', col: 5, row: 3 })
    const rolls = state.pendingDistraction!.rolls
    expect(rolls.find((r) => r.animalId === duck.id)!.neededRoll).toBe(6)
    expect(rolls.find((r) => r.animalId === swan.id)!.neededRoll).toBe(4)
  })

  it('drags a distracted animal toward the token, up to the chosen distance', () => {
    let state = startPlayerTurns(makeGame())
    const swan = animalsOf(state, 'swans')[0]
    put(state, state.animals.find((a) => a.id === swan.id)!, 8, 4)

    state = must(state, { type: 'play-distraction', col: 5, row: 4 })
    // Forced, so the drag itself is what is under test rather than the die.
    state.pendingDistraction!.rolls.find((r) => r.animalId === swan.id)!.distracted = true

    state = must(state, {
      type: 'resolve-distraction',
      moves: [{ animalId: swan.id, distance: 2 }],
    })
    const after = state.animals.find((a) => a.id === swan.id)!
    expect(after.col).toBe(6)
    expect(after.row).toBe(4)
    expect(state.pendingDistraction).toBeNull()
  })

  it('leaves an animal alone when the distance chosen is zero', () => {
    let state = startPlayerTurns(makeGame())
    const swan = animalsOf(state, 'swans')[0]
    put(state, state.animals.find((a) => a.id === swan.id)!, 8, 4)

    state = must(state, { type: 'play-distraction', col: 5, row: 4 })
    state.pendingDistraction!.rolls.find((r) => r.animalId === swan.id)!.distracted = true

    state = must(state, {
      type: 'resolve-distraction',
      moves: [{ animalId: swan.id, distance: 0 }],
    })
    expect(state.animals.find((a) => a.id === swan.id)!.col).toBe(8)
  })

  it('never drags an animal that kept its head', () => {
    let state = startPlayerTurns(makeGame())
    const swan = animalsOf(state, 'swans')[0]
    put(state, state.animals.find((a) => a.id === swan.id)!, 8, 4)

    state = must(state, { type: 'play-distraction', col: 5, row: 4 })
    state.pendingDistraction!.rolls.find((r) => r.animalId === swan.id)!.distracted = false

    state = must(state, {
      type: 'resolve-distraction',
      moves: [{ animalId: swan.id, distance: 3 }],
    })
    expect(state.animals.find((a) => a.id === swan.id)!.col).toBe(8)
  })

  it('blocks every other action until the drags have been chosen', () => {
    let state = startPlayerTurns(makeGame())
    state = must(state, { type: 'play-distraction', col: 5, row: 4 })
    expectRejected(state, { type: 'end-turn' })
  })

  it('gives each player one token and refuses a second play', () => {
    let state = startPlayerTurns(makeGame())
    expect(playerOf(state, 'ducks').distractionTokens).toBe(1)

    state = must(state, { type: 'play-distraction', col: 5, row: 4 })
    state = must(state, { type: 'resolve-distraction', moves: [] })
    expectRejected(state, { type: 'play-distraction', col: 6, row: 4 })
  })
})
