import { FIXTURE_IDS, FIXTURE_TIMESTAMPS } from './fixtures'
import type { DemoBoardCard, DemoWishStructured, OpticalToleranceCode } from './types'
import {
  cosmeticLabel,
  isFromRawText,
  mechanicalLabel,
  regionLabel,
} from './vocabulary'

const MONTH_ABBR = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

/** Lexical month label — no Date/Intl (TZ-safe). */
export function monthLabel(isoOrFlexible: string | 'Flexible'): string {
  if (isoOrFlexible === 'Flexible') return 'Flexible timing'
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoOrFlexible)
  if (!m) return isoOrFlexible
  const year = m[1]
  const monthIdx = Number(m[2]) - 1
  if (monthIdx < 0 || monthIdx > 11) return isoOrFlexible
  return `By ${MONTH_ABBR[monthIdx]} ${year}`
}

export function budgetBand(amount: number, currency: string): string {
  const lo = Math.floor(amount / 100) * 100
  const hi = lo + 99
  return `${currency} ${lo}–${hi}`
}

export function budgetBandCode(amount: number, currency: string): string {
  const lo = Math.floor(amount / 100) * 100
  const hi = lo + 99
  return `${currency}_${lo}_${hi}`
}

function formatOptical(codes: readonly OpticalToleranceCode[]): string {
  const boardCodes = codes.filter((c) => !isFromRawText(c))
  const negatives: string[] = []
  const allowed: string[] = []

  for (const code of boardCodes) {
    if (code === 'no_haze') negatives.push('haze')
    else if (code === 'no_fungus') negatives.push('fungus')
    else if (code === 'no_balsam_separation') negatives.push('balsam separation')
    else if (code === 'minor_dust_allowed') allowed.push('minor dust accepted')
  }

  const parts: string[] = []
  if (negatives.length > 0) {
    if (negatives.length === 1) {
      parts.push(`No ${negatives[0]}`)
    } else if (negatives.length === 2) {
      parts.push(`No ${negatives[0]} or ${negatives[1]}`)
    } else {
      const last = negatives[negatives.length - 1]
      parts.push(`No ${negatives.slice(0, -1).join(', ')}, or ${last}`)
    }
  }
  parts.push(...allowed)
  return parts.join('; ')
}

function formatMechanical(codes: readonly string[]): string {
  return codes
    .map((c) => mechanicalLabel(c as 'smooth_helicoid' | 'responsive_aperture' | 'dry_blades'))
    .map((label, i) => (i === 0 ? label : label.charAt(0).toLowerCase() + label.slice(1)))
    .join('; ')
}

/**
 * Allowlist projection: structured wish → DemoBoardCard.
 * Signature accepts only DemoWishStructured — raw is structurally unreachable.
 */
export function projectBoardCard(
  structured: DemoWishStructured,
  opts?: { wishId?: string; generatedAt?: string; boardId?: string },
): DemoBoardCard {
  return {
    id: opts?.boardId ?? FIXTURE_IDS.board,
    wish_id: opts?.wishId ?? FIXTURE_IDS.wish,
    generated_at: opts?.generatedAt ?? FIXTURE_TIMESTAMPS.board_generated_at,
    visibility: 'local_preview_only',
    demo_label: 'Synthetic demo',
    title: `${structured.item_name} vintage lens`,
    mount: structured.mount,
    focal_length: `${structured.focal_length_mm} mm`,
    max_aperture: structured.max_aperture,
    optical: formatOptical(structured.optical_tolerance),
    mechanical: formatMechanical(structured.mechanical_tolerance),
    cosmetic: cosmeticLabel(structured.cosmetic_tolerance),
    quantity: structured.quantity,
    budget_band: budgetBand(structured.budget.amount, structured.budget.currency),
    desired_timing: monthLabel(structured.desired_by),
    destination: regionLabel(structured.destination_region),
    reason: 'Condition confidence not available locally',
    status: 'Demo matched internally',
  }
}
