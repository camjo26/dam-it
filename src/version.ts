export const VERSION = '0.06'

export interface ChangelogEntry {
  version: string
  date: string
  notes: string[]
}

// Newest first.
export const CHANGELOG: ChangelogEntry[] = [
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
