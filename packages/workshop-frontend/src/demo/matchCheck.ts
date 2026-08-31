import type { DemoOffer, DemoSupplier, DemoWish } from './types'

export type MatchCheckResult =
  | { ok: true }
  | { ok: false; field: string }

/**
 * Structural compatibility check between confirmed wish and synthetic offer.
 * No override that hides a mismatch.
 */
export function matchCheck(
  wish: DemoWish,
  offer: DemoOffer,
  supplier: DemoSupplier,
): MatchCheckResult {
  if (wish.status !== 'confirmed') {
    return { ok: false, field: 'wish.status' }
  }
  if (offer.wish_id !== wish.id) {
    return { ok: false, field: 'offer.wish_id' }
  }
  if (offer.supplier_id !== supplier.id) {
    return { ok: false, field: 'offer.supplier_id' }
  }
  return { ok: true }
}
