////////////////////////////////////////////////////////////////////////////////////////////////
// The opening screen: pick a mode, a faction, a difficulty and a seed, then start.
////////////////////////////////////////////////////////////////////////////////////////////////

import { useState } from 'react'

import { AI_OPPONENTS } from '../game/ai'
import { randomSeed } from '../game/rng'
import type { GameRules } from '../game/rules'
import type { PlayerSetup } from '../game/setup'
import type { AiDifficulty, FactionId } from '../game/types'
import { FACTION_IDS } from '../game/types'
import { VERSION } from '../version'

export type GameMode = 'solo' | 'hotseat' | 'watch'

export interface SetupScreenProps {
  rules: GameRules
  hasSavedGame: boolean
  onResume: () => void
  onStart: (seed: string, players: PlayerSetup[], difficulty: AiDifficulty) => void
  onOpenRules: () => void
  onOpenReference: () => void
}

const MODES: Array<{ id: GameMode; title: string; description: string }> = [
  {
    id: 'solo',
    title: 'Solo',
    description: 'You take one faction. Three computer opponents take the rest.',
  },
  {
    id: 'hotseat',
    title: 'Hot seat',
    description: 'Up to four people share this screen and take turns. Missions stay hidden.',
  },
  {
    id: 'watch',
    title: 'Watch the AI',
    description: 'Four computer players race each other. Useful for testing the balance.',
  },
]

export function SetupScreen({
  rules,
  hasSavedGame,
  onResume,
  onStart,
  onOpenRules,
  onOpenReference,
}: SetupScreenProps) {
  const [mode, setMode] = useState<GameMode>('solo')
  const [faction, setFaction] = useState<FactionId>('ducks')
  const [difficulty, setDifficulty] = useState<AiDifficulty>(rules.ai.difficulty)
  const [seed, setSeed] = useState(randomSeed())
  const [names, setNames] = useState<Record<FactionId, string>>({
    ducks: 'Ducks',
    swans: 'Swans',
    frogs: 'Frogs',
    beavers: 'Beavers',
  })

  const start = () => {
    const players: PlayerSetup[] = FACTION_IDS.map((id) => {
      const human =
        mode === 'hotseat' ? true : mode === 'solo' ? id === faction : false
      return {
        factionId: id,
        name: names[id] || rules.factions[id].name,
        controller: human ? ('human' as const) : ('ai' as const),
        aiDifficulty: difficulty,
      }
    })
    onStart(seed.trim() || randomSeed(), players, difficulty)
  }

  return (
    <div className="setup">
      <h1>DAM IT</h1>
      <div className="tagline">
        Cross the river. Outplay your rivals. Get the most across.
      </div>

      {hasSavedGame && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="body row">
            <div style={{ flex: 1 }}>
              <b>There is a game in progress.</b>
              <div className="faint">Starting a new game will replace it.</div>
            </div>
            <button className="btn good" onClick={onResume}>
              Resume
            </button>
          </div>
        </div>
      )}

      <div className="panel">
        <header>1. How do you want to play?</header>
        <div className="body">
          <div className="mode-grid">
            {MODES.map((m) => (
              <button
                key={m.id}
                className={`mode${mode === m.id ? ' selected' : ''}`}
                onClick={() => setMode(m.id)}
              >
                <div className="mode-title">{m.title}</div>
                <div className="mode-desc">{m.description}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {mode === 'solo' && (
        <div className="panel" style={{ marginTop: 12 }}>
          <header>2. Which faction are you?</header>
          <div className="body">
            <div className="mode-grid">
              {FACTION_IDS.map((id) => {
                const f = rules.factions[id]
                return (
                  <button
                    key={id}
                    className={`mode${faction === id ? ' selected' : ''}`}
                    onClick={() => setFaction(id)}
                  >
                    <div className="mode-title">
                      <span
                        className="swatch-lg"
                        style={{ background: f.colour }}
                      />
                      {f.name}
                    </div>
                    <div className="mode-desc">
                      {f.startingAnimals} animals, move {f.movementPoints}.
                      <br />
                      {describeAbility(id)}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {mode === 'hotseat' && (
        <div className="panel" style={{ marginTop: 12 }}>
          <header>2. Who is playing?</header>
          <div className="body">
            {FACTION_IDS.map((id) => (
              <div key={id} className="seat-row">
                <span>
                  <span
                    className="swatch-lg"
                    style={{ background: rules.factions[id].colour }}
                  />
                  {rules.factions[id].name}
                </span>
                <input
                  type="text"
                  value={names[id]}
                  placeholder={rules.factions[id].name}
                  onChange={(event) =>
                    setNames((current) => ({ ...current, [id]: event.target.value }))
                  }
                  style={{
                    background: '#0a1b28',
                    border: '1px solid var(--panel-line)',
                    color: 'var(--text)',
                    borderRadius: 6,
                    padding: '5px 8px',
                    font: 'inherit',
                  }}
                />
                <span className="faint">Human</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {mode !== 'hotseat' && (
        <div className="panel" style={{ marginTop: 12 }}>
          <header>3. Who are you up against?</header>
          <div className="body">
            <div className="mode-grid">
              {(['easy', 'normal', 'hard'] as AiDifficulty[]).map((level) => (
                <button
                  key={level}
                  className={`mode${difficulty === level ? ' selected' : ''}`}
                  onClick={() => setDifficulty(level)}
                >
                  <div className="mode-title" style={{ textTransform: 'capitalize' }}>
                    {level} - {AI_OPPONENTS[level].name}
                  </div>
                  <div className="mode-desc">{AI_OPPONENTS[level].style}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="panel" style={{ marginTop: 12 }}>
        <header>4. Seed</header>
        <div className="body row wrap">
          <input
            type="text"
            value={seed}
            onChange={(event) => setSeed(event.target.value.toUpperCase())}
            style={{
              background: '#0a1b28',
              border: '1px solid var(--panel-line)',
              color: 'var(--text)',
              borderRadius: 6,
              padding: '7px 10px',
              font: 'inherit',
              fontSize: 16,
              letterSpacing: '0.12em',
              width: 180,
            }}
          />
          <button className="btn" onClick={() => setSeed(randomSeed())}>
            New seed
          </button>
          <div className="faint" style={{ flex: 1, minWidth: 220 }}>
            The same seed always gives the same board, the same production cards and the same
            rolls. Quote it to replay an odd game.
          </div>
        </div>
      </div>

      <div className="row wrap" style={{ marginTop: 18, justifyContent: 'center' }}>
        <button className="btn primary" style={{ fontSize: 16, padding: '12px 28px' }}
          onClick={start}>
          Start a {rules.game.rounds} round game
        </button>
        <button className="btn" onClick={onOpenRules}>
          Rules editor
        </button>
        <button className="btn" onClick={onOpenReference}>
          How to play
        </button>
      </div>

      <div className="faint" style={{ textAlign: 'center', marginTop: 22 }}>
        Dam It playtest build v{VERSION}. Provisional rules are marked throughout and can all
        be changed in the rules editor.
      </div>
    </div>
  )
}

function describeAbility(id: FactionId): string {
  switch (id) {
    case 'ducks':
      return 'Go With the Flow: ride the current one extra square.'
    case 'swans':
      return 'The current affects them one less.'
    case 'frogs':
      return 'An extra action each turn, but no anchors or ropes.'
    case 'beavers':
      return 'Everything they build costs one resource less.'
  }
}
