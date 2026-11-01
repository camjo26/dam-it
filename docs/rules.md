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
- An animal the current carries past the left or right edge is swept away and out of the game,
  including one already standing on the edge with the current pointing at it. Resisting the
  current makes the push smaller and so does not save it; a dam, an island, an anchor or a
  Current Shield does, because those make it ignore the current entirely.
- Every range is counted in straight lines along the rows and columns, never diagonally.
- Players may trade resources and Power Cards with each other.
- Every player has 1 Distraction token for the game.

**Factions**

| | Animals | Move | Ability | Weakness |
|---|---|---|---|---|
| Ducks | 10 | 3 | One animal of theirs moves one extra square, every turn, all game | That animal is never out of the current, and Distraction, see below |
| Swans | 8 | 3 | The current affects them one less, unless it is carrying them forward | |
| Frogs | 10 | 3 | One extra action per turn | No anchors |
| Beavers | 10 | 3 | Everything they build costs one resource less | |

**A turn** is your movement points, split between your animals however you like, plus one
action: build equipment, buy a Power Card, use a special ability, or an action a card grants.

**Equipment costs** are the printed Cost Guide:

| | Cost | Effect |
|---|---|---|
| Dam | 3 Wood, 2 Stone, 1 Clay | Calms the water above and below. Stays until destroyed. |
| Raft | 1 Wood, 1 Stone, 1 Clay, 1 Reed | Move one animal forward without using a movement point. |
| Anchor | 1 Stone, 1 Clay | One animal ignores the current for the round. Removed at the end of the Current Phase. |
| Rope | 1 Wood, 1 Clay, 2 Reeds | Move an animal up to 3 squares toward another of yours within 6 squares. You choose whether it sets off across the river or along it. |
| Power Card | 4 resources, any mix | Drawn face down. One played per player per round. Cannot be traded. Held between rounds. |

**Dams.** The owner chooses one animal per round that cannot use the calming effect. Destroying
a dam sweeps the animals immediately downstream 2 squares, and the water it was holding back
bursts through: every square it was calming runs at 3 from then on.

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
| Edge of the board | swept away and out of the game | Asked for directly. Only the river does it: walking, a rope and a card all stop at the edge instead, so nobody can push a rival off by hand. | `current.edgeBehaviour` |
| Dams hold the water | left and right, radius 1, including their own square | Asked for directly, and those squares now read 0 on the board until the dam is destroyed. | `dam.calmAxis` |
| A destroyed dam bursts | the squares it calmed run at 3 | Asked for directly: the water it was holding has to go somewhere, so the safest line on the board becomes the worst of it. Zero sends those squares back to the strength they were rolled at. | `dam.burstCurrent` |
| Four animals to a square | yes, on river squares | Binds anything a player chooses to do, including a Distraction drag, which is refused outright rather than quietly stopping the last animal short. It does not bind the river: a current carries every animal on a tile, so a square can hold five through nobody's choice, and a drag that adds nothing to such a square is still legal. | `board.maxAnimalsPerTile` |
| The Ducks' ability | one animal, one extra square, named by use | Go With the Flow was the mirror image of Swan resistance, so one of the two was always going to be strictly better. The extra square is spent after the shared movement, and whichever animal spends it first keeps it for the rest of the game. The knob is still there. | `factions.ducks.oneAnimalBonus` |
| Swan resistance and helpful water | they do not resist a current running toward the far bank | Resisting everything meant the ability turned down the one thing the river gives away for nothing, and the numbers below say it was costing them 9 points of win rate. They still brace against water pushing them sideways or back. | `factions.swans.resistsForwardCurrents` |
| Frogs and ropes | allowed again since v0.09; anchors still banned | **A departure from the printed rules**, which say no anchors and no ropes. The ban was written when a rope reached 3 squares and could not choose its direction. At 6 squares it is the best item in the shop, and shutting the Frogs out of it cost them about 5 points of win rate - more than their extra action is worth. Anchors stay out, since a frog does not sit still. | `factions.frogs.forbiddenEquipment` |
| Power Card plays per faction | off | Measured on the Frogs, who buy three times as many cards as anybody else and can only play one a round. Letting them play two changed nothing: the cards are too situational for a second one to be worth playing in the same round. The knob is there if a faction ever needs it. | `factions.<id>.powerCardPlaysPerRound` |
| The price on it | that animal is never out of the current | An anchor and a Current Shield both slide off the animal carrying the extra square, however they got there. It makes naming that animal a decision rather than an accident. It is flavour rather than balance: see the numbers below. | `factions.ducks.bonusAnimalUnprotected` |
| Range is orthogonal | yes | Asked for directly: three squares means three steps along the rows and columns, so a diagonal corner is further than it looks. Distraction tokens, ropes and Rescue all use it. | n/a |
| Trading | on, free, one offer a turn | Offer resources and Power Cards, and say what you want back. Cards are asked for by number, not name, because a hand is secret. The other player takes it, leaves it, or names their own terms. A computer opponent answers inside the same action, and the answer is reported in a popup rather than only in the log. | `trade.*` |
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

