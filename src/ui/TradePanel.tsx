////////////////////////////////////////////////////////////////////////////////////////////////
// Trading with another player.
//
// Two panels in one file, because they are two halves of the same conversation: the offer you
// build and send, and the answer that comes back. The answer panel takes over the column while
// a trade is on the table, since nothing else can happen until it is settled.
////////////////////////////////////////////////////////////////////////////////////////////////

import { useState } from 'react'

import { cardById } from '../game/cards'
import type { GameAction } from '../game/engine'
import { bagTotal, describeTerms } from '../game/trade'
import type { GameState, Player, ResourceBag } from '../game/types'
import { RESOURCE_IDS, RESOURCE_LABELS } from '../game/types'
import { bg, factionArt, resourceArt } from './art'

function emptyBag(): ResourceBag {
  return { wood: 0, stone: 0, clay: 0, reeds: 0 }
}

/** A row of minus/plus steppers for one resource, used on both sides of the offer. */
function ResourceRow({
  bag,
  onChange,
  ceiling,
}: {
  bag: ResourceBag
  onChange: (next: ResourceBag) => void
  /** The most that may be picked per resource, or undefined for no limit. */
  ceiling?: ResourceBag
}) {
  return (
    <div className="trade-rows">
      {RESOURCE_IDS.map((id) => {
        const max = ceiling ? ceiling[id] : Infinity
        return (
          <div key={id} className="trade-row">
            <span className={`res ${id}`}>
              <span className="swatch" style={bg(resourceArt(id))} />
              {RESOURCE_LABELS[id]}
            </span>
            <span className="spacer" />
            <button
              className="btn tiny"
              disabled={bag[id] <= 0}
              onClick={() => onChange({ ...bag, [id]: bag[id] - 1 })}
            >
              -
            </button>
            <b className="trade-amount">{bag[id]}</b>
            <button
              className="btn tiny"
              disabled={bag[id] >= max}
              onClick={() => onChange({ ...bag, [id]: bag[id] + 1 })}
            >
              +
            </button>
          </div>
        )
      })}
    </div>
  )
}

