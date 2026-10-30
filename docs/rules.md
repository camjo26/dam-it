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
  separately. Every production card pays every area at least 1.
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
9. **Are 5 face-up currents too few** on a river 7 rows deep, when the only way to learn a
   tile is to put an animal on it?
10. **Does a raft or a rope count as a "structure" for the Builder mission?**

---

## What the numbers say

From `pnpm sim -- --games 300`, v0.03 rules, Normal opponents. Raw data in
`docs/balance/v0.03.csv`. The v0.02 run it is being compared against is in
`docs/balance/baseline.csv`.

| Faction | Win % | Score | Animals across | Mission % | Built | Carried by the current |
|---|---|---|---|---|---|---|
| Ducks | 20 | 5.07 | 3.53 | 35 | 7.5 | 17.3 |
| Swans | 15 | 4.87 | 3.67 | 28 | 7.4 | 6.4 |
| Frogs | 20 | 4.83 | 2.99 | 43 | 6.5 | 16.3 |
| Beavers | 26 | 5.36 | 3.53 | 41 | 9.0 | 17.5 |

**Two of the three findings from v0.02 are fixed.**

**Crossings are up, from about 2.5 to about 3.4.** A quarter of the river now pushes forward,
so the current gives ground back as well as taking it, and an animal no longer depends only on
its 3 movement a round. The depth-5 and 14-round experiments are no longer needed to make the
race work.

**Power Cards are bought now**, where before it was 0.07 a game. Frogs buy about 3, everyone
else under 1. Two collectors and a deck that pays every area roughly doubled income.

**Three things worth a look.**

**1. Swan resistance has quietly become a drawback.** Swans get the most animals across
(3.67) and still win least (15%). They are carried by the current 6.4 times a game against
everyone else's 17. Taking 1 off every current cancels most strength-1 tiles outright, and a
quarter of those would have been pushing them *forward*. Resisting the river now means
turning down free rides. It is a real consequence of the direction change and may want
rebalancing, perhaps as resistance that only applies to currents that cost them ground.

**2. There is more income than there is to spend it on.** A faction earns about 35 resources
across ten rounds and spends 18 to 31 of it. Beavers finish with nearly half unspent. Costs
that were tight at 13.5 resources a game are loose at 35, which is why Power Cards went from
never to routine. Either the deck should pay less, or the costs should rise, or a second
action a turn would give players something to do with it.

**3. Beavers still lead**, at 26% against 15 to 20. Their discount is worth more now that
there is more to buy, and they build 9 things a game against everyone else's 6.5 to 7.5.

One smaller note, unchanged from v0.02: with no sharing penalty, where other players put their
collectors never matters, so collector placement is still a private sum rather than a decision
about anybody else. Setting `production.sharingPenalty` to 1 makes the Market contested - and
it matters more now that there are two collectors each.
