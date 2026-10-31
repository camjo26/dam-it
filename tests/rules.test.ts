////////////////////////////////////////////////////////////////////////////////////////////////
// Core rules tests: movement, rounds, the current, equipment, factions, cards and scoring.
////////////////////////////////////////////////////////////////////////////////////////////////

import { describe, expect, it } from 'vitest'

import { playAiTurn } from '../src/game/ai'
import { assessCurrent } from '../src/game/current'
import { applyAction, equipmentCost } from '../src/game/engine'
import { scoreGame } from '../src/game/scoring'
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

describe('movement', () => {
  it('spends one movement point per square and stops at zero', () => {
    let state = startPlayerTurns(makeGame())
    const duck = animalsOf(state, 'ducks')[0]
    const ducks = playerOf(state, 'ducks')
    expect(ducks.movementRemaining).toBe(3)

    for (let i = 0; i < 3; i += 1) {
      const animal = state.animals.find((a) => a.id === duck.id)!
      state = must(state, { type: 'move-animal', animalId: duck.id, col: animal.col,
        row: animal.row + 1 })
    }

    expect(playerOf(state, 'ducks').movementRemaining).toBe(0)
    const animal = state.animals.find((a) => a.id === duck.id)!
    const error = expectRejected(state, { type: 'move-animal', animalId: duck.id,
      col: animal.col, row: animal.row + 1 })
    expect(error).toMatch(/movement/i)
  })

  it('rejects a move of more than one square', () => {
    const state = startPlayerTurns(makeGame())
    const duck = animalsOf(state, 'ducks')[0]
    const error = expectRejected(state, { type: 'move-animal', animalId: duck.id,
      col: duck.col, row: duck.row + 2 })
    expect(error).toMatch(/one square at a time/i)
  })

  it('rejects moving another player\'s animal', () => {
    const state = startPlayerTurns(makeGame())
    const swan = animalsOf(state, 'swans')[0]
    const error = expectRejected(state, { type: 'move-animal', animalId: swan.id,
      col: swan.col, row: swan.row + 1 })
    expect(error).toMatch(/not yours/i)
  })

  it('marks an animal finished when it reaches the far bank', () => {
    let state = startPlayerTurns(makeGame())
    const duck = animalsOf(state, 'ducks')[0]
    put(state, state.animals.find((a) => a.id === duck.id)!, 0, state.board.riverDepth)

    state = must(state, { type: 'move-animal', animalId: duck.id, col: 0,
      row: state.board.riverDepth + 1 })

    const moved = state.animals.find((a) => a.id === duck.id)!
    expect(moved.status).toBe('finished')
    expect(playerOf(state, 'ducks').stats.animalsFinished).toBe(1)
  })
})

describe('round progression', () => {
  it('runs resource, player turns and current in order, once each', () => {
    let state = makeGame()
    expect(state.phase).toBe('resource')
    expect(state.round).toBe(1)

    state = startPlayerTurns(state)
    expect(state.phase).toBe('player-turns')

    state = reachCurrentPhase(state)
    expect(state.phase).toBe('current')

    state = must(state, { type: 'resolve-current' })
    expect(state.round).toBe(2)
    expect(state.phase).toBe('resource')
  })

  it('refuses to resolve the Current Phase twice in one round', () => {
    let state = reachCurrentPhase(startPlayerTurns(makeGame()))
    state = must(state, { type: 'resolve-current' })
    // The game has moved on to round 2's Resource Phase, so another attempt is rejected.
    const error = expectRejected(state, { type: 'resolve-current' })
    expect(error).toMatch(/after every player has acted/i)
  })

  it('refuses to collect resources twice in one round', () => {
    const state = startPlayerTurns(makeGame())
    const error = expectRejected(state, { type: 'resolve-production' })
    expect(error).toMatch(/not in the resource phase/i)
  })

  it('ends after the configured number of rounds', () => {
    let state = makeGame({ tweak: (rules) => { rules.game.rounds = 2 } })
    for (let round = 0; round < 2; round += 1) {
      state = reachCurrentPhase(startPlayerTurns(state))
      state = must(state, { type: 'resolve-current' })
    }
    expect(state.phase).toBe('finished')
    expect(state.result).not.toBeNull()
  })
})