export function TradePanel({
  state,
  player,
  dispatch,
}: {
  state: GameState
  player: Player
  dispatch: (action: GameAction) => boolean
}) {
  const [open, setOpen] = useState(false)
  const [withId, setWithId] = useState<string | null>(null)
  const [giveResources, setGiveResources] = useState<ResourceBag>(emptyBag)
  const [giveCards, setGiveCards] = useState<string[]>([])
  const [wantResources, setWantResources] = useState<ResourceBag>(emptyBag)
  const [wantCards, setWantCards] = useState(0)

  if (!state.rules.trade.enabled) return null
  if (state.pendingTrade) return null

  const others = state.players.filter((p) => p.id !== player.id)
  const used = state.tradesProposedThisTurn[player.id] ?? 0
  const left = state.rules.trade.proposalsPerTurn - used
  const target = others.find((p) => p.id === withId) ?? null

  const reset = () => {
    setGiveResources(emptyBag())
    setGiveCards([])
    setWantResources(emptyBag())
    setWantCards(0)
  }

  const offering = bagTotal(giveResources) + giveCards.length
  const asking = bagTotal(wantResources) + wantCards
  const canSend = target !== null && (offering > 0 || asking > 0) && left > 0

  if (!open) {
    return (
      <>
        <div className="section-title">Trading</div>
        <div className={`shop-item${left <= 0 ? ' unaffordable' : ''}`}>
          <div className="info">
            <div className="label">Offer somebody a trade</div>
            <div className="cost">
              <span className="faint">
                Swap resources and Power Cards. They can take it, leave it, or name their own
                terms for you to take or leave.
              </span>
            </div>
            {left <= 0 && <div className="blocked">Already proposed a trade this turn</div>}
          </div>
          <button className="btn small" disabled={left <= 0} onClick={() => setOpen(true)}>
            Trade
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="section-title">Trading</div>
      <div className="trade-builder">
        <div className="row wrap" style={{ marginBottom: 8 }}>
          <span className="faint">With</span>
          {others.map((other) => (
            <button
              key={other.id}
              className={`btn tiny${withId === other.id ? ' primary' : ''}`}
              onClick={() => setWithId(other.id)}
            >
              {other.name}
            </button>
          ))}
        </div>

        <div className="trade-side">
          <div className="trade-heading">You give</div>
          <ResourceRow
            bag={giveResources}
            onChange={setGiveResources}
            ceiling={player.resources}
          />
          {player.hand.length > 0 && (
            <div className="trade-cards">
              {player.hand.map((held) => {
                const card = cardById(state, held.cardId)
                const picked = giveCards.includes(held.instanceId)
                return (
                  <button
                    key={held.instanceId}
                    className={`btn tiny${picked ? ' primary' : ''}`}
                    onClick={() =>
                      setGiveCards(
                        picked
                          ? giveCards.filter((id) => id !== held.instanceId)
                          : [...giveCards, held.instanceId],
                      )
                    }
                  >
                    {card?.name ?? 'Card'}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="trade-side">
          <div className="trade-heading">You get</div>
          <ResourceRow bag={wantResources} onChange={setWantResources} />
          <div className="trade-row">
            {/* Asked for by number, not by name: their hand is secret, so you cannot ask
                for a card you have never seen. They choose which to part with. */}
            <span className="faint">Power Cards, their choice</span>
            <span className="spacer" />
            <button
              className="btn tiny"
              disabled={wantCards <= 0}
              onClick={() => setWantCards(wantCards - 1)}
            >
              -
            </button>
            <b className="trade-amount">{wantCards}</b>
            <button
              className="btn tiny"
              disabled={target !== null && wantCards >= target.hand.length}
              onClick={() => setWantCards(wantCards + 1)}
            >
              +
            </button>
          </div>
        </div>

        <div className="row" style={{ marginTop: 10 }}>
          <button
            className="btn primary"
            style={{ flex: 1 }}
            disabled={!canSend}
            title={canSend ? 'Send this offer' : 'Pick who to trade with and what to swap'}
            onClick={() => {
              if (!target) return
              const sent = dispatch({
                type: 'propose-trade',
                toPlayerId: target.id,
                offer: { resources: giveResources, cardInstanceIds: giveCards },
                request: { resources: wantResources, cardCount: wantCards },
              })
              if (sent) {
                reset()
                setOpen(false)
              }
            }}
          >
            Send offer
          </button>
          <button
            className="btn"
            onClick={() => {
              reset()
              setOpen(false)
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  )
}

////////////////////////////////////////////////////////////////////////////////////////////////

/** The answer to a trade, and the proposer's last word on a counter-offer. */
export function TradeReply({
  state,
  dispatch,
}: {
  state: GameState
  dispatch: (action: GameAction) => boolean
}) {
  const trade = state.pendingTrade
  if (!trade) return null

  const from = state.players.find((p) => p.id === trade.fromPlayerId)
  const to = state.players.find((p) => p.id === trade.toPlayerId)
  if (!from || !to) return null

  const askedFor = describeTerms(
    { resources: trade.request.resources, cardInstanceIds: [] },
    trade.request.cardCount,
  )

  return (
    <div className="panel">
      <header>Trade with {to.name}</header>
      <div className="body">
        <div className="hint" style={{ marginBottom: 10 }}>
          <b>{from.name}</b> offers <b>{describeTerms(trade.offer)}</b> for{' '}
          <b>{askedFor}</b>.
        </div>

        {trade.status === 'awaiting-reply' && (
          <>
            <div className="faint">Waiting for {to.name} to answer...</div>
            {to.controller === 'human' && (
              <button
                className="btn primary"
                style={{ width: '100%', marginTop: 10 }}
                onClick={() => dispatch({ type: 'answer-trade' })}
              >
                Let {to.name} answer
              </button>
            )}
          </>
        )}

        {trade.status === 'countered' && trade.counter && (
          <>
            <div className="trade-counter">
              {/* Phrased around the name rather than through a verb, because the factions
                  are plurals and "Swans says" reads wrong. */}
              <b>That is a no from {to.name}.</b>
              <div style={{ marginTop: 4 }}>{trade.reply}</div>
              <div style={{ marginTop: 8 }}>
                They will give <b>{describeTerms(trade.counter)}</b> for your{' '}
                <b>{describeTerms(trade.offer)}</b>.
              </div>
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <button
                className="btn primary"
                style={{ flex: 1 }}
                onClick={() => dispatch({ type: 'settle-trade', accept: true })}
              >
                Take it
              </button>
              <button
                className="btn danger"
                onClick={() => dispatch({ type: 'settle-trade', accept: false })}
              >
                Leave it
              </button>
            </div>
          </>
        )}

        <button
          className="btn tiny ghost"
          style={{ marginTop: 10 }}
          onClick={() => dispatch({ type: 'withdraw-trade' })}
        >
          Take the offer off the table
        </button>
      </div>
    </div>
  )
}


////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * What came back from a trade, as a popup rather than a line in the log.
 *
 * A computer opponent answers in the same instant the offer goes out, so there is no pause to
 * watch and nothing to wait for: without stopping the screen the whole negotiation would
 * happen between one click and the next, and the answer would scroll past unread.
 */
export function TradeOutcomePopup({
  state,
  dispatch,
}: {
  state: GameState
  dispatch: (action: GameAction) => boolean
}) {
  const outcome = state.tradeOutcome
  if (!outcome) return null

  const them = state.players.find((p) => p.id === outcome.toPlayerId)
  const close = () => dispatch({ type: 'dismiss-trade-outcome' })

  return (
    <div className="overlay" onClick={close}>
      <div className="modal small" onClick={(event) => event.stopPropagation()}>
        <header>
          {them && (
            <span className={`pip ${them.factionId}`} style={bg(factionArt(them.factionId))} />
          )}
          <h2>{outcome.headline}</h2>
          <span className="spacer" />
          <button className="btn ghost" onClick={close}>
            Close
          </button>
        </header>
        <div className="body">
          <div className="hint" style={{ marginBottom: 10 }}>{outcome.terms}</div>
          {outcome.detail && <div className="faint">{outcome.detail}</div>}

          {outcome.status === 'countered' ? (
            <div className="row" style={{ marginTop: 14 }}>
              <button
                className="btn primary"
                style={{ flex: 1 }}
                onClick={() => dispatch({ type: 'settle-trade', accept: true })}
              >
                Take it
              </button>
              <button
                className="btn danger"
                onClick={() => dispatch({ type: 'settle-trade', accept: false })}
              >
                Leave it
              </button>
            </div>
          ) : (
            <button
              className="btn primary"
              style={{ width: '100%', marginTop: 14 }}
              onClick={close}
            >
              Right you are
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
