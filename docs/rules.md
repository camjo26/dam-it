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
- Current strengths are 0 to 4. Nearly every tile flows, and each one carries its own
  direction as well as its own strength. The default strength mix is weighted from the printed
  tile sheet's own
  count: 46 plain, 12 of strength 1, 16 of strength 2, 8 of strength 3 and a single 4.
- Only 5 currents start face up. Every other tile is face down until an animal enters it, and
  then it stays turned over for everybody.
- Each player places 2 collectors in Phase A, in two areas or stacked on one, and each is paid
  separately. Half the production deck pays nothing at all in one area, and only a card paying
  4 somewhere else is allowed to do that.
- Four animals fit on a river square. The limit binds players, not the river.
- Every player has 1 Distraction token for the game.

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
| Currents face up at the start | 5 | Nothing printed says how many. Only tiles above strength 0 can be hidden, since still water has nothing to hide, and islands and whirlpools are printed tiles so they stay face up. | `board.visibleCurrents` |
| Current direction mix | half sideways, a quarter forward, a quarter back | Asked for directly, to make the river push animals around rather than only along. | `board.currentDirectionWeights` |
| Strength 4 is sideways only | yes | A forward 4 is most of a free crossing and a backward 4 undoes most of a game's work. | `board.sidewaysOnlyFromStrength` |
| Collectors per player | 2 | Asked for directly. They may share an area, and each is paid in full. | `production.collectorsPerPlayer` |
| Animals per river square | 4 | Asked for directly. It binds anything a player chooses to do and not the current, which carries every animal on a tile, so a stack driven into the bank piles up past four. Banks are exempt, since every animal starts stacked on the top bank. | `board.maxAnimalsPerTile` |
| Blanks on production cards | half the deck, each paying 4 elsewhere | Asked for directly: a card may only pay nothing in an area if it is generous in another. | `production.cards` |
| Dam calms | its own square plus 1 above and 1 below | The card says "above and below the dam". On a board where the river runs left to right, that reads as the squares up and down the board. The axis is switchable. | `dam.calmAxis`, `dam.calmRadius` |
| Destroying a dam | 2 Stone | The brief says this was discussed as 2 or 3 and never settled. | `dam.destroyCost` |
| Islands shelter from the current | yes | The printed rules say islands are "not automatically safe", which is ambiguous. | `board.islandsBlockCurrent` |
| Using equipment | free | Buying it already cost the action. Only buying costs one. | `equipment.*.useUsesAction` |
| Distraction tokens | on, 1 each | Played on a river tile for your action. Everything within 3 squares rolls a d6, the placer's own animals included: 4 or more and it keeps its head, Ducks need a 6. The placer then drags each distracted animal up to 3 squares toward the token, choosing the distance for each one. | `distraction.*` |
| Secret roles | off | Parked rather than deleted. The Saboteur's powers and scoring were never settled, so the game is being tested without them. Switching it back on restores the whole mechanic, and the tests still cover it. | `roles.enabled` |
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
4. **Are secret roles coming back?** They are parked, not deleted. If they return, the
   Saboteur still needs a power and a scoring condition: as built it was the easiest of the
   three, taking the same 6 points for the same 2 animals across without leading at anything.
5. **Should a Distraction token spare your own animals?** At the moment everything within 3
   squares rolls, the placer's own included, and where you drop it is the whole skill of it.
6. **Should a token be able to pull a rival forward?** The drag is always toward the token, so
   one dropped ahead of somebody helps them. Dropped on row 1 in round 1 it catches almost
   every animal on the bank and pushes the lot into the river. The per-animal "up to 3" choice
   means a bad catch can be left alone, but the forward pull is still available on purpose.
7. **Does using a raft, rope or anchor cost an action, or only buying it?**
8. **Is the direction mix right?** Half sideways, a quarter forward, a quarter back. A quarter
   of the river actively undoing progress may be too punishing, or not punishing enough.
9. **Should the river obey the four-to-a-square limit too?** It does not at the moment, so
   animals shoved into the bank pile up past four. Making it obey would mean deciding which
   animals get left behind, and nothing in the game says who would choose.
10. **Are 5 face-up currents too few** on a river 7 rows deep, when the only way to learn a
    tile is to put an animal on it?
11. **Does a raft or a rope count as a "structure" for the Builder mission?**

---

## What the numbers say

From `pnpm sim -- --games 300`, v0.04 rules, Normal opponents, none failed. Raw data in
`docs/balance/v0.04.csv`, with the two runs before it in `v0.03.csv` and `baseline.csv`.

| Faction | Win % | Score | Animals across | Mission % | Built | Carried by the current |
|---|---|---|---|---|---|---|
| Ducks | 24 | 5.28 | 3.66 | 37 | 7.2 | 17.2 |
| Swans | 16 | 4.95 | 3.56 | 32 | 7.1 | 6.6 |
| Frogs | 19 | 5.32 | 3.32 | 46 | 6.8 | 14.8 |
| Beavers | 21 | 5.09 | 3.51 | 35 | 8.9 | 16.3 |

**All three findings from v0.02 are now fixed or improving.**

**Crossings are up, from about 2.5 to about 3.5.** A quarter of the river pushes forward, so
the current gives ground back as well as taking it. The depth-5 and 14-round experiments are
no longer needed to make the race work.

**Power Cards get bought**, where before it was 0.07 a game. Frogs buy about 3 with their
second action; everyone else about 1.

**The factions are closer together.** The win spread was 19 to 24 in v0.02, opened to 15 to 26
in v0.03 when the river got fierce, and is 16 to 24 now. Four to a square is what pulled it
back: Beavers dropped from 26% to 21% because a bought advantage is worth less when the board
itself limits how much of your herd can occupy good water.

**Two things still worth a look.**

**1. Swan resistance has become a drawback.** Swans are carried by the current 6.6 times a
game against everyone else's 15 to 17, and they win least at 16%. Taking 1 off every current
cancels most strength-1 tiles outright, and a quarter of those would have been pushing them
*forward*. Resisting the river now means turning down free rides. It may want rebalancing as
resistance that only applies to currents which cost them ground.

**2. There is still more income than there is to spend it on.** A faction earns about 37
resources across ten rounds and spends 18 to 34 of it. Beavers finish with half unspent. The
blanks added in v0.04 did not reduce income, because the glut cards that earn a blank pay 4.
Either the costs should rise, or a second action a turn would give players something to do
with it.

One smaller note, unchanged: with no sharing penalty, where other players put their collectors
never matters, so collector placement is still a private sum rather than a decision about
anybody else. Setting `production.sharingPenalty` to 1 makes the Market contested, and it
matters more now that there are two collectors each and half the deck has a blank.