describe('the current', () => {
  it('pushes an animal downstream by the tile strength', () => {
    let state = makeGame({ currentStrength: 2 })
    state = startPlayerTurns(state)
    const frog = animalsOf(state, 'frogs')[0]
    put(state, state.animals.find((a) => a.id === frog.id)!, 1, 2)

    state = must(reachCurrentPhase(state), { type: 'resolve-current' })
    const moved = state.animals.find((a) => a.id === frog.id)!
    expect(moved.col).toBe(3)
    expect(moved.row).toBe(2)
  })

  it('does not move animals left on the top bank', () => {
    let state = makeGame({ currentStrength: 3 })
    state = reachCurrentPhase(startPlayerTurns(state))
    const before = state.animals.map((a) => `${a.col},${a.row}`)
    state = must(state, { type: 'resolve-current' })
    expect(state.animals.map((a) => `${a.col},${a.row}`)).toEqual(before)
  })

  it('stops at the edge rather than pushing an animal off the board', () => {
    let state = makeGame({ currentStrength: 4 })
    state = startPlayerTurns(state)
    const frog = animalsOf(state, 'frogs')[0]
    const lastCol = state.board.width - 1
    put(state, state.animals.find((a) => a.id === frog.id)!, lastCol - 1, 2)

    state = must(reachCurrentPhase(state), { type: 'resolve-current' })
    expect(state.animals.find((a) => a.id === frog.id)!.col).toBe(lastCol)
  })

  it('reveals a hidden current when an animal enters the tile', () => {
    let state = makeGame({ currentStrength: 3, visibleCurrents: 0 })
    state = startPlayerTurns(state)
    const duck = animalsOf(state, 'ducks')[0]

    const target = state.board.tiles.find((t) => t.col === duck.col && t.row === 1)!
    expect(target.hidden).toBe(true)
    expect(target.revealed).toBe(false)

    state = must(state, { type: 'move-animal', animalId: duck.id, col: duck.col, row: 1 })
    const after = state.board.tiles.find((t) => t.id === target.id)!
    expect(after.revealed).toBe(true)
  })

  it('resolves animals in a deterministic order', () => {
    const build = () => {
      let state = makeGame({ currentStrength: 1, seed: 'ORDER' })
      state = startPlayerTurns(state)
      for (const faction of ['ducks', 'swans', 'frogs', 'beavers'] as const) {
        const animal = animalsOf(state, faction)[0]
        put(state, state.animals.find((a) => a.id === animal.id)!, 2, 3)
      }
      return must(reachCurrentPhase(state), { type: 'resolve-current' })
    }
    const first = build().currentSteps.map((s) => s.animalId)
    const second = build().currentSteps.map((s) => s.animalId)
    expect(first).toEqual(second)
  })
})

