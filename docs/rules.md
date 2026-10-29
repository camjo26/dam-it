# Dam It - rules status

Three lists, as the brief asks: what was given, what was chosen to keep the prototype moving,
and what still needs Cam to decide. Everything in the second list is editable in the app's
rules editor, and the paths given are the ones `pnpm sim -- --set <path>=<value>` takes.

---

## 1. Established rules

Taken from the brief and from the printed components in this folder.

**Shape of the game**

- 10 rounds. Each round is Phase A resources, Phase B player turns, Phase C the current.
- The current resolves once, after every player has acted. Never after each turn.
- 1 point per animal that reaches the far bank. Missions and secret roles add more.
- The river runs left to right. Animals cross it top to bottom.
- The starter map is 10 tiles wide and 7 rows deep.
- Current strengths are 0 to 4, with 4 rare. The default mix is the printed tile sheet's own
  count: 46 plain, 12 of strength 1, 16 of strength 2, 8 of strength 3 and a single 4.
- Some currents are hidden and are revealed when an animal enters the tile, and stay revealed.

**Factions**

| | Animals | Move | Ability | Weakness |
|---|---|---|---|---|
| Ducks | 10 | 3 | Go With the Flow: one extra square when the current moves them | Distraction, see below |
| Swans | 8 | 3 | The current affects them one less | |
| Frogs | 10 | 3 | One extra action per turn | No anchors, no ropes |
| Beavers | 10 | 3 | Everything they build costs one resource less | |

**A turn** is your movement points, split between your animals however you like, plus one
action: build equipment, buy a Power Card, use a special ability, or an action a card grants.

**Equipment costs** are the printed Cost Guide:

| | Cost | Effect |
|---|---|---|
| Dam | 3 Wood, 2 Stone, 1 Clay | Calms the water above and below. Stays until destroyed. |
| Raft | 2 Wood, 1 Reed | Move one animal forward without using a movement point. |
| Anchor | 1 Stone, 1 Clay | One animal ignores the current for the round. Removed at the end of the Current Phase. |
| Rope | 2 Wood, 2 Reeds | Move an animal up to 2 squares toward another of yours within 3 squares. |
| Power Card | 4 resources, any mix | Drawn face down. One played per player per round. Cannot be traded. Held between rounds. |

**Dams.** The owner chooses one animal per round that cannot use the calming effect. Destroying
a dam sweeps the animals immediately downstream 2 squares.

**Whirlpools** roll for left, right or forward. Each animal is affected at most once per
Current Phase.

**Power Cards.** The 12 printed cards, 3 copies each except River Shift and Whirlpool with 2,
giving 34. Their text and timing are as printed.

**Missions.** The 8 printed cards, with the point values on the cards: The Herd +5, Dam
Destroyer +4, Builder +4, Resourceful +4, Risk Taker +5, Power Man +4, Island Hopper +5,
Against the Current +5.

**Secret roles.** One player gets Saboteur, Hoarder or Champion at the end of round 5, dealt
privately and revealed at the end of round 10. Hoarder needs the most resources outright,
Champion the most animals across outright, and both need at least 2 animals across.

---

## 2. Provisional rules

Chosen so the game is playable. Each is deliberately simple and reversible.

| Rule | Default | Why | Path |
|---|---|---|---|
| Four resources, not three | Wood, Stone, Clay, Reeds | The brief's text says three, but the Cost Guide, the Market board and the illustrated rules all show four, and the Raft and Rope costs need Reeds. The Market also has exactly four collector areas. | n/a |
| Four islands | (2,2) small, (7,3) small, (4,4) large, (1,6) small | The brief asks for exactly four. The printed starter map draws five. Positions are editable. | `board.islands` |
| Three whirlpools | (6,2), (3,5), (8,5) | The starter map has none drawn; the brief asks for them. | `board.whirlpools` |
| Whirlpool distance | 1 square | No distance is printed. One is the cautious choice. | `whirlpool.distance` |
| Whirlpool odds | equal thirds | Matches the printed "left, right or forward" with nothing to suggest a bias. | `whirlpool.weight*` |
| Whirlpool trigger | where the animal ends up | Simplest reading of "each animal is affected once per phase". | `whirlpool.trigger` |
| Hidden currents | 35% of moving water | Nothing printed says how many. Only tiles above strength 0 can be hidden, since still water has nothing to hide. | `board.hiddenCurrentFraction` |
| Dam calms | its own square plus 1 above and 1 below | The card says "above and below the dam". On a board where the river runs left to right, that reads as the squares up and down the board. The axis is switchable. | `dam.calmAxis`, `dam.calmRadius` |
| Destroying a dam | 2 Stone | The brief says this was discussed as 2 or 3 and never settled. | `dam.destroyCost` |
| Islands shelter from the current | yes | The printed rules say islands are "not automatically safe", which is ambiguous. | `board.islandsBlockCurrent` |
| Using equipment | free | Buying it already cost the action. Only buying costs one. | `equipment.*.useUsesAction` |
| Distraction | off | The Ducks card says they must roll 6 to avoid it; the brief asks for it to stay optional until confirmed. When on, it distracts one random Duck for the turn on a roll below 6. | `distraction.*` |
| Saboteur ability | strengthen one tile by 1, once a round, before the current | The brief says the powers are not finalised and asks for something small. The log does not name who did it. | `roles.saboteur.*` |
| Saboteur scoring | 6 points for 2 animals across | No separate condition is given. | `roles.*` |
| Production deck | 24 cards, 12 kinds, 2 each | The brief says the distribution is not settled. Yields average about 1.5 per area with real variance. | `production.cards` |
| Collector sharing | no penalty | Nothing printed says sharing an area costs anything. | `production.sharingPenalty` |
| Starting resources | none | Nothing says players start with any. | `game.startingResources` |
| Edge of the board | animals stop at the edge | The brief does not say what happens to an animal pushed off the downstream end. | `current.edgeBehaviour` |
| Current resolution order | downstream first | Any order works as long as it is fixed and visible. Ties always break by turn order then animal id. | `current.resolutionOrder` |
| Backward movement | allowed | Nothing forbids it, and Push can move an animal backward anyway. | `movement.allowBackward` |
| Diagonal movement | not allowed | The brief asks for a clear tile-by-tile system. | `movement.allowDiagonal` |
| Animals that cross | leave the board | They still score, but cannot be targeted or moved afterwards. This is the documented default the brief asks for. | `game.finishedAnimalsLeaveBoard` |
| "Structures" for the Builder mission | any equipment purchase | The card does not define the word. | n/a |
| Bank animals | safe from the current | Otherwise animals would drift along the bank before entering. | `current.affectsBankAnimals` |

