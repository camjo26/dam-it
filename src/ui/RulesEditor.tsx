////////////////////////////////////////////////////////////////////////////////////////////////
// The rules editor.
//
// Driven entirely by RULE_SECTIONS, so a new tunable appears here as soon as it is added to
// the schema. Editing a game already in progress is allowed but warned about, because some
// changes cannot apply retrospectively to a board that is already laid out.
////////////////////////////////////////////////////////////////////////////////////////////////

import { useRef, useState } from 'react'

import { cloneRules, defaultRules, type GameRules } from '../game/rules'
import {
  FACTION_FIELDS,
  OPEN_QUESTIONS,
  RULE_SECTIONS,
  type RuleField,
} from '../game/rulesSchema'
import type { FactionId, ResourceBag, ResourceId } from '../game/types'
import { FACTION_IDS, RESOURCE_IDS, RESOURCE_LABELS } from '../game/types'
import { downloadJson } from '../state/storage'

export interface RulesEditorProps {
  rules: GameRules
  /** Set when a game is in progress, so mid-game changes can be warned about. */
  gameInProgress: boolean
  onApply: (rules: GameRules) => void
  onClose: () => void
  onStartNewGame: (rules: GameRules) => void
}

/** Changes that cannot take effect on a board that has already been built. */
const BOARD_SHAPE_PATHS = [
  'board.width',
  'board.riverDepth',
  'board.hiddenCurrentFraction',
]

function getAt(object: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => {
    if (value === null || typeof value !== 'object') return undefined
    return (value as Record<string, unknown>)[key]
  }, object)
}

function setAt(object: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.')
  let target = object
  for (let i = 0; i < parts.length - 1; i += 1) {
    const next = target[parts[i]]
    if (typeof next !== 'object' || next === null) return
    target = next as Record<string, unknown>
  }
  target[parts[parts.length - 1]] = value
}

