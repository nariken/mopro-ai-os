import { describe, expect, it, vi } from 'vitest'
import { FIXTURE_FORM_VALUES, EMPTY_FORM_VALUES } from './fixtures'
import { structureWish } from './structureWish'

describe('structureWish', () => {
  it('structures the happy fixture deterministically', () => {
    const a = structureWish(FIXTURE_FORM_VALUES)
    const b = structureWish(FIXTURE_FORM_VALUES)
    expect(a).toEqual(b)
    expect(a.ok).toBe(true)
    if (!a.ok) return
    expect(a.wish.id).toBe('wish_syn_20260831_001')
    expect(a.wish.structured.item_name).toBe('Canon FD 50mm f/1.4 S.S.C.')
    expect(a.wish.structured.focal_length_mm).toBe(50)
    expect(a.wish.structured.budget).toEqual({
      amount: 350,
      currency: 'USD',
      scope: 'item_only',
    })
    expect(a.wish.structured.destination_region).toBe('US')
    expect(a.wish.structured.contact_consent).toBe(false)
    expect(a.wish.raw.buyer_name).toBe('Alex Demo')
  })

  it('fails required fields independently', () => {
    const cases: Array<{ patch: Partial<typeof EMPTY_FORM_VALUES>; key: string }> = [
      { patch: { ...FIXTURE_FORM_VALUES, focal_length_mm: '0' }, key: 'focal_length_mm' },
      { patch: { ...FIXTURE_FORM_VALUES, optical_tolerance: [] }, key: 'optical_tolerance' },
      { patch: { ...FIXTURE_FORM_VALUES, budget_amount: '' }, key: 'budget' },
      { patch: { ...FIXTURE_FORM_VALUES, destination_region: '' }, key: 'destination_region' },
      { patch: { ...FIXTURE_FORM_VALUES, demo_acknowledged: false }, key: 'demo_acknowledged' },
    ]
    for (const { patch, key } of cases) {
      const result = structureWish({ ...EMPTY_FORM_VALUES, ...patch })
      expect(result.ok).toBe(false)
      if (result.ok) continue
      expect(result.errors[key as keyof typeof result.errors]).toBeTruthy()
    }
  })

  it('does not call fetch or WebSocket', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      throw new Error('fetch must not be called')
    })
    const wsSpy = vi.spyOn(globalThis, 'WebSocket').mockImplementation(() => {
      throw new Error('WebSocket must not be called')
    })
    structureWish(FIXTURE_FORM_VALUES)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(wsSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
    wsSpy.mockRestore()
  })
})
