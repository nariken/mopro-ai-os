// @vitest-environment jsdom
/* eslint-disable react/react-in-jsx-scope */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { projectBoardCard } from './boardProjection'
import { WantedBoard } from './WantedBoard'
import { demoStore } from './demoStore'
import { PRIMARY_WISH } from './fixtures'
import type { DemoBoardCard } from './types'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const FORBIDDEN = [
  'Alex Demo',
  'alex.demo@example.invalid',
  'Minor cleaning marks',
  'minor_cleaning_marks_if_no_image_impact',
  '350',
  '2026-10-31',
  'Founder Demo Supplier',
  'supplier_syn_founder_001',
] as const

describe('boardProjection privacy', () => {
  let container: HTMLDivElement | undefined
  let root: Root | undefined

  afterEach(async () => {
    await act(async () => root?.unmount())
    container?.remove()
    demoStore.reset()
  })

  it('keeps forbidden values out of card JSON', () => {
    const card = projectBoardCard(PRIMARY_WISH.structured)
    const json = JSON.stringify(card)
    for (const forbidden of FORBIDDEN) {
      expect(json).not.toContain(forbidden)
    }
  })

  it('keeps forbidden values out of WantedBoard DOM', async () => {
    const card = projectBoardCard(PRIMARY_WISH.structured)
    demoStore._replaceForTests({
      form: demoStore.getState().form,
      wish: PRIMARY_WISH,
      supplier: null,
      offer: null,
      match: null,
      boardCard: card,
    })

    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    await act(async () => {
      root!.render(<WantedBoard />)
    })

    const html = container.innerHTML
    const text = container.textContent ?? ''
    for (const forbidden of FORBIDDEN) {
      expect(html).not.toContain(forbidden)
      expect(text).not.toContain(forbidden)
    }
  })

  it('rejects forbidden keys at the type level', () => {
    const card = projectBoardCard(PRIMARY_WISH.structured)
    // @ts-expect-error buyer_name must not exist on DemoBoardCard
    const _bad: DemoBoardCard = { ...card, buyer_name: 'Alex Demo' }
    void _bad
    expect(true).toBe(true)
  })
})
