export const VERSION = '0.10'

export interface ChangelogEntry {
  version: string
  date: string
  notes: string[]
}

// Newest first.
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.10',
    date: '2026-11-01',
    notes: [
      'The rope pulls 3 squares instead of 2. It still reaches 6, you still choose whether '
        + 'it sets off across the river or along it, and the price is unchanged.',
    ],
  },
  {
    version: '0.09',
    date: '2026-11-01',
    notes: [
      'Swans no longer fight a current that is carrying them toward the far bank. They '
        + 'brace against water pushing them sideways or back, and ride the rest. Their '
        + 'ability was turning down the only thing the river gives away for nothing.',
      'Worth 9 points of win rate over 500 games a side, 15.6% to 24.6%, and it brought '
        + 'the Ducks down from 29.8% to 27.6% without the Duck ability being touched.',
      'Frogs may use ropes again. Anchors are still out. The ban was printed when a rope '
        + 'reached three squares; at six it is the best thing in the shop, and being the '
        + 'one faction shut out of it cost them more than the extra action was worth.',
      'Measured and not kept: letting the Frogs play two Power Cards a round changed '
        + 'nothing at all. The knob is in the rules editor, switched off.',
      'The computer opponents stop buying Power Cards once two are sitting unplayed.',
    ],
  },
  {
    version: '0.08',
    date: '2026-11-01',
    notes: [
      'The animal carrying the Ducks\u2019 extra square is never out of the current: an '
        + 'anchor and a Current Shield both slide off it. It makes naming that animal a '
        + 'real decision rather than an accident of which duck moved last.',
      'Switchable in the rules editor under Factions, because it is worth being able to '
        + 'turn a price off and see what the ability is worth without one.',
      'Measured over 200 games, and worth saying plainly: the price does not change the '
        + 'balance. The computer opponents anchor a duck 0.43 times a game, so it almost '
        + 'never comes up for them. It is a decision for a person at the table.',
      'Also measured: the Ducks win 17.5% with no ability at all, 21.5% with their '
        + 'movement concentrated instead of increased, and 32.5% with eight animals rather '
        + 'than ten. The animal count does nothing, because they only get 3.4 across.',
    ],
  },
  {
    version: '0.07',
    date: '2026-11-01',
    notes: [
      'Destroying a dam now bursts the line it was holding: every square it was calming '
        + 'runs at current 3 from then on, face up, instead of going back to what it was.',
      'A computer opponent answers a trade the moment you make it, and the answer comes up '
        + 'in a popup: taken, turned down, or a counter-offer with Take it and Leave it on it.',
      'The rope reaches 6 squares rather than 3, still pulls 2, and you choose whether those '
        + 'two are spent across the river or along it. It costs 1 Wood, 1 Clay, 2 Reeds.',
      'The raft costs 1 of everything. The dam and the anchor are unchanged.',
      'New Duck ability: one of their animals moves an extra square every turn, and whichever '
        + 'animal spends it first keeps it for the rest of the game. Go With the Flow is off, '
        + 'because it was the mirror of Swan resistance and one of the two had to be better.',
      'A Distraction drag cannot put more than 4 animals on the token square. It says so '
        + 'before you commit, and refuses the whole set rather than quietly stopping one short.',
      'Worth knowing: the new Duck ability wins 31.5% of simulated games against the old '
        + 'ability\u2019s 24%, so it may want trimming.',
    ],
  },
  {
    version: '0.06',
    date: '2026-10-31',
    notes: [
      'Fixed: a saved rules file from an older build was overriding new defaults, so the '
        + 'edge rule, the dam axis and both new card decks never reached you. Saved rules '
        + 'and games are now stamped with the rules they were written against, and dropped '
        + 'when the rules move on.',
      'An animal standing on the edge with the current pointing at it is now always carried '
        + 'over, at every strength. Resisting the current makes the push smaller, which at '
        + 'the edge no longer saves you - but a dam, an island, an anchor or a shield still '
        + 'does.',
    ],
  },
  {
    version: '0.05',
    date: '2026-10-31',
    notes: [
      'The river now carries an animal over the side of the board and out of the game. '
        + 'Only the river does it: walking, a rope and a card all stop at the edge.',
      'Ranges are counted in straight lines, never diagonally, so three squares means three '
        + 'steps along the rows and columns. Distraction tokens, ropes and Rescue all changed.',
      'Dams hold the water to the left and right of them instead of above and below, and '
        + 'those squares now read 0 on the board until the dam is destroyed.',
      'Trading: offer another player resources and Power Cards. They take it, leave it, or '
        + 'name their own terms for you to take or leave.',
      'Two new Power Cards: Break for It moves an animal up to 2 in any direction, and Rally '
        + 'brings one of your animals to another. The weaker cards are rarer.',
    ],
  },
  {
    version: '0.04',
    date: '2026-10-31',
    notes: [
      'Half the production deck now pays nothing at all in one area, and a card may only do '
        + 'that if it pays 4 somewhere else. A blank is the price of a glut.',
      'River tiles are turned so their printed arrows point the way the water actually runs, '
        + 'instead of always pointing right.',
      'Four animals to a river square. It stops you moving, roping, rafting or dragging a '
        + 'fifth onto one; it does not stop the river, which carries a whole stack.',
    ],
  },
  {
    version: '0.03',
    date: '2026-10-30',
    notes: [
      'Only 5 currents start face up. Every other tile is face down until an animal '
        + 'stands on it.',
      'Nearly every tile now flows, and each one has its own direction: about half push '
        + 'sideways, a quarter forward and a quarter back. A current of 4 is always sideways.',
      'Two collectors each, placed in two areas or stacked on one, and each is paid '
        + 'separately.',
      'Production cards pay every area at least 1, and the card is shown in full all round.',
      'Distraction tokens: one each, played on a river tile. Everything within 3 squares '
        + 'rolls a d6, Ducks need a 6, and you drag whoever looks away up to 3 squares in.',
      'Secret roles are parked for now. They can be switched back on in the rules editor.',
      'Every piece of equipment has a "?" that says exactly what it does before you buy it.',
      'Because so many defaults moved, this build starts from a clean set of rules: a game '
        + 'or a tuned ruleset saved under v0.02 is not carried over.',
    ],
  },
  {
    version: '0.02',
    date: '2026-10-29',
    notes: [
      'The board is drawn with the printed artwork: tiles off the tile sheet, whirlpools '
        + 'off the whirlpool sheet and the banks off the starter map.',
      'Each animal is now its faction portrait rather than a coloured dot.',
      'Resource and equipment icons taken from the illustrated rules sheet.',
      'Current strength now reads as a numeral, since the tile art draws the arrows.',
      'A disabled Build or Draw button says what is missing instead of only greying out.',
    ],
  },
  {
    version: '0.01',
    date: '2026-10-29',
    notes: [
      'First playable prototype: 10 rounds, four factions, hot seat and three AI opponents.',
      'Board, currents, hidden currents, whirlpools, islands and dams.',
      'Collectors and production cards, equipment, 34 Power Cards, 8 missions, secret roles.',
      'Rules editor with import and export, seeded replays, game log and CSV export.',
    ],
  },
]