describe('faction abilities', () => {
  it('Ducks ride the current one square further', () => {
    let state = makeGame({ currentStrength: 1 })
    state = startPlayerTurns(state)
    const duck = animalsOf(state, 'ducks')[0]
    const swan = animalsOf(state, 'swans')[0]
    put(state, state.animals.find((a) => a.id === duck.id)!, 0, 2)
    put(state, state.animals.find((a) => a.id === swan.id)!, 0, 3)

    state = must(reachCurrentPhase(state), { type: 'resolve-current' })
    // Current 1 plus the Go With the Flow bonus of 1.
    expect(state.animals.find((a) => a.id === duck.id)!.col).toBe(2)
  })

  it('Swans take one less from the current, never going negative', () => {
    let state = makeGame({ currentStrength: 1 })
    state = startPlayerTurns(state)
    const swan = animalsOf(state, 'swans')[0]
    put(state, state.animals.find((a) => a.id === swan.id)!, 0, 2)

    const assessment = assessCurrent(state, state.animals.find((a) => a.id === swan.id)!)
    expect(assessment.effectiveStrength).toBe(0)

    state = must(reachCurrentPhase(state), { type: 'resolve-current' })
    expect(state.animals.find((a) => a.id === swan.id)!.col).toBe(0)
  })

  it('Frogs get an extra action and cannot use anchors or ropes', () => {
    let state = startPlayerTurns(makeGame())
    // Ducks, swans then frogs.
    state = must(state, { type: 'end-turn' })
    state = must(state, { type: 'end-turn' })
    expect(playerOf(state, 'frogs').actionsRemaining).toBe(2)

    stockUp(state, 'frogs')
    const error = expectRejected(state, { type: 'buy-equipment', item: 'anchor' })
    expect(error).toMatch(/cannot use anchors/i)

    state = must(state, { type: 'buy-equipment', item: 'raft' })
    state = must(state, { type: 'buy-equipment', item: 'raft' })
    expect(playerOf(state, 'frogs').actionsRemaining).toBe(0)
    const third = expectRejected(state, { type: 'buy-equipment', item: 'raft' })
    expect(third).toMatch(/no actions left/i)
  })

  it('Beavers build for one resource less', () => {
    const state = makeGame()
    const beaverCost = equipmentCost(state.rules, 'beavers', 'dam')
    const duckCost = equipmentCost(state.rules, 'ducks', 'dam')
    const beaverTotal = Object.values(beaverCost).reduce((a, b) => a + b, 0)
    const duckTotal = Object.values(duckCost).reduce((a, b) => a + b, 0)
    expect(beaverTotal).toBe(duckTotal - 1)
    // The discount comes off the largest requirement, which is wood on a dam.
    expect(beaverCost.wood).toBe(duckCost.wood - 1)
  })
})

