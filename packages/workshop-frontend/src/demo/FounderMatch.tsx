import { WorkshopButton } from '../components/WorkshopControls'
import { COPY } from './copy'
import { DemoFrame } from './DemoFrame'
import { FieldRow } from './FieldRow'
import {
  PRIMARY_MATCH,
  PRIMARY_OFFER,
  PRIMARY_SUPPLIER,
} from './fixtures'
import { HumanGateNotice } from './HumanGateNotice'
import { matchCheck } from './matchCheck'
import { demoStore, useDemoStore } from './demoStore'
import { SyntheticBadge } from './SyntheticBadge'

export type FounderMatchProps = {
  matchId: string
  onViewBoard?: () => void
  onBackToWish?: () => void
  /** Force offer-empty state for tests. */
  forceEmpty?: boolean
  /** Force mismatch using a mismatched wish_id for tests. */
  forceMismatch?: boolean
}

export function FounderMatch({
  matchId,
  onViewBoard,
  onBackToWish,
  forceEmpty = false,
  forceMismatch = false,
}: FounderMatchProps) {
  const store = useDemoStore()

  const wish = store.wish
  const supplier = store.supplier ?? PRIMARY_SUPPLIER
  const offer = forceMismatch
    ? { ...PRIMARY_OFFER, wish_id: 'wish_syn_other_999' }
    : (store.offer ?? PRIMARY_OFFER)
  const match = store.match

  if (forceEmpty || !wish || !match || match.id !== matchId) {
    if (forceEmpty || !store.offer) {
      return (
        <DemoFrame badge="internal" title={COPY.match.h1}>
          <p className="text-[14px] text-kumo-default">{COPY.match.offerEmpty}</p>
          <WorkshopButton
            className="mt-4"
            tone="primary"
            type="button"
            onClick={() => {
              if (!wish || wish.status !== 'confirmed') return
              demoStore.setRecords({
                supplier: { ...PRIMARY_SUPPLIER },
                offer: { ...PRIMARY_OFFER },
                match: { ...PRIMARY_MATCH },
              })
            }}
          >
            {COPY.match.createOffer}
          </WorkshopButton>
        </DemoFrame>
      )
    }
    if (!wish || !match || match.id !== matchId) {
      return (
        <DemoFrame badge="internal" title={COPY.match.h1}>
          <p className="text-[14px] text-kumo-subtle">No synthetic match found for this demo ID.</p>
          <WorkshopButton className="mt-4" onClick={onBackToWish}>
            {COPY.match.returnToWish}
          </WorkshopButton>
        </DemoFrame>
      )
    }
  }

  const check = wish ? matchCheck(wish, offer, supplier) : { ok: false as const, field: 'wish' }

  if (!check.ok) {
    return (
      <DemoFrame badge="internal" title={COPY.match.h1}>
        <p className="text-[14px] text-kumo-danger" role="alert">
          {COPY.match.matchError}
        </p>
        <p className="mt-2 text-[13px] text-kumo-subtle">Mismatched field: {check.field}</p>
        <WorkshopButton className="mt-4" onClick={onBackToWish}>
          {COPY.match.returnToWish}
        </WorkshopButton>
      </DemoFrame>
    )
  }

  return (
    <DemoFrame badge="internal" title={COPY.match.h1}>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-kumo-line bg-kumo-elevated p-4">
          <SyntheticBadge variant="internal" />
          <h2 className="mt-2 m-0 text-[16px] font-medium text-kumo-default">
            {COPY.match.supplierName}
          </h2>
          <p className="mt-1 text-[12px] text-kumo-subtle">{COPY.match.supplierStatus}</p>
          <p className="mt-2 text-[13px] text-kumo-subtle">{COPY.match.supplierCopy}</p>
        </section>

        <section className="rounded-xl border border-kumo-line bg-kumo-elevated p-4">
          <SyntheticBadge variant="internal" />
          <h2 className="mt-2 m-0 text-[16px] font-medium text-kumo-default">Offer</h2>
          <dl className="mt-2">
            <FieldRow
              label="Requested outcome"
              value={COPY.match.requestedOutcome}
              tag="confirmed"
            />
            <FieldRow label="Item/service cost" value={COPY.match.itemCost} tag="unknown" />
            <FieldRow label="Supplier reward" value={COPY.match.supplierReward} tag="unknown" />
            <FieldRow label="Shipping/other costs" value={COPY.match.shipping} tag="unknown" />
            <FieldRow label="Total" value={COPY.match.total} tag="unknown" />
            <FieldRow label="Availability" value={COPY.match.availability} tag="unknown" />
            <FieldRow label="Validity" value={COPY.match.validity} tag="confirmed" />
          </dl>
        </section>
      </div>

      <section className="mt-4 rounded-xl border border-kumo-line bg-kumo-elevated p-4">
        <SyntheticBadge variant="internal" />
        <h2 className="mt-2 m-0 text-[16px] font-medium text-kumo-default">
          {COPY.match.matchStatus}
        </h2>
        <p className="mt-2 text-[13px] text-kumo-subtle">{COPY.match.matchCopy}</p>
      </section>

      <div className="mt-4">
        <HumanGateNotice>{COPY.match.humanGate}</HumanGateNotice>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <WorkshopButton tone="primary" type="button" onClick={onViewBoard}>
          {COPY.match.primary}
        </WorkshopButton>
        <WorkshopButton type="button" onClick={onBackToWish}>
          {COPY.match.secondary}
        </WorkshopButton>
      </div>
    </DemoFrame>
  )
}