From `pnpm sim -- --games 500 --seed 7`, v0.09 rules, Normal opponents, none failed. Raw data
in `docs/balance/v0.09.csv`, with the runs before it in `v0.08-price-on.csv`, `v0.07.csv`,
`v0.05.csv`, `v0.04.csv`, `v0.03.csv` and `baseline.csv`.

| Faction | Win % | Score | Animals across | Mission % | Built | Carried by the current |
|---|---|---|---|---|---|---|
| Ducks | 27.8 | 5.25 | 3.47 | 40.6 | 6.5 | 18.4 |
| Swans | 20.6 | 4.92 | 3.51 | 32.2 | 6.4 | 8.2 |
| Beavers | 20.6 | 4.65 | 2.99 | 38.0 | 7.8 | 14.8 |
| Frogs | 14.0 | 3.98 | 2.53 | 33.4 | 5.6 | 15.1 |

**Swan resistance was the big one, and it was a bug in the design rather than a weak
ability.** They were bracing against every current, including the quarter of them running
toward the far bank, so the ability spent a third of its working life turning down free
progress. Measured over 500 games a side, on the same seeds:

| | Ducks | Swans | Beavers | Frogs |
|---|---|---|---|---|
| Resisting everything | 29.8 | **15.6** | 26.0 | 12.8 |
| Only resisting water that is not helping | 27.6 | **24.6** | 23.4 | 9.0 |
| And the Frogs given the rope back | 27.8 | 20.6 | 20.6 | **14.0** |

Nine points, about five standard errors at that sample size, and the profile moves with it:
animals across 3.13 to 3.53, missions 29.4% to 33.6%, carried by the current 6.7 to 8.1.
**Nothing was done to the Ducks, and they came down anyway**, from 29.8 to 27.8: win rate is
zero-sum, so lifting the floor lowers the ceiling. That is the argument against ever fixing a
spread by cutting whatever is at the top of it.

**The Frogs needed the printed drawback loosened, not a new ability.** The obvious idea was
measured first and did nothing: they buy 3.5 Power Cards a game and can only play one a
round, so letting them play two looked like free value. It came out at 8.2% against 9.0%,
with cards bought, animals across and score identical to the decimal - the limit was never
what was binding. Giving them the rope back is worth about 5 points, and the whole profile
shifts with it: equipment built 4.5 to 5.6, animals across 2.28 to 2.53, cards bought 3.5 to
2.4. Their spare action stops leaking into cards it cannot use.

**Two caveats on the Frogs.** Their drawback is printed and the change departs from it, which
is noted in the table above. And their advantage is the thing this simulator is worst at
valuing: actions are where the computer opponents' judgement is weakest, so a person playing
Frogs is probably worth more than 14%.

**The rope going from 2 squares of pull to 3 in v0.10 did not move any of this.** A 200 game
check afterwards read Ducks 28.5, Swans 22.5, Beavers 19.5, Frogs 12.0, which is the same
table inside the noise at that sample size.

**Losing animals over the side still costs about half an animal a game**, unchanged since
v0.05. A real cost without being a bloodbath, which is about where a new hazard wants to sit.

**Still worth a look: there is more income than there is to spend it on.** A faction earns
about 36 resources across ten rounds and spends 24 to 32. Trading has not changed this,
because the computer opponents only ever answer offers - they never make them - so in an
all-AI run no trade is ever proposed. What trading does in a game with a person in it is
still untested by the simulator.

One smaller note, unchanged: with no sharing penalty, where other players put their collectors
never matters. Setting `production.sharingPenalty` to 1 makes the Market contested, and it
matters more now that there are two collectors each and half the deck has a blank.
