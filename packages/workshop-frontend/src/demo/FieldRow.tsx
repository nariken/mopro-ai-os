import { COPY } from './copy'

export type FieldTag = 'confirmed' | 'needsConfirmation' | 'unknown'

export function FieldRow({
  label,
  value,
  tag,
  hint,
}: {
  label: string
  value: string
  tag: FieldTag
  hint?: string
}) {
  const tagLabel =
    tag === 'confirmed'
      ? COPY.tags.confirmed
      : tag === 'needsConfirmation'
        ? COPY.tags.needsConfirmation
        : COPY.tags.unknown

  const tagClass =
    tag === 'confirmed'
      ? 'bg-kumo-elevated text-kumo-subtle border-kumo-line'
      : tag === 'unknown'
        ? 'bg-kumo-danger-tint text-kumo-danger border-kumo-danger/30'
        : 'bg-kumo-tint text-kumo-default border-kumo-line'

  return (
    <div className="grid gap-1 border-b border-kumo-line py-3 last:border-b-0 md:grid-cols-[220px_1fr_auto] md:items-start md:gap-3">
      <dt className="text-[12px] leading-4 font-medium tracking-[-0.2px] text-kumo-subtle">
        {label}
      </dt>
      <dd className="m-0 flex min-w-0 flex-wrap items-start gap-2">
        <span
          className={`text-[14px] leading-5 tracking-[-0.25px] ${
            tag === 'unknown' ? 'italic text-kumo-subtle' : 'text-kumo-default'
          }`}
        >
          {value}
        </span>
        <span
          className={`inline-flex shrink-0 rounded-md border px-1.5 py-0.5 text-[11px] leading-4 font-medium ${tagClass}`}
        >
          {tagLabel}
        </span>
        {hint && (
          <span className="w-full text-[12px] leading-4 text-kumo-danger">{hint}</span>
        )}
      </dd>
    </div>
  )
}
