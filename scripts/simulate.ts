////////////////////////////////////////////////////////////////////////////////////////////////
// Headless balance simulator. The AI plays itself and the results are summed up.
//
// Usage: pnpm sim -- --games 200 --seed 1 [--difficulty normal] [--json out.json]
//                    [--set board.riverDepth=6] [--csv out.csv]
//   --games       number of games to play (default 100)
//   --seed        first seed; game i uses "<seed>-<i>" (default 1)
//   --difficulty  easy, normal or hard for every player (default normal)
//   --set         override a rule for this run, repeatable, value read as JSON
//   --json        write the per-game records to this file
//   --csv         write a per-faction summary table to this file
////////////////////////////////////////////////////////////////////////////////////////////////

import { writeFileSync } from 'node:fs'
import { playOutGame } from '../src/game/runner'
import { defaultRules, type GameRules } from '../src/game/rules'
import { createGame } from '../src/game/setup'
import { FACTION_IDS, type AiDifficulty, type FactionId, type GameState } from '../src/game/types'

const DEFAULT_GAMES = 100
const PERCENT = 100
const DECIMALS = 2

interface Options {
  games: number
  seed: string
  difficulty: AiDifficulty
  sets: string[]
  json?: string
  csv?: string
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    games: DEFAULT_GAMES,
    seed: '1',
    difficulty: 'normal',
    sets: [],
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]
    if (arg === '--games') { options.games = Number(next); i += 1 }
    else if (arg === '--seed') { options.seed = String(next); i += 1 }
    else if (arg === '--difficulty') { options.difficulty = next as AiDifficulty; i += 1 }
    else if (arg === '--set') { options.sets.push(String(next)); i += 1 }
    else if (arg === '--json') { options.json = String(next); i += 1 }
    else if (arg === '--csv') { options.csv = String(next); i += 1 }
  }
  return options
}

/** Applies a dotted-path override such as board.riverDepth=6 to the rules. */
function applySet(rules: GameRules, assignment: string): void {
  const index = assignment.indexOf('=')
  if (index < 0) throw new Error(`--set needs path=value, got "${assignment}"`)
  const path = assignment.slice(0, index)
  const raw = assignment.slice(index + 1)

  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    value = raw
  }

  const parts = path.split('.')
  let target: Record<string, unknown> = rules as unknown as Record<string, unknown>
  for (let i = 0; i < parts.length - 1; i += 1) {
    const nextTarget = target[parts[i]]
    if (typeof nextTarget !== 'object' || nextTarget === null) {
      throw new Error(`--set path "${path}" does not exist in the rules`)
    }
    target = nextTarget as Record<string, unknown>
  }
  const leaf = parts[parts.length - 1]
  if (!(leaf in target)) throw new Error(`--set path "${path}" does not exist in the rules`)
  target[leaf] = value
}

interface FactionTally {
  games: number
  wins: number
  sharedWins: number
  totalPoints: number
  animalPoints: number
  missionPoints: number
  rolePoints: number
  animalsAcross: number
  missionsComplete: number
  powerCardsBought: number
  powerCardsPlayed: number
  resourcesGained: number
  resourcesSpent: number
  structuresBuilt: number
  damsDestroyed: number
  currentMoves: number
}

function emptyTally(): FactionTally {
  return {
    games: 0, wins: 0, sharedWins: 0, totalPoints: 0, animalPoints: 0, missionPoints: 0,
    rolePoints: 0, animalsAcross: 0, missionsComplete: 0, powerCardsBought: 0,
    powerCardsPlayed: 0, resourcesGained: 0, resourcesSpent: 0, structuresBuilt: 0,
    damsDestroyed: 0, currentMoves: 0,
  }
}

function sumBag(bag: Record<string, number>): number {
  return Object.values(bag).reduce((total, n) => total + n, 0)
}