describe('equipment', () => {
  it('a dam calms its own square and the one either side, until it is destroyed', () => {
    let state = makeGame({ currentStrength: 3 })
    state = startPlayerTurns(state)
    stockUp(state, 'ducks')

    state = must(state, { type: 'buy-equipment', item: 'dam' })
    state = must(state, { type: 'place-dam', col: 4, row: 3 })

    const duck = animalsOf(state, 'ducks')[0]
    const at = (col: number, row: number) => {
      put(state, state.animals.find((a) => a.id === duck.id)!, col, row)
      return assessCurrent(state, state.animals.find((a) => a.id === duck.id)!).effectiveStrength
    }

    // The dam's own square and the squares left and right of it are all still.
    expect(at(4, 3)).toBe(0)
    expect(at(3, 3)).toBe(0)
    expect(at(5, 3)).toBe(0)

    // Two squares along is outside the calm radius of 1, and so is directly above it:
    // a dam holds the water back across the river, not up and down it.
    expect(at(6, 3)).toBe(3)
    expect(at(4, 2)).toBe(3)
  })

  it('the dam owner can bar one animal from its shelter each round', () => {
    let state = makeGame({ currentStrength: 3 })
    state = startPlayerTurns(state)
    stockUp(state, 'ducks')
    state = must(state, { type: 'buy-equipment', item: 'dam' })
    state = must(state, { type: 'place-dam', col: 4, row: 3 })

    const swan = animalsOf(state, 'swans')[0]
    put(state, state.animals.find((a) => a.id === swan.id)!, 4, 3)
    const damId = state.dams[0].id

    state = must(state, { type: 'set-dam-exclusion', damId, animalId: swan.id })
    const barred = assessCurrent(state, state.animals.find((a) => a.id === swan.id)!)
    // Swans still take one off, so 3 becomes 2 rather than 0.
    expect(barred.effectiveStrength).toBe(2)
  })

  it('destroying a dam sweeps the animals immediately downstream', () => {
    let state = makeGame({ currentStrength: 0 })
    state = startPlayerTurns(state)
    stockUp(state, 'ducks')
    state = must(state, { type: 'buy-equipment', item: 'dam' })
    state = must(state, { type: 'place-dam', col: 4, row: 3 })

    const frog = animalsOf(state, 'frogs')[0]
    put(state, state.animals.find((a) => a.id === frog.id)!, 5, 3)

    const damId = state.dams[0].id
    state = must(state, { type: 'end-turn' })
    state = must(state, { type: 'end-turn' })
    stockUp(state, 'frogs')
    state = must(state, { type: 'destroy-dam', damId })

    expect(state.dams).toHaveLength(0)
    expect(playerOf(state, 'frogs').stats.damsDestroyed).toBe(1)
    // Swept two squares downstream from column 5.
    expect(state.animals.find((a) => a.id === frog.id)!.col).toBe(7)
  })

  it('an anchor protects for one round and is then gone', () => {
    let state = makeGame({ currentStrength: 2 })
    state = startPlayerTurns(state)
    stockUp(state, 'ducks')

    const duck = animalsOf(state, 'ducks')[0]
    put(state, state.animals.find((a) => a.id === duck.id)!, 1, 2)
    state = must(state, { type: 'buy-equipment', item: 'anchor' })
    state = must(state, { type: 'use-anchor', animalId: duck.id })

    state = must(reachCurrentPhase(state), { type: 'resolve-current' })
    expect(state.animals.find((a) => a.id === duck.id)!.col).toBe(1)
    expect(state.animals.find((a) => a.id === duck.id)!.anchoredThroughRound).toBeNull()

    // Round two: no anchor, so the current and the duck bonus both apply.
    state = must(reachCurrentPhase(startPlayerTurns(state)), { type: 'resolve-current' })
    expect(state.animals.find((a) => a.id === duck.id)!.col).toBe(4)
  })

  it('a raft moves an animal forward without spending movement', () => {
    let state = startPlayerTurns(makeGame())
    stockUp(state, 'ducks')
    const duck = animalsOf(state, 'ducks')[0]

    state = must(state, { type: 'buy-equipment', item: 'raft' })
    const before = playerOf(state, 'ducks').movementRemaining
    state = must(state, { type: 'use-raft', animalId: duck.id })

    expect(state.animals.find((a) => a.id === duck.id)!.row).toBe(1)
    expect(playerOf(state, 'ducks').movementRemaining).toBe(before)
  })

  it('a rope pulls one animal toward another within range', () => {
    let state = startPlayerTurns(makeGame())
    stockUp(state, 'ducks')
    const [first, second] = animalsOf(state, 'ducks')
    put(state, state.animals.find((a) => a.id === first.id)!, 2, 1)
    put(state, state.animals.find((a) => a.id === second.id)!, 2, 4)

    state = must(state, { type: 'buy-equipment', item: 'rope' })
    state = must(state, { type: 'use-rope', animalId: first.id, towardAnimalId: second.id })

    expect(state.animals.find((a) => a.id === first.id)!.row).toBe(3)
  })
})

describe('whirlpools', () => {
  it('spins an animal left, right or forward and only once per phase', () => {
    let state = makeGame({
      currentStrength: 0,
      whirlpools: [{ col: 4, row: 3 }],
    })
    state = startPlayerTurns(state)
    const frog = animalsOf(state, 'frogs')[0]
    put(state, state.animals.find((a) => a.id === frog.id)!, 4, 3)

    state = must(reachCurrentPhase(state), { type: 'resolve-current' })
    const step = state.currentSteps.find((s) => s.animalId === frog.id)!
    expect(step.whirlpool).not.toBeNull()
    expect(['left', 'right', 'forward']).toContain(step.whirlpool!.direction)

    const moved = state.animals.find((a) => a.id === frog.id)!
    expect(moved.crossedWhirlpool).toBe(true)
    // One square in exactly one of the three directions.
    const distance = Math.abs(moved.col - 4) + Math.abs(moved.row - 3)
    expect(distance).toBe(1)
  })

  it('catches an animal dragged through one when the trigger is set that way', () => {
    // Current 3 carries the frog from B3 clean over the whirlpool at D3 and on to E3.
    const build = (trigger: 'end-of-current-move' | 'any-tile-entered') => {
      let state = makeGame({
        currentStrength: 3,
        whirlpools: [{ col: 3, row: 3 }],
        seed: 'DRAG',
        tweak: (rules) => {
          rules.whirlpool.trigger = trigger
          // Keep the duck bonus out of it so the distance is exactly the current.
          rules.factions.frogs.goWithTheFlowBonus = 0
        },
      })
      state = startPlayerTurns(state)
      const frog = animalsOf(state, 'frogs')[0]
      put(state, state.animals.find((a) => a.id === frog.id)!, 1, 3)
      state = must(reachCurrentPhase(state), { type: 'resolve-current' })
      return state.currentSteps.find((s) => s.animalId === frog.id)!
    }

    // Landing on E3, the whirlpool at D3 was only passed through.
    expect(build('end-of-current-move').whirlpool).toBeNull()
    expect(build('any-tile-entered').whirlpool).not.toBeNull()
  })

  it('is reproducible from the same seed', () => {
    const run = () => {
      let state = makeGame({ currentStrength: 0, whirlpools: [{ col: 4, row: 3 }],
        seed: 'SPIN' })
      state = startPlayerTurns(state)
      const frog = animalsOf(state, 'frogs')[0]
      put(state, state.animals.find((a) => a.id === frog.id)!, 4, 3)
      state = must(reachCurrentPhase(state), { type: 'resolve-current' })
      return state.currentSteps.find((s) => s.animalId === frog.id)!.whirlpool!.direction
    }
    expect(run()).toBe(run())
  })
})

