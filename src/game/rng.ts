////////////////////////////////////////////////////////////////////////////////////////////////
// Deterministic, serialisable random numbers.
//
// The generator is a pure function of (seed, counter). The counter lives in the game state, so
// saving and reloading a game reproduces exactly the same future rolls, and quoting a seed in a
// bug report is enough to replay the game that produced it.
////////////////////////////////////////////////////////////////////////////////////////////////

import type { RngState } from './types'

const HASH_OFFSET = 2166136261
const HASH_PRIME = 16777619
const MIX_A = 0x6d2b79f5
const MIX_B = 61
const UINT32 = 4294967296

function hashSeed(seed: string): number {
  let h = HASH_OFFSET
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, HASH_PRIME)
  }
  return h >>> 0
}

/** Mulberry32 applied to the seed hash mixed with the draw counter. */
function valueAt(seed: string, counter: number): number {
  let t = (hashSeed(seed) + Math.imul(counter + 1, MIX_A)) >>> 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | MIX_B)
  return ((t ^ (t >>> 14)) >>> 0) / UINT32
}

export function createRng(seed: string): RngState {
  return { seed, counter: 0 }
}

/**
 * A value in [0, 1) derived from the generator and a caller-supplied salt, without advancing
 * the counter. For decisions that must be reproducible but must not disturb the sequence of
 * rolls the game itself makes, such as the AI's tie-breaking noise.
 */
export function deriveFloat(rng: RngState, salt: number): number {
  return valueAt(rng.seed, rng.counter + salt * MIX_B)
}

/** Returns a float in [0, 1) and the advanced generator state. */
export function nextFloat(rng: RngState): [number, RngState] {
  const value = valueAt(rng.seed, rng.counter)
  return [value, { seed: rng.seed, counter: rng.counter + 1 }]
}

/** Returns an integer in [min, max] inclusive. */
export function nextInt(rng: RngState, min: number, max: number): [number, RngState] {
  const [value, next] = nextFloat(rng)
  const span = max - min + 1
  return [min + Math.floor(value * span), next]
}

/** Rolls a die with the given number of sides, returning 1..sides. */
export function rollDie(rng: RngState, sides: number): [number, RngState] {
  return nextInt(rng, 1, Math.max(1, Math.floor(sides)))
}

/** Picks an index from a list of non-negative weights. Returns -1 if every weight is zero. */
export function weightedIndex(rng: RngState, weights: number[]): [number, RngState] {
  const total = weights.reduce((sum, w) => sum + Math.max(0, w), 0)
  if (total <= 0) return [-1, rng]
  const [value, next] = nextFloat(rng)
  let threshold = value * total
  for (let i = 0; i < weights.length; i += 1) {
    threshold -= Math.max(0, weights[i])
    if (threshold < 0) return [i, next]
  }
  return [weights.length - 1, next]
}

export function pick<T>(rng: RngState, items: T[]): [T | undefined, RngState] {
  if (items.length === 0) return [undefined, rng]
  const [index, next] = nextInt(rng, 0, items.length - 1)
  return [items[index], next]
}

/** Fisher-Yates using the seeded generator. Returns a new array, leaving the input alone. */
export function shuffle<T>(rng: RngState, items: T[]): [T[], RngState] {
  const result = items.slice()
  let state = rng
  for (let i = result.length - 1; i > 0; i -= 1) {
    const [j, next] = nextInt(state, 0, i)
    state = next
    const swap = result[i]
    result[i] = result[j]
    result[j] = swap
  }
  return [result, state]
}

const SEED_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const SEED_LENGTH = 8

/** A short human-quotable seed, for example "K4M2PQ7T". */
export function randomSeed(): string {
  let out = ''
  for (let i = 0; i < SEED_LENGTH; i += 1) {
    out += SEED_ALPHABET[Math.floor(Math.random() * SEED_ALPHABET.length)]
  }
  return out
}