**Undo** is allowed during a turn, but it is cleared the moment a hidden current is revealed
or a face-down card is drawn, so it cannot be used to look and then take it back.

---

## 3. Open questions

These need a decision rather than a default. Each has a working default in the meantime, and
all of them are listed in the app under **How to play > Open questions**.

1. **Three resources or four?** The brief's text and every printed component disagree. Built
   with four. If it should be three, Reeds has to come out of the Raft and Rope costs and the
   Market loses an area.
2. **Four islands or five?** The brief says four, the printed map draws five.
3. **Does destroying a dam cost 2 Stone or 3?**
4. **What does the Saboteur actually do, and how does it score?** As built it is the easiest of
   the three roles: it gets the same 6 points for the same 2 animals across, without needing to
   lead at anything. Hoarder and Champion both need an outright lead.
5. **Is Distraction in the game?** And if so, does it hit one Duck or the whole flock? Ten
   ducks all distracted on a 5-in-6 chance would be brutal.
6. **Does using a raft, rope or anchor cost an action, or only buying it?**
7. **Is sideways displacement enough of a threat?** See the numbers below.
8. **Does a raft or a rope count as a "structure" for the Builder mission?**

---

## What the numbers say

From `pnpm sim -- --games 300`, default rules, Normal opponents. Raw data in
`docs/balance/baseline.csv`.

**The factions are close.** Win rates 19/19/19/24, scores 3.75 to 4.42. Beavers are a little
ahead, which their 5.9 structures against everyone else's 3.9 explains. Nothing here looks
broken.

**Three things are worth a look.**

**1. Most animals never cross.** About 2.5 animals out of 8 to 10 reach the far bank. That is
not the AI being poor, it is arithmetic: the river is 7 rows deep, so crossing costs 8 movement
points, and a faction only gets 3 a round for 10 rounds. 30 points buys at most 3.75 crossings
even if every single point goes into one animal at a time. Starting with 10 animals when the
game can only move 3 or 4 of them makes most of the herd scenery.

Two changes each raise crossings to about 4.3 to 4.8, tested over 150 games:

- a 5-row river (`--set board.riverDepth=5`), in `docs/balance/depth-5.csv`
- 14 rounds (`--set game.rounds=14`), in `docs/balance/rounds-14.csv`

Raising movement to 4 would do the same thing. Worth deciding which lever you want, because it
also decides how much the rest of the game has room to matter.

**2. The secret role is worth more than the race.** 6 points for a role, 4 or 5 for a mission,
against about 2.5 points of animals across. A player who ignores the river and chases the role
bonus is playing the stronger game. Either animals should be worth more, or the bonuses less.

**3. Power Cards are almost never bought.** 0.07 a game for most factions. Four resources is a
large share of the roughly 13.5 a faction earns across ten rounds, and equipment competes
directly for the same action. If the deck is meant to shape games, it needs to be cheaper, or
the action it costs needs to be freer.

One smaller note: with no sharing penalty, where other players put their collectors never
matters, so the collector placement is a private sum rather than a decision about anybody else.
Setting `production.sharingPenalty` to 1 makes the Market contested.

And a design observation rather than a finding: the current only ever pushes animals sideways,
so it costs position but never progress. That makes the river a nuisance rather than a danger,
and it is why anchors are rarely worth buying. It matches the brief exactly, so it has been
left alone, but it is question 7 above.
