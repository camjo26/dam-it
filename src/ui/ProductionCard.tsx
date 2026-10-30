////////////////////////////////////////////////////////////////////////////////////////////////
// The production card that was turned over this round.
//
// Shown for the whole round rather than only in the log, because it is the one piece of public
// information everybody is playing against: it says what each collector is earning right now,
// and what the player who stacked both collectors on clay actually got for it.
////////////////////////////////////////////////////////////////////////////////////////////////

import { productionCard } from '../game/production'
import type { GameState } from '../game/types'
import { RESOURCE_LABELS } from '../game/types'
import { COLLECTOR_AREAS } from '../game/rules'
import { bg, resourceArt } from './art'

export function ProductionCard({ state }: { state: GameState }) {
  const cardId = state.production.lastRevealedCardId
  if (!cardId) return null
  if (state.phase === 'resource' || state.phase === 'setup') return null

  const card = productionCard(state, cardId)
  if (!card) return null

  return (
    <div className="panel">
      <header>This round&apos;s production</header>
      <div className="body">
        <div className="prod-card">
          <div className="prod-name">{card.name}</div>
          <div className="prod-yields">
            {COLLECTOR_AREAS.map((area) => (
              <div key={area} className={`prod-yield ${area}`}>
                <span className="swatch" style={bg(resourceArt(area))} />
                <span className="amount">{card.yields[area]}</span>
                <span className="who">{RESOURCE_LABELS[area]}</span>
              </div>
            ))}
          </div>
          <div className="faint prod-note">Paid to every collector standing in that area.</div>
        </div>
      </div>
    </div>
  )
}
