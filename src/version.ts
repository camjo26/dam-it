export const VERSION = '0.02'

export interface ChangelogEntry {
  version: string
  date: string
  notes: string[]
}

// Newest first.
export const CHANGELOG: ChangelogEntry[] = [
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
