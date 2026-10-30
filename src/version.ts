export const VERSION = '0.03'

export interface ChangelogEntry {
  version: string
  date: string
  notes: string[]
}

// Newest first.
export const CHANGELOG: ChangelogEntry[] = [
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
