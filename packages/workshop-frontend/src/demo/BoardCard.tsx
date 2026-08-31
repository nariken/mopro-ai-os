import { BOARD_CARD_KEYS, type BoardCardKey, type DemoBoardCard } from './types'

/** Human-readable labels for board card definition list. */
const BOARD_LABELS: Partial<Record<BoardCardKey, string>> = {
  title: 'Title',
  mount: 'Mount',
  focal_length: 'Focal length',
  max_aperture: 'Aperture',
  optical: 'Optical',
  mechanical: 'Mechanical',
  cosmetic: 'Cosmetic',
  quantity: 'Quantity',
  budget_band: 'Budget band',
  desired_timing: 'Desired timing',
  destination: 'Destination',
  reason: 'Reason',
  status: 'Status',
}

/** Keys shown on the public card body (skip internal ids/meta). */
const DISPLAY_KEYS: BoardCardKey[] = [
  'title',
  'mount',
  'focal_length',
  'max_aperture',
  'optical',
  'mechanical',
  'cosmetic',
  'quantity',
  'budget_band',
  'desired_timing',
  'destination',
  'reason',
  'status',
]

export function BoardCard({ card }: { card: DemoBoardCard }) {
  // Iterate allowlisted keys only — fields absent from DemoBoardCard cannot appear.
  const keys = BOARD_CARD_KEYS.filter((k) => DISPLAY_KEYS.includes(k))

  return (
    <article className="rounded-xl border border-kumo-line bg-kumo-elevated p-4">
      <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.9px] text-kumo-subtle">
        {card.demo_label}
      </p>
      <h2 className="mt-2 m-0 text-[18px] leading-6 font-semibold tracking-[-0.4px] text-kumo-default">
        {card.title}
      </h2>
      <dl className="mt-3 grid gap-2">
        {keys
          .filter((k) => k !== 'title' && k !== 'demo_label')
          .map((key) => {
            const label = BOARD_LABELS[key]
            if (!label) return null
            const value = card[key]
            return (
              <div key={key} className="grid grid-cols-[140px_1fr] gap-2 text-[13px]">
                <dt className="text-kumo-subtle">{label}</dt>
                <dd className="m-0 text-kumo-default">{String(value)}</dd>
              </div>
            )
          })}
      </dl>
    </article>
  )
}