describe('power cards', () => {
  it('costs resources, uses the action and goes into the hand', () => {
    let state = startPlayerTurns(makeGame())
    stockUp(state, 'ducks', 4)

    state = must(state, { type: 'buy-power-card' })
    const ducks = playerOf(state, 'ducks')
    expect(ducks.hand).toHaveLength(1)
    expect(ducks.actionsRemaining).toBe(0)
    expect(ducks.stats.powerCardsBought).toBe(1)
    // Four resources of any mix.
    const spent = Object.values(ducks.stats.resourcesSpent).reduce((a, b) => a + b, 0)
    expect(spent).toBe(4)
  })

  it('enforces one card per player per round', () => {
    let state = startPlayerTurns(makeGame())
    const ducks = playerOf(state, 'ducks')
    ducks.hand = [
      { instanceId: 'c1', cardId: 'tow' },
      { instanceId: 'c2', cardId: 'tow' },
    ]
    const duck = animalsOf(state, 'ducks')[0]

    state = must(state, { type: 'play-power-card', playerId: ducks.id, instanceId: 'c1',
      target: { animalId: duck.id } })
    const error = expectRejected(state, { type: 'play-power-card', playerId: ducks.id,
      instanceId: 'c2', target: { animalId: duck.id } })
    expect(error).toMatch(/per player per round/i)
  })

  it('refuses a card played outside its timing window', () => {
    const state = startPlayerTurns(makeGame())
    const ducks = playerOf(state, 'ducks')
    ducks.hand = [{ instanceId: 'c1', cardId: 'surge' }]
    const tile = state.board.tiles.find((t) => t.kind === 'river')!

    const error = expectRejected(state, { type: 'play-power-card', playerId: ducks.id,
      instanceId: 'c1', target: { tileId: tile.id } })
    expect(error).toMatch(/before the Current Phase/i)
  })

  it('refuses a card the player does not hold', () => {
    const state = startPlayerTurns(makeGame())
    const ducks = playerOf(state, 'ducks')
    const error = expectRejected(state, { type: 'play-power-card', playerId: ducks.id,
      instanceId: 'nope', target: {} })
    expect(error).toMatch(/do not hold/i)
  })

  it('Surge raises a tile current for one round only', () => {
    let state = makeGame({ currentStrength: 1 })
    state = startPlayerTurns(state)
    const frog = animalsOf(state, 'frogs')[0]
    put(state, state.animals.find((a) => a.id === frog.id)!, 1, 2)

    state = reachCurrentPhase(state)
    const ducks = playerOf(state, 'ducks')
    ducks.hand = [{ instanceId: 'c1', cardId: 'surge' }]
    const tile = state.board.tiles.find((t) => t.col === 1 && t.row === 2)!

    state = must(state, { type: 'play-power-card', playerId: ducks.id, instanceId: 'c1',
      target: { tileId: tile.id } })
    state = must(state, { type: 'resolve-current' })
    // Strength 1 plus the Surge of 2.
    expect(state.animals.find((a) => a.id === frog.id)!.col).toBe(4)

    // Next round the modifier is gone.
    state = must(reachCurrentPhase(startPlayerTurns(state)), { type: 'resolve-current' })
    expect(state.animals.find((a) => a.id === frog.id)!.col).toBe(5)
  })

  it('Current Shield makes an animal ignore the current for one phase', () => {
    let state = makeGame({ currentStrength: 3 })
    state = startPlayerTurns(state)
    const frog = animalsOf(state, 'frogs')[0]
    put(state, state.animals.find((a) => a.id === frog.id)!, 1, 2)

    state = reachCurrentPhase(state)
    const frogs = playerOf(state, 'frogs')
    frogs.hand = [{ instanceId: 'c1', cardId: 'current-shield' }]
    state = must(state, { type: 'play-power-card', playerId: frogs.id, instanceId: 'c1',
      target: { animalId: frog.id } })

    state = must(state, { type: 'resolve-current' })
    expect(state.animals.find((a) => a.id === frog.id)!.col).toBe(1)
  })
})

