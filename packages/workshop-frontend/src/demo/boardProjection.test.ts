import { describe, expect, it } from 'vitest'
import { budgetBand, monthLabel, projectBoardCard } from './boardProjection'
import { PRIMARY_BOARD_CARD, PRIMARY_WISH } from './fixtures'
import { BOARD_CARD_KEYS } from './types'

describe('boardProjection', () => {
  it('matches the primary board card contract exactly', () => {
    const card = projectBoardCard(PRIMARY_WISH.structured)
    expect(card).toEqual(PRIMARY_BOARD_CARD)
  })

  it('exposes only BOARD_CARD_KEYS', () => {
    const card = projectBoardCard(PRIMARY_WISH.structured)
    expect(Object.keys(card).toSorted()).toEqual([...BOARD_CARD_KEYS].toSorted())
  })

  it('budgetBand boundaries', () => {
    expect(budgetBand(300, 'USD')).toBe('USD 300–399')
    expect(budgetBand(399, 'USD')).toBe('USD 300–399')
    expect(budgetBand(400, 'USD')).toBe('USD 400–499')
    expect(budgetBand(350, 'USD')).toBe('USD 300–399')
  })

  it('monthLabel is TZ-independent (lexical parse, no Date)', () => {
    expect(monthLabel('2026-10-31')).toBe('By Oct 2026')
    expect(monthLabel('2026-01-15')).toBe('By Jan 2026')
    expect(monthLabel('Flexible')).toBe('Flexible timing')
  })
})
