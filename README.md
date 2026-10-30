# Dam It

A playable browser version of Cam's river-crossing board game, built for testing the rules
rather than for release. Four factions race animals from the top bank to the far bank over ten
rounds, fighting the current, each other, and a secret role nobody admits to.

Everything that could be a balance number is a balance number: costs, current strengths, card
magnitudes, mission targets, role bonuses and faction abilities all live in one editable rules
object and can be changed from inside the app, exported as JSON and imported again.

The board is drawn with the printed artwork rather than coloured squares. The river, current,
island and whirlpool tiles are cut off the tile sheet, the banks off the starter map, and the
animals and the resource and equipment icons off the illustrated rules sheet.

## Running it

```bash
pnpm install
```

```bash
pnpm dev
```

Then open <http://localhost:5173>. The app saves your game and your rules to the browser, so
closing the tab or restarting the machine does not lose progress.

It is also live at <https://camjo26.github.io/dam-it/>.

Other commands:

```bash
pnpm test
```

```bash
pnpm build
```

## Your first game

1. Open the app. Leave the mode on **Solo**, pick **Ducks**, leave the opponent on
   **Normal - Old Mottle** and press **Start a 10 round game**.
2. **Phase A.** Put your **two** collectors in resource areas - split them, or stack both on
   one area to double up on a hunch. A production card is then turned over and pays every
   collector according to where it stands. Every card pays every area at least 1, so a
   collector is never wasted. You choose before you see the card.
3. **Phase B.** Click one of your animals, then click a highlighted square to move it. You have
   3 movement points to split between your animals however you like, plus one action: build
   something, buy a Power Card, destroy a dam, play your Distraction token, or play a card.
   Press **End turn** when done.
4. The three computer players take their turns. Watch the board, or read the log.
5. **Phase C.** Every player has acted, so the current runs. Play any card that says *before
   the Current Phase*, then press **Resolve the Current Phase**. A report then shows which
   animal moved, where to, and exactly why.
6. After round 10 the final scoreboard appears.

### The river

Nearly every tile flows, and each has its own strength (1 to 4) and its own direction, drawn
on the tile as a number and an arrow. Roughly half push sideways, a quarter push **forward**
toward the far bank and a quarter push **back** toward where you started, so the river can
hand you a crossing or take one away. A current of 4 only ever runs sideways.

Only **5** currents start face up. Every other tile shows a **?** until one of your animals
stands on it, and then it stays turned over for everybody - so finding out costs you the
animal that found out.

### Distraction tokens

Everyone has one, for the whole game. Playing it is your action. Drop it on a river tile and
every animal within 3 squares rolls a d6, **including your own**: 4 or more and the animal
keeps its head, less and it is distracted. Ducks are the easiest to distract and need a 6.
You then drag each distracted animal up to 3 squares **toward the token**, choosing the
distance separately for each one - so where you drop it decides everything.

### Hot seat

Choose **Hot seat** on the setup screen and name up to four players. Each seat takes its turn
at the same screen. Missions and roles are only shown for the seat whose turn it is; other
players see "Secret mission held" with a **Hold to peek** button so they can check their own
card without the screen giving it away.

### Against the computer

**Solo** gives you one faction and three computer opponents. There are three opponents to pick
from, each with its own habits:

| Difficulty | Opponent | How it plays |
|---|---|---|
| Easy | Reedy | Heads straight for the far bank, ignores equipment, sometimes picks a worse move on purpose. |
| Normal | Old Mottle | Reads the water, shelters on islands, buys what it can afford. |
| Hard | Grey Quill | Picks the quietest lane, saves for Power Cards and plays them against you. |

**Watch the AI** runs all four factions by computer, which is the quickest way to see a whole
game.

## Changing the rules

Press **Rules editor** on the setup screen or in a game. Every setting carries a badge:

- **established** - given in the brief or printed on the components.
- **provisional** - chosen so the prototype is playable, and easy to reverse.

The tabs cover game length, board size, islands and whirlpool positions, the current strength
and direction mixes, how many currents start face up, movement, dams, equipment costs, the
Power Card deck, missions, the production deck, collectors, Distraction tokens, secret roles
and the computer opponents. The footer has **Restore defaults**, **Export JSON** and
**Import JSON**, plus **Save and start a new game**.

Secret roles are **parked** rather than deleted: the Saboteur's powers and scoring were never
settled, so the game is being tested without them. Switching `roles.enabled` back on in the
Roles tab restores the whole mechanic, and the tests still cover it.

Changing a rule in the middle of a game warns you first. Board size cannot be applied to a
board that is already laid out, and the editor says so.

The **Open questions** tab lists the places where the brief and the printed components
disagree, or where no rule exists yet, with the default currently in use.

