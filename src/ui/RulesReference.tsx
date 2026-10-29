////////////////////////////////////////////////////////////////////////////////////////////////
// In-app rules reference.
//
// Splits the rules three ways, as the brief asks: what was given, what was chosen to make the
// prototype playable, and what still needs a decision. The printed components are included so
// the app can be checked against them.
////////////////////////////////////////////////////////////////////////////////////////////////

import { useState } from 'react'

import { CURRENT_ORDER_LABELS } from '../game/rules'
import type { GameRules } from '../game/rules'
import { OPEN_QUESTIONS, RULE_SECTIONS } from '../game/rulesSchema'
import { CHANGELOG, VERSION } from '../version'

export interface RulesReferenceProps {
  rules: GameRules
  onClose: () => void
}

type Tab = 'how' | 'order' | 'provisional' | 'questions' | 'components' | 'about'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'how', label: 'How to play' },
  { id: 'order', label: 'Current resolution order' },
  { id: 'provisional', label: 'Provisional rules' },
  { id: 'questions', label: 'Open questions' },
  { id: 'components', label: 'Printed components' },
  { id: 'about', label: 'About' },
]

export function RulesReference({ rules, onClose }: RulesReferenceProps) {
  const [tab, setTab] = useState<Tab>('how')

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <header>
          <h2>Dam It - rules reference</h2>
          <span className="spacer" />
          <button className="btn ghost" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`tab${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="body">
          {tab === 'how' && <HowToPlay rules={rules} />}
          {tab === 'order' && <ResolutionOrder rules={rules} />}
          {tab === 'provisional' && <ProvisionalList />}
          {tab === 'questions' && (
            <div>
              <div className="hint" style={{ marginBottom: 12 }}>
                Each of these has a working default so the game is playable. None of them is
                settled, and all are editable in the rules editor.
              </div>
              {OPEN_QUESTIONS.map((question) => (
                <div key={question.id} className="open-question">
                  <b>{question.question}</b>
                  <div style={{ marginTop: 4 }}>Currently: {question.current}</div>
                </div>
              ))}
            </div>
          )}
          {tab === 'components' && <Components />}
          {tab === 'about' && <About />}
        </div>
      </div>
    </div>
  )
}

function HowToPlay({ rules }: { rules: GameRules }) {
  return (
    <div>
      <div className="section-title">The aim</div>
      <ul className="rules-list">
        <li>
          You have <b>{rules.game.rounds} rounds</b> to get as many of your animals as you can
          from the top bank to the far bank.
        </li>
        <li>
          Each animal across is worth <b>{rules.scoring.pointsPerAnimalAcross} point</b>. Your
          secret mission is worth more. Highest total wins.
        </li>
      </ul>

      <div className="section-title">A round, in order</div>
      <ul className="rules-list">
        <li>
          <b>Phase A, Resources.</b> Everyone puts a collector in one of the four resource
          areas. A production card is then turned over and says what each area produces. You
          choose before you see the card.
        </li>
        <li>
          <b>Phase B, Player turns.</b> Each player takes one turn, in faction order. A turn is
          your movement points, split between your animals however you like, plus one action.
          Frogs get two actions.
        </li>
        <li>
          <b>Phase C, The Current.</b> Only after every player has acted. The river moves
          everything in the water, then whirlpools spin whoever is on them. Then the round ends.
        </li>
      </ul>

      <div className="section-title">Your one action</div>
      <ul className="rules-list">
        <li>Build a dam, raft, rope or anchor.</li>
        <li>Buy a Power Card, drawn face down for {rules.powerCards.cost} resources of any mix.</li>
        <li>Destroy somebody&apos;s dam.</li>
        <li>Play a Power Card that says it is played during your turn.</li>
      </ul>
      <p className="muted">
        Using equipment you already own is free by default, because buying it cost you the
        action. That is a provisional choice and can be changed.
      </p>

      <div className="section-title">The river</div>
      <ul className="rules-list">
        <li>
          Every river tile has a current strength from 0 to 4. Strength 4 is rare. Some
          currents start <b>hidden</b> and are revealed the moment an animal stands on them,
          and stay revealed.
        </li>
        <li>
          The current pushes animals <b>{rules.current.direction === 'right' ? 'to the right' :
            'to the left'}</b>, along the river. It never pushes them backward, so it costs
          position rather than progress.
        </li>
        <li>
          <b>Whirlpools</b> roll for left, right or forward, and affect each animal at most{' '}
          {rules.whirlpool.maxEffectsPerAnimalPerPhase} time per Current Phase.
        </li>
        <li>
          <b>Islands</b> are useful for position.{' '}
          {rules.board.islandsBlockCurrent
            ? 'In the current rules they also shelter an animal from the current.'
            : 'In the current rules they do not shelter an animal from the current.'}
        </li>
      </ul>

      <div className="section-title">Factions</div>
      <ul className="rules-list">
        <li>
          <b>Ducks</b> ({rules.factions.ducks.startingAnimals} animals) ride the current{' '}
          {rules.factions.ducks.goWithTheFlowBonus} extra square when it moves them.
        </li>
        <li>
          <b>Swans</b> ({rules.factions.swans.startingAnimals}) take{' '}
          {rules.factions.swans.currentResistance} less from every current, never below zero.
        </li>
        <li>
          <b>Frogs</b> ({rules.factions.frogs.startingAnimals}) get{' '}
          {rules.factions.frogs.actionsPerTurn} actions a turn but cannot use anchors or ropes.
        </li>
        <li>
          <b>Beavers</b> ({rules.factions.beavers.startingAnimals}) build everything for{' '}
          {rules.factions.beavers.buildDiscount} resource less.
        </li>
      </ul>

      <div className="section-title">Secret roles</div>
      <ul className="rules-list">
        <li>
          At the end of round {rules.roles.dealAfterRound}, exactly one player is dealt a
          special role: Saboteur, Hoarder or Champion. Everyone else gets an ordinary card.
        </li>
        <li>
          A role pays {rules.roles.bonusPoints} points, and always needs at least{' '}
          {rules.roles.minAnimalsAcross} animals across. The Hoarder also needs the most
          resources outright, the Champion the most animals across outright.
        </li>
        <li>Roles are revealed at the end of the last round.</li>
      </ul>
    </div>
  )
}

function ResolutionOrder({ rules }: { rules: GameRules }) {
  return (
    <div>
      <div className="hint" style={{ marginBottom: 12 }}>
        Conflicting effects are never quietly ignored. This is the order they are applied in,
        and it is what the log reports for every animal that moves.
      </div>

      <div className="section-title">Which animal moves first</div>
      <p className="muted">
        <b>{CURRENT_ORDER_LABELS[rules.current.resolutionOrder]}</b>. Ties always break by turn
        order, then by animal id, so the same seed always gives the same game.
      </p>

      <div className="section-title">What is applied to each animal, in order</div>
      <ol className="rules-list">
        <li>The base current strength of the tile it is standing on.</li>
        <li>
          Tile modifiers played this round: <b>Surge</b> adds, <b>Calm Water</b> subtracts,{' '}
          <b>Redirect</b> reverses the direction, and the Saboteur&apos;s ability adds.
        </li>
        <li>
          Islands. {rules.board.islandsBlockCurrent
            ? 'An animal on an island ignores the current entirely.'
            : 'Islands do not shelter in the current rules.'}
        </li>
        <li>
          Dams, which calm the water{' '}
          {rules.dam.calmAxis === 'vertical' ? 'above and below' : 'upstream and downstream'}{' '}
          within {rules.dam.calmRadius} square, unless the owner has barred that animal this
          round.
        </li>
        <li>An <b>Anchor</b>, then a <b>Current Shield</b>. Either makes the animal immune.</li>
        <li>Swan resistance, which never takes the strength below zero.</li>
        <li>The animal is pushed that many squares, stopping at the bank.</li>
        <li>
          Ducks then ride <b>one extra square</b>, but only if the current actually moved them,
          so the ability cannot trigger off a strength of zero or loop.
        </li>
        <li>
          Finally a whirlpool, at most{' '}
          {rules.whirlpool.maxEffectsPerAnimalPerPhase} per animal per phase. A Whirlpool card
          forces a single re-roll.
        </li>
      </ol>

      <div className="section-title">Guards</div>
      <ul className="rules-list">
        <li>The Current Phase cannot be resolved twice in a round.</li>
        <li>Resources cannot be collected twice in a round.</li>
        <li>
          An animal that reaches the far bank scores and is taken off the board, so nothing can
          move it or target it afterwards. That is the documented default and is not currently
          switchable.
        </li>
        <li>
          Undo is cleared the moment a hidden current is revealed or a face-down card is drawn,
          so it cannot be used to look and then take it back.
        </li>
      </ul>
    </div>
  )
}

function ProvisionalList() {
  const provisional = RULE_SECTIONS.flatMap((section) =>
    section.fields
      .filter((field) => field.status === 'provisional')
      .map((field) => ({ section: section.title, field })),
  )

  return (
    <div>
      <div className="hint" style={{ marginBottom: 12 }}>
        Rules chosen to make the prototype playable rather than given in the brief. Each one is
        deliberately simple and reversible, and every one is editable in the rules editor.
      </div>
      {provisional.map(({ section, field }) => (
        <div key={field.path} className="field">
          <div>
            <div className="label">
              {field.label}
              <span className="badge-provisional">provisional</span>
            </div>
            <div className="note">
              {section}
              {field.note ? ` - ${field.note}` : ''}
            </div>
          </div>
          <code className="faint">{field.path}</code>
        </div>
      ))}
    </div>
  )
}

function Components() {
  const images = [
    { src: 'rules/rules.jpg', label: 'Illustrated rules' },
    { src: 'rules/costs.jpg', label: 'Cost guide' },
    { src: 'rules/power-cards.jpg', label: 'Power cards' },
    { src: 'rules/missions.jpg', label: 'Missions' },
    { src: 'rules/market.jpg', label: 'The market' },
    { src: 'rules/starter-map.jpg', label: 'Starter map' },
    { src: 'rules/tile-sheet.jpg', label: 'Tile sheet' },
    { src: 'rules/whirlpools.jpg', label: 'Whirlpool tiles' },
  ]
  return (
    <div>
      <div className="hint" style={{ marginBottom: 12 }}>
        The printed components this build was made from, so the app can be checked against
        them. The board draws its tiles, banks, animals and icons straight off these
        sheets.
      </div>
      {images.map((image) => (
        <div key={image.src}>
          <div className="section-title">{image.label}</div>
          <img className="ref-img" src={image.src} alt={image.label} loading="lazy" />
        </div>
      ))}
    </div>
  )
}

function About() {
  return (
    <div>
      <div className="section-title">Dam It playtest build v{VERSION}</div>
      <p className="muted">
        A prototype for testing the game, not a finished product. The rules engine is separate
        from the interface, every random outcome comes from the game&apos;s seed, and a seed
        replays a game exactly.
      </p>

      <div className="section-title">Changelog</div>
      {CHANGELOG.map((entry) => (
        <div key={entry.version} style={{ marginBottom: 10 }}>
          <b>
            v{entry.version} - {entry.date}
          </b>
          <ul className="rules-list">
            {entry.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