export function RulesEditor({
  rules,
  gameInProgress,
  onApply,
  onClose,
  onStartNewGame,
}: RulesEditorProps) {
  const [draft, setDraft] = useState<GameRules>(() => cloneRules(rules))
  const [tab, setTab] = useState<string>(RULE_SECTIONS[0].id)
  const [touched, setTouched] = useState<string[]>([])
  const fileInput = useRef<HTMLInputElement>(null)

  const update = (path: string, value: unknown) => {
    setDraft((current) => {
      const next = cloneRules(current)
      setAt(next as unknown as Record<string, unknown>, path, value)
      return next
    })
    setTouched((current) => (current.includes(path) ? current : [...current, path]))
  }

  const shapeChanged = touched.some((path) => BOARD_SHAPE_PATHS.includes(path))

  const importRules = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Partial<GameRules>
        setDraft({ ...defaultRules(), ...parsed })
        setTouched(['imported'])
      } catch (error) {
        window.alert(`That file could not be read as rules JSON: ${(error as Error).message}`)
      }
    }
    reader.readAsText(file)
  }

  const tabs = [
    ...RULE_SECTIONS.map((s) => ({ id: s.id, title: s.title })),
    { id: 'factions', title: 'Factions' },
    { id: 'layout', title: 'Islands & whirlpools' },
    { id: 'cards', title: 'Power Cards' },
    { id: 'missions', title: 'Missions' },
    { id: 'productionCards', title: 'Production deck' },
    { id: 'questions', title: 'Open questions' },
  ]

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <header>
          <h2>Rules editor</h2>
          <span className="spacer" />
          <span className="badge-provisional badge-established">established</span>
          <span className="badge-provisional">provisional</span>
          <button className="btn ghost" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`tab${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.title}
            </button>
          ))}
        </div>

        <div className="body">
          {gameInProgress && touched.length > 0 && (
            <div className="error" style={{ marginBottom: 12 }}>
              <div>
                <b>A game is in progress.</b>{' '}
                {shapeChanged
                  ? 'You have changed the board size, which cannot be applied to a board ' +
                    'that is already laid out. Start a new game to use it.'
                  : 'Applying these changes mid-game affects everything from this point on, ' +
                    'not what has already happened.'}
              </div>
            </div>
          )}

          {RULE_SECTIONS.filter((s) => s.id === tab).map((section) => (
            <div key={section.id}>
              {section.blurb && <div className="hint" style={{ marginBottom: 10 }}>
                {section.blurb}
              </div>}
              {section.fields.map((field) => (
                <Field key={field.path} field={field} draft={draft} onChange={update} />
              ))}
            </div>
          ))}

          {tab === 'factions' && (
            <FactionTab draft={draft} onChange={update} />
          )}

          {tab === 'layout' && <LayoutTab draft={draft} setDraft={setDraft} />}

          {tab === 'cards' && <PowerCardTab draft={draft} setDraft={setDraft} />}

          {tab === 'missions' && <MissionTab draft={draft} setDraft={setDraft} />}

          {tab === 'productionCards' && (
            <ProductionTab draft={draft} setDraft={setDraft} />
          )}

          {tab === 'questions' && (
            <div>
              <div className="hint" style={{ marginBottom: 12 }}>
                These are the points where the brief and the printed components disagree, or
                where no rule exists yet. Each one has a working default so the game is
                playable, and each is editable above.
              </div>
              {OPEN_QUESTIONS.map((question) => (
                <div key={question.id} className="open-question">
                  <b>{question.question}</b>
                  <div style={{ marginTop: 4 }}>Currently: {question.current}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <footer>
          <button
            className="btn"
            onClick={() => {
              setDraft(defaultRules())
              setTouched(['reset'])
            }}
          >
            Restore defaults
          </button>
          <button
            className="btn"
            onClick={() => downloadJson('dam-it-rules.json', draft)}
          >
            Export JSON
          </button>
          <button className="btn" onClick={() => fileInput.current?.click()}>
            Import JSON
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) importRules(file)
              event.target.value = ''
            }}
          />
          <span style={{ flex: 1 }} />
          <button className="btn" onClick={() => onApply(draft)}>
            Save rules
          </button>
          <button className="btn primary" onClick={() => onStartNewGame(draft)}>
            Save and start a new game
          </button>
        </footer>
      </div>
    </div>
  )
}

////////////////////////////////////////////////////////////////////////////////////////////////

function Field({
  field,
  draft,
  onChange,
  valueOverride,
  pathOverride,
}: {
  field: RuleField
  draft: GameRules
  onChange: (path: string, value: unknown) => void
  valueOverride?: unknown
  pathOverride?: string
}) {
  const path = pathOverride ?? field.path
  const value = valueOverride ?? getAt(draft, path)

  return (
    <div className="field">
      <div>
        <div className="label">
          {field.label}
          <span
            className={`badge-provisional${
              field.status === 'established' ? ' badge-established' : ''
            }`}
          >
            {field.status}
          </span>
        </div>
        {field.note && <div className="note">{field.note}</div>}
      </div>
      <div>
        {field.type === 'number' && (
          <input
            type="number"
            value={Number(value ?? 0)}
            min={field.min}
            max={field.max}
            step={field.step ?? 1}
            onChange={(event) => onChange(path, Number(event.target.value))}
          />
        )}
        {field.type === 'boolean' && (
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => onChange(path, event.target.checked)}
          />
        )}
        {field.type === 'select' && (
          <select value={String(value)} onChange={(event) => onChange(path, event.target.value)}>
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}
        {field.type === 'resourceBag' && (
          <BagEditor
            bag={(value ?? {}) as ResourceBag}
            onChange={(next) => onChange(path, next)}
          />
        )}
      </div>
    </div>
  )
}

function BagEditor({
  bag,
  onChange,
}: {
  bag: ResourceBag
  onChange: (bag: ResourceBag) => void
}) {
  return (
    <div style={{ display: 'grid', gap: 3 }}>
      {RESOURCE_IDS.map((id: ResourceId) => (
        <div key={id} className="row" style={{ gap: 4 }}>
          <span className={`res ${id}`} style={{ minWidth: 62 }}>
            <span className="swatch" />
            {RESOURCE_LABELS[id]}
          </span>
          <input
            type="number"
            min={0}
            max={20}
            value={bag[id] ?? 0}
            style={{ width: 54 }}
            onChange={(event) =>
              onChange({ ...bag, [id]: Math.max(0, Number(event.target.value)) })
            }
          />
        </div>
      ))}
    </div>
  )
}

////////////////////////////////////////////////////////////////////////////////////////////////

function FactionTab({
  draft,
  onChange,
}: {
  draft: GameRules
  onChange: (path: string, value: unknown) => void
}) {
  return (
    <div>
      <div className="hint" style={{ marginBottom: 12 }}>
        Every faction has the same set of numbers. An ability is just a non-zero value, so you
        can give any faction any ability, or take one away by setting it to zero.
      </div>
      {FACTION_IDS.map((factionId: FactionId) => (
        <div key={factionId}>
          <div className="section-title">
            <span
              className="swatch-lg"
              style={{ background: draft.factions[factionId].colour }}
            />
            {draft.factions[factionId].name}
          </div>
          {FACTION_FIELDS.map((field) => (
            <Field
              key={`${factionId}.${field.path}`}
              field={field}
              draft={draft}
              onChange={onChange}
              pathOverride={`factions.${factionId}.${field.path}`}
            />
          ))}
          <div className="field">
            <div>
              <div className="label">
                Cannot use
                <span className="badge-provisional badge-established">established</span>
              </div>
              <div className="note">Frogs cannot use anchors or ropes.</div>
            </div>
            <div className="row wrap">
              {(['anchor', 'rope', 'raft', 'dam'] as const).map((item) => {
                const forbidden = draft.factions[factionId].forbiddenEquipment.includes(item)
                return (
                  <button
                    key={item}
                    className={`btn tiny${forbidden ? ' danger' : ' ghost'}`}
                    onClick={() => {
                      const list = draft.factions[factionId].forbiddenEquipment
                      const next = forbidden
                        ? list.filter((i) => i !== item)
                        : [...list, item]
                      onChange(`factions.${factionId}.forbiddenEquipment`, next)
                    }}
                  >
                    {item}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

////////////////////////////////////////////////////////////////////////////////////////////////

function LayoutTab({
  draft,
  setDraft,
}: {
  draft: GameRules
  setDraft: (updater: (current: GameRules) => GameRules) => void
}) {
  const edit = (change: (rules: GameRules) => void) => {
    setDraft((current) => {
      const next = cloneRules(current)
      change(next)
      return next
    })
  }

  const maxRow = draft.board.riverDepth
  const maxCol = draft.board.width - 1

  return (
    <div>
      <div className="hint" style={{ marginBottom: 12 }}>
        Columns are numbered from 0 on the left. Rows are numbered from 1, the first row of
        water below the top bank, to {maxRow}, the last row before the far bank. The brief asks
        for exactly four islands; the printed starter map draws five.
      </div>

      <div className="section-title">Islands ({draft.board.islands.length})</div>
      {draft.board.islands.map((island, index) => (
        <div key={index} className="row" style={{ marginBottom: 6 }}>
          <span className="faint" style={{ width: 24 }}>{index + 1}</span>
          <label className="faint">col</label>
          <input
            type="number"
            min={0}
            max={maxCol}
            value={island.col}
            style={{ width: 60 }}
            onChange={(event) =>
              edit((r) => {
                r.board.islands[index].col = Number(event.target.value)
              })
            }
          />
          <label className="faint">row</label>
          <input
            type="number"
            min={1}
            max={maxRow}
            value={island.row}
            style={{ width: 60 }}
            onChange={(event) =>
              edit((r) => {
                r.board.islands[index].row = Number(event.target.value)
              })
            }
          />
          <select
            value={island.size}
            onChange={(event) =>
              edit((r) => {
                r.board.islands[index].size = event.target.value as 'small' | 'large'
              })
            }
          >
            <option value="small">small</option>
            <option value="large">large</option>
          </select>
          <button
            className="btn tiny danger"
            onClick={() => edit((r) => { r.board.islands.splice(index, 1) })}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        className="btn small"
        onClick={() => edit((r) => { r.board.islands.push({ col: 0, row: 1, size: 'small' }) })}
      >
        Add island
      </button>

      <div className="section-title">Whirlpools ({draft.board.whirlpools.length})</div>
      {draft.board.whirlpools.map((whirlpool, index) => (
        <div key={index} className="row" style={{ marginBottom: 6 }}>
          <span className="faint" style={{ width: 24 }}>{index + 1}</span>
          <label className="faint">col</label>
          <input
            type="number"
            min={0}
            max={maxCol}
            value={whirlpool.col}
            style={{ width: 60 }}
            onChange={(event) =>
              edit((r) => { r.board.whirlpools[index].col = Number(event.target.value) })
            }
          />
          <label className="faint">row</label>
          <input
            type="number"
            min={1}
            max={maxRow}
            value={whirlpool.row}
            style={{ width: 60 }}
            onChange={(event) =>
              edit((r) => { r.board.whirlpools[index].row = Number(event.target.value) })
            }
          />
          <button
            className="btn tiny danger"
            onClick={() => edit((r) => { r.board.whirlpools.splice(index, 1) })}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        className="btn small"
        onClick={() => edit((r) => { r.board.whirlpools.push({ col: 0, row: 1 }) })}
      >
        Add whirlpool
      </button>

      <div className="section-title">Current strength mix</div>
      <div className="hint" style={{ marginBottom: 10 }}>
        Relative weights for rolling each river tile. The defaults come from the printed tile
        sheet, where strength 4 appears once against 46 plain tiles, which is what makes it
        rare.
      </div>
      {draft.board.currentStrengthWeights.map((weight, strength) => {
        const total = draft.board.currentStrengthWeights.reduce((a, b) => a + b, 0)
        const share = total > 0 ? Math.round((weight / total) * 100) : 0
        return (
          <div key={strength} className="row" style={{ marginBottom: 6 }}>
            <span style={{ width: 90, fontSize: 13 }}>
              Strength {strength}
            </span>
            <input
              type="number"
              min={0}
              max={200}
              value={weight}
              style={{ width: 70 }}
              onChange={(event) =>
                edit((r) => {
                  r.board.currentStrengthWeights[strength] = Math.max(
                    0,
                    Number(event.target.value),
                  )
                })
              }
            />
            <div className="meter" style={{ flex: 1 }}>
              <span style={{ width: `${share}%` }} />
            </div>
            <span className="faint" style={{ width: 40 }}>{share}%</span>
          </div>
        )
      })}
    </div>
  )
}

////////////////////////////////////////////////////////////////////////////////////////////////

function PowerCardTab({
  draft,
  setDraft,
}: {
  draft: GameRules
  setDraft: (updater: (current: GameRules) => GameRules) => void
}) {
  const total = draft.powerCards.deck.reduce((sum, card) => sum + card.copies, 0)

  const edit = (index: number, change: (card: GameRules['powerCards']['deck'][0]) => void) => {
    setDraft((current) => {
      const next = cloneRules(current)
      change(next.powerCards.deck[index])
      return next
    })
  }

  return (
    <div>
      <div className="hint" style={{ marginBottom: 12 }}>
        {total} cards in the deck. Magnitude is the number inside the card text: squares moved,
        or strength added or removed. Setting copies to 0 takes a card out of the game.
      </div>
      {draft.powerCards.deck.map((card, index) => (
        <div key={card.id} className="shop-item">
          <div className="info">
            <div className="label">{card.name}</div>
            <div className="faint">{card.text}</div>
            <span className={`timing timing-${card.timing}`}>
              {card.timing === 'turn'
                ? 'During your turn'
                : card.timing === 'before-current'
                  ? 'Before the Current Phase'
                  : 'When a whirlpool resolves'}
            </span>
          </div>
          <div style={{ display: 'grid', gap: 4, width: 130 }}>
            <div className="row" style={{ gap: 4 }}>
              <span className="faint" style={{ width: 50 }}>copies</span>
              <input
                type="number"
                min={0}
                max={10}
                value={card.copies}
                style={{ width: 56 }}
                onChange={(event) =>
                  edit(index, (c) => { c.copies = Math.max(0, Number(event.target.value)) })
                }
              />
            </div>
            <div className="row" style={{ gap: 4 }}>
              <span className="faint" style={{ width: 50 }}>size</span>
              <input
                type="number"
                min={0}
                max={10}
                value={card.magnitude}
                style={{ width: 56 }}
                onChange={(event) =>
                  edit(index, (c) => { c.magnitude = Math.max(0, Number(event.target.value)) })
                }
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

////////////////////////////////////////////////////////////////////////////////////////////////

function MissionTab({
  draft,
  setDraft,
}: {
  draft: GameRules
  setDraft: (updater: (current: GameRules) => GameRules) => void
}) {
  const edit = (index: number, change: (m: GameRules['missions']['cards'][0]) => void) => {
    setDraft((current) => {
      const next = cloneRules(current)
      change(next.missions.cards[index])
      return next
    })
  }

  return (
    <div>
      <div className="hint" style={{ marginBottom: 12 }}>
        Target is the number the condition is measured against. Points are what the card is
        worth at the end of the game. Turning a mission off takes it out of the deck.
      </div>
      {draft.missions.cards.map((mission, index) => (
        <div key={mission.id} className="shop-item">
          <div className="info">
            <div className="label">{mission.name}</div>
            <div className="faint">{mission.text}</div>
            <div className="faint" style={{ marginTop: 2 }}>
              Condition: <code>{mission.check}</code>
            </div>
          </div>
          <div style={{ display: 'grid', gap: 4, width: 130 }}>
            <div className="row" style={{ gap: 4 }}>
              <span className="faint" style={{ width: 50 }}>target</span>
              <input
                type="number"
                min={0}
                max={30}
                value={mission.target}
                style={{ width: 56 }}
                onChange={(event) =>
                  edit(index, (m) => { m.target = Math.max(0, Number(event.target.value)) })
                }
              />
            </div>
            <div className="row" style={{ gap: 4 }}>
              <span className="faint" style={{ width: 50 }}>points</span>
              <input
                type="number"
                min={0}
                max={30}
                value={mission.points}
                style={{ width: 56 }}
                onChange={(event) =>
                  edit(index, (m) => { m.points = Math.max(0, Number(event.target.value)) })
                }
              />
            </div>
            <label className="row faint" style={{ gap: 4 }}>
              <input
                type="checkbox"
                checked={mission.enabled}
                onChange={(event) =>
                  edit(index, (m) => { m.enabled = event.target.checked })
                }
              />
              in deck
            </label>
          </div>
        </div>
      ))}
    </div>
  )
}

////////////////////////////////////////////////////////////////////////////////////////////////

function ProductionTab({
  draft,
  setDraft,
}: {
  draft: GameRules
  setDraft: (updater: (current: GameRules) => GameRules) => void
}) {
  const total = draft.production.cards.reduce((sum, card) => sum + card.copies, 0)

  const edit = (index: number, change: (c: GameRules['production']['cards'][0]) => void) => {
    setDraft((current) => {
      const next = cloneRules(current)
      change(next.production.cards[index])
      return next
    })
  }

  return (
    <div>
      <div className="hint" style={{ marginBottom: 12 }}>
        {total} cards. Each card says how much a collector standing in that area brings back.
        The whole deck is provisional: the brief says the production distribution is not
        settled.
      </div>
      {draft.production.cards.map((card, index) => (
        <div key={card.id} className="shop-item">
          <div className="info">
            <div className="label">{card.name}</div>
            <div className="cost">
              {RESOURCE_IDS.map((id) => (
                <span key={id} className="row" style={{ gap: 3 }}>
                  <span className={`res ${id}`} style={{ border: 'none', background: 'none' }}>
                    <span className="swatch" />
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={9}
                    value={card.yields[id]}
                    style={{ width: 46 }}
                    onChange={(event) =>
                      edit(index, (c) => {
                        c.yields[id] = Math.max(0, Number(event.target.value))
                      })
                    }
                  />
                </span>
              ))}
            </div>
          </div>
          <div className="row" style={{ gap: 4, width: 110 }}>
            <span className="faint">copies</span>
            <input
              type="number"
              min={0}
              max={10}
              value={card.copies}
              style={{ width: 52 }}
              onChange={(event) =>
                edit(index, (c) => { c.copies = Math.max(0, Number(event.target.value)) })
              }
            />
          </div>
        </div>
      ))}
    </div>
  )
}