## Testing tools

- **Diagnostics** (top bar) shows resource income and spending per faction, progress, cards,
  every crossing, and animals across round by round. It exports JSON or CSV.
- **Seeds.** Every game has a seed, shown in the top bar. The same seed always gives the same
  board, the same production cards and the same rolls. The final screen has **Play seed X
  again** so a strange game can be replayed exactly.
- **Game log.** Every event, filterable, exportable as CSV. Current moves carry the full
  reason the animal ended up where it did.
- **Headless simulator.** The computer plays itself and prints balance numbers:

```bash
pnpm sim -- --games 300 --seed base --csv results.csv
```

  `--set` overrides any rule for the run, so a change can be measured before it is adopted:

```bash
pnpm sim -- --games 150 --seed test --set board.riverDepth=5
```

  Other flags: `--difficulty easy|normal|hard`, `--json <file>` for every game's record.

## What the simulator says so far

300 games at Normal, v0.03 rules, in `docs/balance/v0.03.csv`:

| Faction | Win % | Score | Animals across | Mission % | Built | Carried by the current |
|---|---|---|---|---|---|---|
| Ducks | 20 | 5.07 | 3.53 | 35 | 7.5 | 17.3 |
| Swans | 15 | 4.87 | 3.67 | 28 | 7.4 | 6.4 |
| Frogs | 20 | 4.83 | 2.99 | 43 | 6.5 | 16.3 |
| Beavers | 26 | 5.36 | 3.53 | 41 | 9.0 | 17.5 |

Crossings are up from about 2.5 to about 3.4 now that a quarter of the river pushes forward,
and Power Cards actually get bought. The standout new finding is that **Swan resistance has
become a drawback**: they get the most animals across and win least, because taking 1 off
every current also means turning down the forward ones. Three findings worth a look are in
[docs/rules.md](docs/rules.md#what-the-numbers-say).

## How it is put together

The rules engine never touches the screen, and the screen never contains a rule.

```
src/game/      the engine: no DOM, no React, no timers
  rules.ts         every tunable in one object
  rulesSchema.ts   what each tunable means, and whether it is established or provisional
  types.ts         players, animals, tiles, cards, missions, roles
  engine.ts        applyAction(state, action) -> new state or an error
  current.ts       the Current Phase, in a documented order
  movement.ts      legality, movement points, and the one routine every mover goes through
  cards.ts         one function per Power Card
  missions.ts      one function per mission condition
  ai.ts            picks one action at a time, through the same engine a person uses
  runner.ts        drives AI turns and automatic phases
src/ui/        React components, which only read state and dispatch actions
  art.ts           maps tiles, animals and icons to the pictures cut from the sheets
src/state/     saving, loading and the React hook that drives the engine
  storage.ts       versioned saves, and the merge that loads an older rules file
scripts/       the headless simulator, and the artwork extractor
tests/         70 tests covering the rules and whole games
```

The component sheets in the project root are the source of truth for the artwork. Nothing in
`public/art` or `public/rules` is edited by hand - it is all generated, and regenerated by:

```bash
python scripts/extract-art.py
```

That reads the sheets, cuts the tiles off their lattice, knocks the cream card background out
of the icons, builds the app icon, and re-encodes the sheets themselves as JPEGs for the
reference tab. Re-run it after replacing a sheet.

Two things follow from that split and are worth keeping:

- **The AI cannot cheat.** It returns one action at a time and the engine validates it exactly
  as it validates yours. An illegal suggestion is refused, not applied.
- **Any game can be replayed.** All randomness comes from a seeded generator whose counter
  lives in the saved state, so a reloaded game rolls the same numbers it would have rolled.

## Tests

```bash
pnpm test
```

70 tests: movement limits, round progression, double-resolution guards, current resolution,
hidden current reveals, dam calming and destruction, anchor duration, Duck and Swan abilities,
Frog extra actions, Beaver discounts, Power Card timing and the one-per-round limit, whirlpool
resolution, mission scoring, secret-role eligibility, final scoring, undo, and 24 complete
games across three difficulties checking that the deck is conserved, roles are dealt once, the
current resolves exactly once a round, and the same seed gives the same game.

The v0.03 rules have their own file, `tests/river-and-tokens.test.ts`: forward and backward
currents, the sideways-only rule at strength 4, Redirect turning a tile's own direction
around, exactly five currents face up, two collectors paid separately, and the whole
Distraction sequence from the roll to the drag.

`tests/storage.test.ts` covers loading a rules file written by an older build. That one is
worth keeping: a shallow merge there silently dropped every new field and crashed the board
builder, and nothing else in the suite could have caught it.
