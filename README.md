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
2. **Phase A.** Put your collector in a resource area. A production card is then turned over
   and pays everyone according to where their collector is. You choose before you see the card.
3. **Phase B.** Click one of your animals, then click a highlighted square to move it. You have
   3 movement points to split between your animals however you like, plus one action: build
   something, buy a Power Card, destroy a dam, or play a card. Press **End turn** when done.
4. The three computer players take their turns. Watch the board, or read the log.
5. **Phase C.** Every player has acted, so the current runs. Play any card that says *before
   the Current Phase*, then press **Resolve the Current Phase**. A report then shows which
   animal moved, where to, and exactly why.
6. After round 10 the final scoreboard appears with the secret roles revealed.

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
mix, movement, dams, equipment costs, the Power Card deck, missions, the production deck,
secret roles, distraction and the computer opponents. The footer has **Restore defaults**,
**Export JSON** and **Import JSON**, plus **Save and start a new game**.

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

300 games at Normal, default rules, in `docs/balance/baseline.csv`:

| Faction | Win % | Score | Animals across | Mission % | Built |
|---|---|---|---|---|---|
| Ducks | 19 | 3.75 | 2.50 | 19 | 3.9 |
| Swans | 19 | 3.98 | 2.73 | 18 | 3.9 |
| Frogs | 19 | 3.79 | 2.17 | 21 | 3.1 |
| Beavers | 24 | 4.42 | 2.87 | 21 | 5.9 |

The factions are close. Three findings worth a look are in
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
scripts/       the headless simulator, and the artwork extractor
tests/         50 tests covering the rules and whole games
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

50 tests: movement limits, round progression, double-resolution guards, current resolution,
hidden current reveals, dam calming and destruction, anchor duration, Duck and Swan abilities,
Frog extra actions, Beaver discounts, Power Card timing and the one-per-round limit, whirlpool
resolution, mission scoring, secret-role eligibility, final scoring, undo, and 24 complete
games across three difficulties checking that the deck is conserved, roles are dealt once, the
current resolves exactly once a round, and the same seed gives the same game.
