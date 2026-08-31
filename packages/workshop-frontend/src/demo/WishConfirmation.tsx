import { useMemo, useState } from 'react'
import DeleteConfirmationDialog from '../components/DeleteConfirmationDialog'
import { SectionEyebrow } from '../components/SectionEyebrow'
import { WorkshopButton } from '../components/WorkshopControls'
import { projectBoardCard } from './boardProjection'
import { COPY } from './copy'
import { DemoFrame } from './DemoFrame'
import { FieldRow, type FieldTag } from './FieldRow'
import {
  FIXTURE_TIMESTAMPS,
  PRIMARY_MATCH,
  PRIMARY_OFFER,
  PRIMARY_SUPPLIER,
} from './fixtures'
import { HumanGateNotice } from './HumanGateNotice'
import { demoStore, useDemoStore } from './demoStore'
import type { DemoWish } from './types'
import {
  cosmeticLabel,
  mechanicalLabel,
  opticalLabel,
  regionLabel,
} from './vocabulary'

export type WishConfirmationProps = {
  wishId: string
  onConfirmed?: (matchId: string) => void
  onEdit?: () => void
  onDiscarded?: () => void
  /** Force confirmation-blocked state for tests (required Unknown). */
  forceBlocked?: boolean
}

function valueTag(
  value: string | null | undefined,
  required: boolean,
): { display: string; tag: FieldTag; hint?: string } {
  if (value === null || value === undefined || value === '') {
    return {
      display: COPY.tags.unknown,
      tag: 'unknown',
      hint: required ? COPY.confirm.unknownHint : undefined,
    }
  }
  return { display: value, tag: 'confirmed' }
}

export function WishConfirmation({
  wishId,
  onConfirmed,
  onEdit,
  onDiscarded,
  forceBlocked = false,
}: WishConfirmationProps) {
  const store = useDemoStore()
  const [discardOpen, setDiscardOpen] = useState(false)

  const wish = store.wish && store.wish.id === wishId ? store.wish : null

  const rows = useMemo(() => {
    if (!wish) return null
    const s = wish.structured
    const optical = s.optical_tolerance.map(opticalLabel).join('; ')
    const mechanical = s.mechanical_tolerance.map(mechanicalLabel).join('; ')

    const serial = forceBlocked
      ? valueTag(null, true)
      : {
          display: COPY.confirm.serialUnknown,
          tag: 'unknown' as FieldTag,
        }

    return {
      item: [
        { label: 'Item', ...valueTag(s.item_name, true) },
        { label: 'Mount', ...valueTag(s.mount, true) },
        { label: 'Focal length', ...valueTag(`${s.focal_length_mm} mm`, true) },
        { label: 'Maximum aperture', ...valueTag(s.max_aperture, true) },
        {
          label: 'Generation / coating',
          ...valueTag(s.generation_coating, false),
        },
        { label: 'Camera body', ...valueTag(s.camera_body, false) },
        { label: 'Serial number', ...serial },
      ],
      condition: [
        { label: 'Optical', ...valueTag(optical, true) },
        { label: 'Mechanical', ...valueTag(mechanical, true) },
        { label: 'Cosmetic', ...valueTag(cosmeticLabel(s.cosmetic_tolerance), true) },
      ],
      quantity: [
        { label: 'Quantity', ...valueTag(String(s.quantity), true) },
        {
          label: 'Budget',
          ...valueTag(`${s.budget.currency} ${s.budget.amount}`, true),
        },
      ],
      timing: [
        {
          label: 'Desired by',
          ...valueTag(s.desired_by === 'Flexible' ? 'Flexible' : s.desired_by, true),
        },
        {
          label: 'Destination',
          ...valueTag(regionLabel(s.destination_region), true),
        },
      ],
      note: [{ label: 'Note', ...valueTag(wish.raw.raw_text, false) }],
      blocked:
        forceBlocked ||
        [s.item_name, s.mount, s.max_aperture].some((v) => !v),
    }
  }, [wish, forceBlocked])

  if (!wish || !rows) {
    return (
      <DemoFrame badge="default" title={COPY.confirm.h1}>
        <p className="text-[14px] text-kumo-subtle">No structured wish found for this demo ID.</p>
        <WorkshopButton className="mt-4" onClick={onEdit}>
          {COPY.confirm.secondary}
        </WorkshopButton>
      </DemoFrame>
    )
  }

  const confirm = () => {
    const confirmed: DemoWish = {
      ...wish,
      status: 'confirmed',
      confirmed_at: FIXTURE_TIMESTAMPS.confirmed_at,
    }
    const boardCard = projectBoardCard(confirmed.structured, {
      wishId: confirmed.id,
      generatedAt: FIXTURE_TIMESTAMPS.board_generated_at,
    })
    demoStore.setRecords({
      wish: confirmed,
      supplier: { ...PRIMARY_SUPPLIER },
      offer: { ...PRIMARY_OFFER },
      match: { ...PRIMARY_MATCH },
      boardCard,
    })
    onConfirmed?.(PRIMARY_MATCH.id)
  }

  return (
    <DemoFrame badge="default" title={COPY.confirm.h1} supporting={COPY.confirm.supporting}>
      <SectionEyebrow label={COPY.confirm.sections.item} />
      <dl>
        {rows.item.map((r) => (
          <FieldRow key={r.label} label={r.label} value={r.display} tag={r.tag} hint={r.hint} />
        ))}
      </dl>

      <div className="mt-6">
        <SectionEyebrow label={COPY.confirm.sections.condition} />
        <dl>
          {rows.condition.map((r) => (
            <FieldRow key={r.label} label={r.label} value={r.display} tag={r.tag} hint={r.hint} />
          ))}
        </dl>
      </div>

      <div className="mt-6">
        <SectionEyebrow label={COPY.confirm.sections.quantity} />
        <dl>
          {rows.quantity.map((r) => (
            <FieldRow key={r.label} label={r.label} value={r.display} tag={r.tag} hint={r.hint} />
          ))}
        </dl>
      </div>

      <div className="mt-6">
        <SectionEyebrow label={COPY.confirm.sections.timing} />
        <dl>
          {rows.timing.map((r) => (
            <FieldRow key={r.label} label={r.label} value={r.display} tag={r.tag} hint={r.hint} />
          ))}
        </dl>
      </div>

      <div className="mt-6">
        <SectionEyebrow label={COPY.confirm.sections.note} />
        <dl>
          {rows.note.map((r) => (
            <FieldRow key={r.label} label={r.label} value={r.display} tag={r.tag} hint={r.hint} />
          ))}
        </dl>
      </div>

      <div className="mt-6">
        <HumanGateNotice>{COPY.confirm.humanGate}</HumanGateNotice>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <WorkshopButton
          tone="primary"
          type="button"
          disabled={rows.blocked}
          onClick={confirm}
        >
          {COPY.confirm.primary}
        </WorkshopButton>
        <WorkshopButton type="button" onClick={onEdit}>
          {COPY.confirm.secondary}
        </WorkshopButton>
        <WorkshopButton tone="danger" type="button" onClick={() => setDiscardOpen(true)}>
          {COPY.confirm.discard}
        </WorkshopButton>
      </div>

      <DeleteConfirmationDialog
        open={discardOpen}
        title="Discard demo wish?"
        description="This removes the structured demo wish from this session."
        confirmLabel="Discard"
        onOpenChange={setDiscardOpen}
        onConfirm={() => {
          demoStore.reset()
          setDiscardOpen(false)
          onDiscarded?.()
        }}
      />
    </DemoFrame>
  )
}
