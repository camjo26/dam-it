////////////////////////////////////////////////////////////////////////////////////////////////
// Aiming a card, a dam or a rope.
//
// A card is aimed by walking through a short list of picks. Each card's list is derived from
// its requirement in the rules data, so a new card needs no new interface code as long as it
// asks for things already on this list.
////////////////////////////////////////////////////////////////////////////////////////////////

import { CARD_REQUIREMENTS, type CardTarget } from '../game/cards'

export type PickKind =
  | 'own-animal'
  | 'second-own-animal'
  | 'enemy-animal'
  | 'any-animal'
  | 'tile'
  | 'second-tile'
  | 'adjacent-island'
  | 'direction-sideways'
  | 'direction-forward-back'
  | 'direction-any'
  | 'two-resources'

export const PICK_PROMPTS: Record<PickKind, string> = {
  'own-animal': 'Click one of your own animals on the board.',
  'second-own-animal': 'Now click the animal of yours it should join.',
  'enemy-animal': "Click another player's animal on the board.",
  'any-animal': 'Click any animal on the board.',
  tile: 'Click a tile on the board.',
  'second-tile': 'Click the second tile.',
  'adjacent-island': 'Click an island next to that animal.',
  'direction-sideways': 'Choose a direction: left or right.',
  'direction-forward-back': 'Choose a direction: forward or backward.',
  'direction-any': 'Choose which way it breaks.',
  'two-resources': 'Choose two different resources.',
}

/** The picks a card needs, in the order the player is asked for them. */
export function cardPicks(cardId: string): PickKind[] {
  const requirement = CARD_REQUIREMENTS[cardId]
  if (!requirement) return []

  const picks: PickKind[] = []
  if (requirement.ownAnimal) picks.push('own-animal')
  else if (requirement.enemyAnimal) picks.push('enemy-animal')
  else if (cardId === 'whirlpool') picks.push('any-animal')

  if (requirement.secondOwnAnimal) picks.push('second-own-animal')
  if (requirement.adjacentIsland) picks.push('adjacent-island')
  else if (requirement.tile) picks.push('tile')

  if (requirement.secondTile) picks.push('second-tile')
  if (requirement.direction === 'sideways') picks.push('direction-sideways')
  if (requirement.direction === 'forward-back') picks.push('direction-forward-back')
  if (requirement.direction === 'any') picks.push('direction-any')
  if (requirement.resourceChoices) picks.push('two-resources')

  return picks
}

export type Targeting =
  | { kind: 'place-dam' }
  | { kind: 'rope'; animalId: string | null; towardAnimalId?: string }
  | { kind: 'saboteur' }
  | { kind: 'distraction' }
  | {
      kind: 'card'
      instanceId: string
      cardId: string
      picks: PickKind[]
      step: number
      target: CardTarget
    }
  | null

export function startCardTargeting(instanceId: string, cardId: string): Targeting {
  return {
    kind: 'card',
    instanceId,
    cardId,
    picks: cardPicks(cardId),
    step: 0,
    target: {},
  }
}

export function targetingPrompt(targeting: Targeting): string | null {
  if (!targeting) return null
  if (targeting.kind === 'place-dam') return 'Click a river tile to build the dam on.'
  if (targeting.kind === 'saboteur') return 'Click a river tile to strengthen its current.'
  if (targeting.kind === 'distraction') {
    return 'Click a river tile to drop the Distraction token on. Everything near it rolls, ' +
      'including your own animals.'
  }
  if (targeting.kind === 'rope') {
    if (targeting.animalId === null) return 'Click the animal you want to pull.'
    if (!targeting.towardAnimalId) return 'Click the animal of yours to pull it toward.'
    return 'Which way should it set off? It has two squares to spend.'
  }
  const pick = targeting.picks[targeting.step]
  return pick ? PICK_PROMPTS[pick] : null
}

/** True once every pick has been made and the card can be played. */
export function targetingComplete(targeting: Targeting): boolean {
  if (!targeting || targeting.kind !== 'card') return false
  return targeting.step >= targeting.picks.length
}
