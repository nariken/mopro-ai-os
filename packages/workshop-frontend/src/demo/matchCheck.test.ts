import { describe, expect, it } from 'vitest'
import { matchCheck } from './matchCheck'
import {
  MISMATCHED_OFFER,
  PRIMARY_OFFER,
  PRIMARY_SUPPLIER,
  PRIMARY_WISH,
} from './fixtures'

describe('matchCheck', () => {
  it('accepts the primary fixture', () => {
    expect(matchCheck(PRIMARY_WISH, PRIMARY_OFFER, PRIMARY_SUPPLIER)).toEqual({ ok: true })
  })

  it('rejects mismatched offer.wish_id', () => {
    const result = matchCheck(PRIMARY_WISH, MISMATCHED_OFFER, PRIMARY_SUPPLIER)
    expect(result).toEqual({ ok: false, field: 'offer.wish_id' })
  })

  it('rejects unconfirmed wish', () => {
    const draft = { ...PRIMARY_WISH, status: 'draft' as const, confirmed_at: null }
    expect(matchCheck(draft, PRIMARY_OFFER, PRIMARY_SUPPLIER)).toEqual({
      ok: false,
      field: 'wish.status',
    })
  })
})
