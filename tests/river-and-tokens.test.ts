////////////////////////////////////////////////////////////////////////////////////////////////
// The rules added in v0.03: per-tile current directions, a mostly face-down river, two
// collectors each, and Distraction tokens.
////////////////////////////////////////////////////////////////////////////////////////////////

import { describe, expect, it } from 'vitest'

import { assessCurrent } from '../src/game/current'
import { applyAction } from '../src/game/engine'
import { legalDestinations } from '../src/game/movement'
import { PRODUCTION_FEAST } from '../src/game/rules'
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

  it('blanks one area on exactly half the deck, and never without a glut', () => {
    const state = makeGame()
    const cards = state.rules.production.cards
    const copiesOf = (c: typeof cards[number]) => c.copies

    const withBlank = cards.filter((c) => Object.values(c.yields).some((n) => n === 0))
    const total = cards.reduce((sum, c) => sum + copiesOf(c), 0)
    const blanked = withBlank.reduce((sum, c) => sum + copiesOf(c), 0)
    expect(blanked * 2).toBe(total)

    for (const card of withBlank) {
      const amounts = Object.values(card.yields)
      // Exactly one blank, and a 4 somewhere to have earned it.
      expect(amounts.filter((n) => n === 0)).toHaveLength(1)
      expect(Math.max(...amounts)).toBeGreaterThanOrEqual(PRODUCTION_FEAST)
    }

    // And nothing anywhere is negative, however the deck is edited.
    for (const card of cards) {
      for (const amount of Object.values(card.yields)) {
        expect(amount).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('pays nothing for a collector standing on a blank area', () => {
    let state = makeGame({ tweak: (rules) => {
      // One card, one copy, so the draw is certain: stone pays nothing on it.
      rules.production.cards = [
        { id: 'only', name: 'Test Card', yields: { wood: 4, stone: 0, clay: 2, reeds: 1 },
          copies: 1 },
      ]
    } })
    for (const id of state.players.map((p) => p.id)) {
      while (state.players.find((p) => p.id === id)!.collectors.length < 2) {
        state = must(state, { type: 'place-collector', playerId: id, area: 'stone' })
      }
    }
    state = must(state, { type: 'resolve-production' })
    expect(playerOf(state, 'ducks').resources.stone).toBe(0)
  })
})

describe('four to a square', () => {
  it('refuses a step onto a square that already holds four', () => {
    let state = startPlayerTurns(makeGame())
    const ducks = animalsOf(state, 'ducks')
    // Fill D2 with four animals, then try to walk a fifth in from the square above.
    for (let i = 0; i < 4; i += 1) {
      put(state, state.animals.find((a) => a.id === ducks[i].id)!, 3, 2)
    }
    const fifth = ducks[4]
    put(state, state.animals.find((a) => a.id === fifth.id)!, 3, 1)

    expectRejected(state, { type: 'move-animal', animalId: fifth.id, col: 3, row: 2 })
    // And the square is not offered as a destination either.
    const legal = legalDestinations(state, state.animals.find((a) => a.id === fifth.id)!)
    expect(legal.some((l) => l.col === 3 && l.row === 2)).toBe(false)
  })

  it('does not limit the banks, where every animal starts stacked', () => {
    const state = makeGame()
    const topBank = state.animals.filter((a) => a.row === 0)
    expect(topBank.length).toBe(state.animals.length)
    const ducks = animalsOf(state, 'ducks')[0]
    // Walking back onto a crowded bank square stays legal.
    put(state, state.animals.find((a) => a.id === ducks.id)!, ducks.col, 1)
    const started = startPlayerTurns(state)
    const moved = applyAction(started, {
      type: 'move-animal', animalId: ducks.id, col: ducks.col, row: 0,
    })
    expect(moved.ok).toBe(true)
  })

  it('lets the current carry a whole stack past the limit', () => {
    // Every tile pushes left at strength 2, so a stack on the left edge is driven into it.
    let state = makeGame({ currentStrength: 2, directionWeights: [1, 0, 0, 0] })
    state = startPlayerTurns(state)
    const ducks = animalsOf(state, 'ducks')
    for (let i = 0; i < 4; i += 1) {
      put(state, state.animals.find((a) => a.id === ducks[i].id)!, 1, 3)
    }
    const swans = animalsOf(state, 'swans')
    for (let i = 0; i < 2; i += 1) {
      put(state, state.animals.find((a) => a.id === swans[i].id)!, 0, 3)
    }

    state = must(reachCurrentPhase(state), { type: 'resolve-current' })

    // All four ducks came over, and none was left behind because the edge was full.
    const onEdge = state.animals.filter((a) => a.col === 0 && a.row === 3)
    expect(onEdge.filter((a) => a.factionId === 'ducks')).toHaveLength(4)
    expect(onEdge.length).toBeGreaterThan(state.rules.board.maxAnimalsPerTile)
  })

  it('stops a rope short of a full square rather than stacking a fifth on it', () => {
    let state = startPlayerTurns(makeGame())
    playerOf(state, 'ducks').equipment.rope = 1
    const mine = animalsOf(state, 'ducks')
    // Four animals already on C3, and the rope is pulling a fifth toward them from E3.
    for (let i = 0; i < 4; i += 1) {
      put(state, state.animals.find((a) => a.id === mine[i].id)!, 2, 3)
    }
    put(state, state.animals.find((a) => a.id === mine[4].id)!, 4, 3)

    state = must(state, {
      type: 'use-rope', animalId: mine[4].id, towardAnimalId: mine[0].id,
    })
    // It closed the gap as far as it could and stopped on D3, next to the full square.
    const pulled = state.animals.find((a) => a.id === mine[4].id)!
    expect(pulled.col).toBe(3)
    expect(pulled.row).toBe(3)
  })

  it('refuses a rope with nowhere left to go, rather than overfilling the square', () => {
    const state = startPlayerTurns(makeGame())
    playerOf(state, 'ducks').equipment.rope = 1
    const mine = animalsOf(state, 'ducks')
    for (let i = 0; i < 4; i += 1) {
      put(state, state.animals.find((a) => a.id === mine[i].id)!, 2, 3)
    }
    // Already next to the full square, so the only square the rope could reach is full.
    put(state, state.animals.find((a) => a.id === mine[4].id)!, 3, 3)

    const error = expectRejected(state, {
      type: 'use-rope', animalId: mine[4].id, towardAnimalId: mine[0].id,
    })
    expect(error).toMatch(/full/)
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