describe('missions and roles', () => {
  it('scores a completed mission', () => {
    let state = makeGame({ tweak: (rules) => { rules.roles.enabled = false } })
    const ducks = playerOf(state, 'ducks')
    ducks.missionId = 'builder'
    ducks.stats.structuresBuilt = 2

    state = startPlayerTurns(state)
    state = must(reachCurrentPhase(state), { type: 'resolve-current' })

    const result = scoreGame(state)
    const breakdown = result.breakdowns.find((b) => b.playerId === ducks.id)!
    expect(breakdown.missionComplete).toBe(true)
    expect(breakdown.missionPoints).toBe(4)
  })

  it('does not score Resourceful if the resources were spent again', () => {
    const state = makeGame({ tweak: (rules) => { rules.roles.enabled = false } })
    const ducks = playerOf(state, 'ducks')
    ducks.missionId = 'resourceful'

    ducks.resources = { wood: 1, stone: 1, clay: 1, reeds: 1 }
    expect(scoreGame(state).breakdowns.find((b) => b.playerId === ducks.id)!.missionComplete)
      .toBe(true)

    ducks.resources = { wood: 0, stone: 1, clay: 1, reeds: 1 }
    expect(scoreGame(state).breakdowns.find((b) => b.playerId === ducks.id)!.missionComplete)
      .toBe(false)
  })

  it('deals exactly one special role after the configured round', () => {
    let state = makeGame({ tweak: (rules) => {
      rules.game.rounds = 3
      // Roles are parked by default, so this switches the whole mechanic back on.
      rules.roles.enabled = true
      rules.roles.dealAfterRound = 2
    } })

    state = must(reachCurrentPhase(startPlayerTurns(state)), { type: 'resolve-current' })
    expect(state.rolesDealt).toBe(false)

    state = must(reachCurrentPhase(startPlayerTurns(state)), { type: 'resolve-current' })
    expect(state.rolesDealt).toBe(true)

    const special = state.players.filter((p) => p.roleId !== 'none' && p.roleId !== null)
    expect(special).toHaveLength(1)
    expect(['saboteur', 'hoarder', 'champion']).toContain(special[0].roleId)
  })

  it('pays the Champion only on a unique lead and enough animals across', () => {
    const state = makeGame({ tweak: (rules) => { rules.roles.enabled = true } })
    const ducks = playerOf(state, 'ducks')
    const swans = playerOf(state, 'swans')
    ducks.roleId = 'champion'
    for (const player of state.players) player.missionId = null

    const across = (playerId: string, count: number) => {
      const owned = state.animals.filter((a) => a.playerId === playerId)
      owned.forEach((a, i) => { a.status = i < count ? 'finished' : 'bank' })
    }

    // One animal across is below the minimum of two.
    across(ducks.id, 1)
    expect(scoreGame(state).breakdowns.find((b) => b.playerId === ducks.id)!.roleBonus).toBe(0)

    // Three across but tied with the swans, so no outright lead.
    across(ducks.id, 3)
    across(swans.id, 3)
    expect(scoreGame(state).breakdowns.find((b) => b.playerId === ducks.id)!.roleBonus).toBe(0)

    // A clear lead pays out.
    across(swans.id, 2)
    expect(scoreGame(state).breakdowns.find((b) => b.playerId === ducks.id)!.roleBonus).toBe(6)
  })

  it('pays the Hoarder only on a unique resource lead', () => {
    const state = makeGame({ tweak: (rules) => { rules.roles.enabled = true } })
    const ducks = playerOf(state, 'ducks')
    ducks.roleId = 'hoarder'
    for (const player of state.players) player.missionId = null
    state.animals
      .filter((a) => a.playerId === ducks.id)
      .forEach((a, i) => { if (i < 2) a.status = 'finished' })

    ducks.resources = { wood: 5, stone: 0, clay: 0, reeds: 0 }
    playerOf(state, 'swans').resources = { wood: 5, stone: 0, clay: 0, reeds: 0 }
    expect(scoreGame(state).breakdowns.find((b) => b.playerId === ducks.id)!.roleBonus).toBe(0)

    ducks.resources = { wood: 6, stone: 0, clay: 0, reeds: 0 }
    expect(scoreGame(state).breakdowns.find((b) => b.playerId === ducks.id)!.roleBonus).toBe(6)
  })
})

