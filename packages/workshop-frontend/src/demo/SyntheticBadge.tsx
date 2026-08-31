import { COPY } from './copy'

export function SyntheticBadge({
  variant = 'default',
}: {
  variant?: 'default' | 'internal' | 'privacy' | 'noSend'
}) {
  const label =
    variant === 'internal'
      ? COPY.demoLabelInternal
      : variant === 'privacy'
        ? COPY.demoLabelPrivacy
        : variant === 'noSend'
          ? COPY.demoLabelNoSend
          : COPY.demoLabel

  return (
    <p className="m-0 text-[11px] leading-4 font-semibold uppercase tracking-[0.9px] text-kumo-subtle">
      {label}
    </p>
  )
}
