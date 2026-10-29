////////////////////////////////////////////////////////////////////////////////////////////////
// Board artwork.
//
// Maps game objects to the pictures cut out of the printed component sheets by
// scripts/extract-art.py. Paths are relative, with no leading slash, so they resolve on the
// /<slug>/ subpath GitHub Pages serves from.
//
// Several tiles of each kind were cut so the river is not visibly tiled. The variant is
// picked from the tile's own coordinates rather than at random, so a tile keeps the same
// face for the whole game and a replayed seed looks identical.
////////////////////////////////////////////////////////////////////////////////////////////////

import type { EquipmentId, FactionId, ResourceId, Tile } from '../game/types'

const ART = 'art/'

const PLAIN_VARIANTS = 3
const CURRENT_VARIANTS: Record<number, number> = { 1: 3, 2: 3, 3: 3, 4: 2 }
const ISLAND_VARIANTS = 3
const WHIRLPOOL_VARIANTS = 3

const LETTERS = ['a', 'b', 'c', 'd']

// Two odd multipliers so neighbouring tiles rarely land on the same face in either axis.
const COL_SPREAD = 7
const ROW_SPREAD = 13

function variant(col: number, row: number, count: number): string {
  return LETTERS[(col * COL_SPREAD + row * ROW_SPREAD) % count]
}

/**
 * The picture for a river tile. `revealed` must be false while a hidden current is still
 * secret: the artwork draws the arrows, so showing the real tile would give the strength
 * away before an animal has entered it.
 */
export function tileArt(tile: Tile, revealed: boolean): string | null {
  const { col, row } = tile
  if (tile.kind === 'bank-top' || tile.kind === 'bank-bottom') return null
  if (tile.kind === 'island') {
    const size = tile.islandSize === 'large' ? 'large' : 'small'
    return `${ART}tile/island-${size}-${variant(col, row, ISLAND_VARIANTS)}.png`
  }
  if (tile.kind === 'whirlpool') {
    return `${ART}tile/whirlpool-${variant(col, row, WHIRLPOOL_VARIANTS)}.png`
  }
  if (!revealed || tile.current === 0) {
    return `${ART}tile/plain-${variant(col, row, PLAIN_VARIANTS)}.png`
  }
  const count = CURRENT_VARIANTS[tile.current] ?? 1
  return `${ART}tile/current-${tile.current}-${variant(col, row, count)}.png`
}

export const BANK_TOP_ART = `${ART}bank-top.png`
export const BANK_BOTTOM_ART = `${ART}bank-bottom.png`

export function factionArt(faction: FactionId): string {
  return `${ART}faction/${faction}.png`
}

export function resourceArt(resource: ResourceId): string {
  return `${ART}res/${resource}.png`
}

export function equipmentArt(equipment: EquipmentId): string {
  return `${ART}kit/${equipment}.png`
}

/** Shorthand for the inline style these all end up in. */
export function bg(url: string): { backgroundImage: string } {
  return { backgroundImage: `url(${url})` }
}