describe('scoring', () => {
  it('adds animals, mission and role together and reports a tie', () => {
    const state = makeGame({ tweak: (rules) => { rules.roles.enabled = false } })
    for (const player of state.players) player.missionId = null

    const setAcross = (playerId: string, count: number) => {
      state.animals
        .filter((a) => a.playerId === playerId)
        .forEach((a, i) => { a.status = i < count ? 'finished' : 'bank' })
    }
    setAcross(state.players[0].id, 4)
    setAcross(state.players[1].id, 4)
    setAcross(state.players[2].id, 1)
    setAcross(state.players[3].id, 0)

    const result = scoreGame(state)
    expect(result.breakdowns[0].total).toBe(4)
    expect(result.winningPlayerIds).toHaveLength(2)
    expect(result.tieExplanation).toMatch(/shared win/i)
  })
})

describe('undo', () => {
  it('rewinds a move but not a face-down card draw', () => {
    let state = startPlayerTurns(makeGame())
    const duck = animalsOf(state, 'ducks')[0]

    state = must(state, { type: 'move-animal', animalId: duck.id, col: duck.col,
      row: duck.row + 1 })
    expect(playerOf(state, 'ducks').movementRemaining).toBe(2)

    state = must(state, { type: 'undo' })
    expect(playerOf(state, 'ducks').movementRemaining).toBe(3)
    expect(state.animals.find((a) => a.id === duck.id)!.row).toBe(0)

    stockUp(state, 'ducks', 4)
    state = must(state, { type: 'buy-power-card' })
    const error = expectRejected(state, { type: 'undo' })
    expect(error).toMatch(/nothing to undo/i)
  })
})

describe('AI', () => {
  it('ends its turn without looping', () => {
    let state = startPlayerTurns(makeGame())
    const ducks = playerOf(state, 'ducks')
    ducks.controller = 'ai'
    stockUp(state, 'ducks')

    const result = playAiTurn(state, ducks.id)
    state = result.state
    expect(result.actions.length).toBeGreaterThan(0)
    expect(result.actions[result.actions.length - 1].type).toBe('end-turn')
  })

  it('never produces an illegal action', () => {
    let state = startPlayerTurns(makeGame())
    for (const player of state.players) player.controller = 'ai'

    // Replay the AI's chosen actions through the engine and check each one was accepted.
    const ducks = playerOf(state, 'ducks')
    const { actions } = playAiTurn(state, ducks.id)
    let replay = state
    for (const action of actions) {
      const applied = applyAction(replay, action)
      expect(applied.ok).toBe(true)
      if (applied.ok) replay = applied.state
    }
  })
})