function recordGame(tallies: Record<FactionId, FactionTally>, state: GameState): void {
  const result = state.result
  if (!result) return
  const shared = result.winningPlayerIds.length > 1

  for (const breakdown of result.breakdowns) {
    const tally = tallies[breakdown.factionId]
    const player = state.players.find((p) => p.id === breakdown.playerId)
    tally.games += 1
    tally.totalPoints += breakdown.total
    tally.animalPoints += breakdown.animalPoints
    tally.missionPoints += breakdown.missionPoints
    tally.rolePoints += breakdown.roleBonus
    tally.animalsAcross += breakdown.animalsAcross
    if (breakdown.missionComplete) tally.missionsComplete += 1
    if (result.winningPlayerIds.includes(breakdown.playerId)) {
      if (shared) tally.sharedWins += 1
      else tally.wins += 1
    }
    if (player) {
      tally.powerCardsBought += player.stats.powerCardsBought
      tally.powerCardsPlayed += player.stats.powerCardsPlayed
      tally.resourcesGained += sumBag(player.stats.resourcesGained)
      tally.resourcesSpent += sumBag(player.stats.resourcesSpent)
      tally.structuresBuilt += player.stats.structuresBuilt
      tally.damsDestroyed += player.stats.damsDestroyed
      tally.currentMoves += player.stats.currentMovesSuffered
    }
  }
}

function round(value: number): number {
  return Number(value.toFixed(DECIMALS))
}

function main(): void {
  const options = parseArgs(process.argv.slice(2))
  const rules = defaultRules()
  for (const assignment of options.sets) applySet(rules, assignment)
  rules.ai.stepDelayMs = 0

  const tallies: Record<FactionId, FactionTally> = {
    ducks: emptyTally(), swans: emptyTally(), frogs: emptyTally(), beavers: emptyTally(),
  }
  const records: unknown[] = []
  let totalRounds = 0
  let failures = 0

  const started = Date.now()
  for (let i = 0; i < options.games; i += 1) {
    const seed = `${options.seed}-${i}`
    try {
      const fresh = createGame({
        rules,
        seed,
        players: FACTION_IDS.map((factionId) => ({
          factionId,
          name: rules.factions[factionId].name,
          controller: 'ai' as const,
          aiDifficulty: options.difficulty,
        })),
      })
      const finished = playOutGame(fresh)
      recordGame(tallies, finished)
      totalRounds += finished.round
      records.push({
        seed,
        rounds: finished.round,
        result: finished.result,
        logLength: finished.log.length,
      })
    } catch (error) {
      failures += 1
      console.error(`Seed ${seed} failed: ${(error as Error).message}`)
    }
  }

  const elapsed = Date.now() - started
  const played = options.games - failures

  console.log('')
  console.log(`Dam It balance run: ${played} games (${failures} failed), ` +
    `difficulty ${options.difficulty}, ${elapsed} ms`)
  if (options.sets.length > 0) console.log(`Overrides: ${options.sets.join(' ')}`)
  console.log(`Average rounds played: ${round(totalRounds / Math.max(1, played))}`)
  console.log('')

  const header = ['faction', 'win%', 'shared%', 'score', 'across', 'mission%', 'role',
    'cards', 'gained', 'spent', 'built', 'currents']
  console.log(header.map((h) => h.padStart(9)).join(''))

  for (const factionId of FACTION_IDS) {
    const t = tallies[factionId]
    const n = Math.max(1, t.games)
    const row = [
      factionId,
      round((t.wins / n) * PERCENT),
      round((t.sharedWins / n) * PERCENT),
      round(t.totalPoints / n),
      round(t.animalsAcross / n),
      round((t.missionsComplete / n) * PERCENT),
      round(t.rolePoints / n),
      round(t.powerCardsBought / n),
      round(t.resourcesGained / n),
      round(t.resourcesSpent / n),
      round(t.structuresBuilt / n),
      round(t.currentMoves / n),
    ]
    console.log(row.map((cell) => String(cell).padStart(9)).join(''))
  }
  console.log('')

  if (options.json) {
    writeFileSync(options.json, JSON.stringify({ options, tallies, records }, null, 2))
    console.log(`Wrote per-game records to ${options.json}`)
  }
  if (options.csv) {
    const lines = [header.join(',')]
    for (const factionId of FACTION_IDS) {
      const t = tallies[factionId]
      const n = Math.max(1, t.games)
      lines.push([
        factionId,
        round((t.wins / n) * PERCENT),
        round((t.sharedWins / n) * PERCENT),
        round(t.totalPoints / n),
        round(t.animalsAcross / n),
        round((t.missionsComplete / n) * PERCENT),
        round(t.rolePoints / n),
        round(t.powerCardsBought / n),
        round(t.resourcesGained / n),
        round(t.resourcesSpent / n),
        round(t.structuresBuilt / n),
        round(t.currentMoves / n),
      ].join(','))
    }
    writeFileSync(options.csv, lines.join('\n'))
    console.log(`Wrote the summary table to ${options.csv}`)
  }

  if (failures > 0) process.exitCode = 1
}

main()
