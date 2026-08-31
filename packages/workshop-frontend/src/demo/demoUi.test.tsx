// @vitest-environment jsdom
/* eslint-disable react/react-in-jsx-scope */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FounderMatch } from './FounderMatch'
import { WantedBoard } from './WantedBoard'
import { WishConfirmation } from './WishConfirmation'
import { WishForm } from './WishForm'
import { demoStore } from './demoStore'
import {
  EMPTY_FORM_VALUES,
  FIXTURE_FORM_VALUES,
  PRIMARY_MATCH,
  PRIMARY_OFFER,
  PRIMARY_SUPPLIER,
  PRIMARY_WISH,
} from './fixtures'
import { projectBoardCard } from './boardProjection'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
window.scrollTo = () => {}

describe('demo UI states', () => {
  let container: HTMLDivElement | undefined
  let root: Root | undefined

  beforeEach(() => {
    demoStore.reset()
  })

  afterEach(async () => {
    await act(async () => root?.unmount())
    container?.remove()
    demoStore.reset()
    vi.useRealTimers()
  })

  async function render(node: React.ReactNode) {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    await act(async () => {
      root!.render(node)
    })
    return container
  }

  it('WishForm initial shows synthetic notice and H1', async () => {
    const el = await render(<WishForm skipDelay />)
    expect(el.textContent).toContain('Synthetic demo · No request will be sent')
    expect(el.textContent).toContain('Find a Japanese vintage lens you can trust.')
  })

  it('WishForm validation error shows contract copy', async () => {
    const el = await render(<WishForm skipDelay />)
    const form = el.querySelector('form')
    expect(form).toBeTruthy()
    await act(async () => {
      form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    expect(el.textContent).toContain('Enter a focal length greater than 0.')
    expect(el.textContent).toContain('Choose what optical condition you can accept.')
    expect(el.textContent).toContain('Enter a budget and currency.')
    expect(el.textContent).toContain('Choose a destination country or region.')
    expect(el.textContent).toContain('Confirm the synthetic-demo notice to continue.')
  })

  it('WishForm loading shows status copy', async () => {
    vi.useFakeTimers()
    demoStore.setForm(FIXTURE_FORM_VALUES)
    const el = await render(<WishForm />)
    const form = el.querySelector('form')
    await act(async () => {
      form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    expect(el.textContent).toContain('Structuring your demo wish locally…')
    await act(async () => {
      await vi.runAllTimersAsync()
    })
  })

  it('WishForm structuring error via demoFault', async () => {
    demoStore.setForm(FIXTURE_FORM_VALUES)
    const el = await render(<WishForm demoFault="structuring" skipDelay />)
    const form = el.querySelector('form')
    await act(async () => {
      form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    expect(el.textContent).toContain('We couldn’t structure this demo wish. Your entries are still here.')
    expect(el.textContent).toContain('Try again')
    expect(el.textContent).toContain('Edit fields')
  })

  it('WishConfirmation shows Human Gate and confirmed tags', async () => {
    demoStore._replaceForTests({
      form: FIXTURE_FORM_VALUES,
      wish: { ...PRIMARY_WISH, status: 'draft', confirmed_at: null },
      supplier: null,
      offer: null,
      match: null,
      boardCard: null,
    })
    const el = await render(
      <WishConfirmation wishId={PRIMARY_WISH.id} />,
    )
    expect(el.textContent).toContain('Confirm your structured wish')
    expect(el.textContent).toContain(
      'Human Gate: A real wish would require approved consent, privacy review, and external-send approval. This demo performs none of those actions.',
    )
    expect(el.textContent).toContain('Confirmed')
    expect(el.textContent).toContain('No specific serial number requested.')
  })

  it('WishConfirmation blocked disables confirm', async () => {
    demoStore._replaceForTests({
      form: EMPTY_FORM_VALUES,
      wish: { ...PRIMARY_WISH, status: 'draft', confirmed_at: null },
      supplier: null,
      offer: null,
      match: null,
      boardCard: null,
    })
    const el = await render(
      <WishConfirmation wishId={PRIMARY_WISH.id} forceBlocked />,
    )
    expect(el.textContent).toContain('Confirm this value to continue')
    const btn = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Confirm demo wish'),
    )
    expect(btn).toBeTruthy()
    expect(btn!.hasAttribute('disabled') || (btn as HTMLButtonElement).disabled).toBe(true)
  })

  it('FounderMatch success and Human Gate', async () => {
    demoStore._replaceForTests({
      form: FIXTURE_FORM_VALUES,
      wish: PRIMARY_WISH,
      supplier: PRIMARY_SUPPLIER,
      offer: PRIMARY_OFFER,
      match: PRIMARY_MATCH,
      boardCard: projectBoardCard(PRIMARY_WISH.structured),
    })
    const el = await render(<FounderMatch matchId={PRIMARY_MATCH.id} />)
    expect(el.textContent).toContain('Founder demo offer matched')
    expect(el.textContent).toContain('Synthetic demo · Internal only')
    expect(el.textContent).toContain('Unknown')
    expect(el.textContent).toContain('Not quoted')
    expect(el.textContent).toContain('Not verified')
    expect(el.textContent).toContain(
      'Human Gate: Real supplier routing, offer approval, compliance review, pricing, buyer confirmation, payment, and shipping require separate named-human approval.',
    )
  })

  it('FounderMatch offer empty', async () => {
    const el = await render(<FounderMatch matchId={PRIMARY_MATCH.id} forceEmpty />)
    expect(el.textContent).toContain('No synthetic offer yet.')
    expect(el.textContent).toContain('Create founder demo offer')
  })

  it('FounderMatch mismatch error', async () => {
    demoStore._replaceForTests({
      form: FIXTURE_FORM_VALUES,
      wish: PRIMARY_WISH,
      supplier: PRIMARY_SUPPLIER,
      offer: PRIMARY_OFFER,
      match: PRIMARY_MATCH,
      boardCard: null,
    })
    const el = await render(
      <FounderMatch matchId={PRIMARY_MATCH.id} forceMismatch />,
    )
    expect(el.textContent).toContain('The demo offer does not match the confirmed wish.')
    expect(el.textContent).toContain('offer.wish_id')
    expect(el.textContent).toContain('Return to wish')
  })

  it('WantedBoard empty and success', async () => {
    let el = await render(<WantedBoard forceEmpty />)
    expect(el.textContent).toContain('No confirmed synthetic wishes to show.')
    expect(el.textContent).toContain('Create a demo wish')

    await act(async () => root?.unmount())
    container?.remove()

    demoStore._replaceForTests({
      form: FIXTURE_FORM_VALUES,
      wish: PRIMARY_WISH,
      supplier: PRIMARY_SUPPLIER,
      offer: PRIMARY_OFFER,
      match: PRIMARY_MATCH,
      boardCard: projectBoardCard(PRIMARY_WISH.structured),
    })
    el = await render(<WantedBoard />)
    expect(el.textContent).toContain('Wanted in Japan')
    expect(el.textContent).toContain('Canon FD 50mm f/1.4 S.S.C. vintage lens')
    expect(el.textContent).toContain('USD 300–399')
    expect(el.textContent).toContain('By Oct 2026')
    expect(el.textContent).toContain(
      'Synthetic demo · No real buyer, supplier, listing, or inventory.',
    )
  })
})
