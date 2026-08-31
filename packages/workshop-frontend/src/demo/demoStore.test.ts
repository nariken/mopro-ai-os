// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DEMO_STORAGE_KEY, demoStore, hydrateDemoStore } from './demoStore'
import { EMPTY_FORM_VALUES, FIXTURE_FORM_VALUES } from './fixtures'

describe('demoStore', () => {
  beforeEach(() => {
    sessionStorage.clear()
    demoStore.reset()
  })

  afterEach(() => {
    sessionStorage.clear()
    demoStore.reset()
  })

  it('persists and reads form values', () => {
    demoStore.setForm(FIXTURE_FORM_VALUES)
    expect(demoStore.getState().form.item_name).toBe('Canon FD 50mm f/1.4 S.S.C.')
    const raw = sessionStorage.getItem(DEMO_STORAGE_KEY)
    expect(raw).toBeTruthy()
    demoStore.reset()
    sessionStorage.setItem(DEMO_STORAGE_KEY, raw!)
    hydrateDemoStore()
    expect(demoStore.getState().form.item_name).toBe('Canon FD 50mm f/1.4 S.S.C.')
  })

  it('reset clears records and form', () => {
    demoStore.setForm(FIXTURE_FORM_VALUES)
    demoStore.reset()
    expect(demoStore.getState().form).toEqual(EMPTY_FORM_VALUES)
    expect(demoStore.getState().wish).toBeNull()
    expect(sessionStorage.getItem(DEMO_STORAGE_KEY)).toBeNull()
  })

  it('recovers safely from corrupt JSON', () => {
    sessionStorage.setItem(DEMO_STORAGE_KEY, '{not-json')
    hydrateDemoStore()
    expect(demoStore.getState().form.item_name).toBe('')
    expect(demoStore.getState().wish).toBeNull()
  })
})
