import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Checkbox, Select } from '@cloudflare/kumo'
import DeleteConfirmationDialog from '../components/DeleteConfirmationDialog'
import {
  WorkshopButton,
  WorkshopInput,
  WorkshopInputArea,
} from '../components/WorkshopControls'
import { COPY } from './copy'
import { DemoFrame } from './DemoFrame'
import { STRUCTURING_DELAY_MS } from './fixtures'
import { demoStore, useDemoStore } from './demoStore'
import { structureWish } from './structureWish'
import type {
  CosmeticGrade,
  FieldErrors,
  MechanicalToleranceCode,
  OpticalToleranceCode,
  RegionCode,
  WishFormValues,
} from './types'
import { firstErrorKey } from './validation'
import {
  APERTURE_PRESETS,
  COSMETIC_GRADES,
  CURRENCY_OPTIONS,
  MECHANICAL_TOLERANCE,
  MOUNT_OPTIONS,
  OPTICAL_TOLERANCE,
  REGION_OPTIONS,
} from './vocabulary'

export type WishFormProps = {
  demoFault?: 'structuring' | undefined
  onStructured?: (wishId: string) => void
  /** When true, skip the structuring delay (tests). */
  skipDelay?: boolean
}

export function WishForm({ demoFault, onStructured, skipDelay = false }: WishFormProps) {
  const store = useDemoStore()
  const [values, setValues] = useState<WishFormValues>(store.form)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [loading, setLoading] = useState(false)
  const [structuringError, setStructuringError] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const summaryRef = useRef<HTMLDivElement>(null)
  const formId = useId()

  useEffect(() => {
    setValues(store.form)
  }, [store.form])

  const update = <K extends keyof WishFormValues>(key: K, value: WishFormValues[K]) => {
    setValues((prev) => {
      const next = { ...prev, [key]: value }
      demoStore.setForm(next)
      return next
    })
  }

  const toggleOptical = (code: OpticalToleranceCode) => {
    const next = values.optical_tolerance.includes(code)
      ? values.optical_tolerance.filter((c) => c !== code)
      : [...values.optical_tolerance, code]
    update('optical_tolerance', next)
  }

  const toggleMechanical = (code: MechanicalToleranceCode) => {
    const next = values.mechanical_tolerance.includes(code)
      ? values.mechanical_tolerance.filter((c) => c !== code)
      : [...values.mechanical_tolerance, code]
    update('mechanical_tolerance', next)
  }

  const runStructure = async () => {
    setStructuringError(false)
    setLoading(true)
    try {
      if (!skipDelay) {
        await new Promise((r) => setTimeout(r, STRUCTURING_DELAY_MS))
      }
      if (demoFault === 'structuring') {
        setStructuringError(true)
        return
      }
      const result = structureWish(values)
      if (!result.ok) {
        setErrors(result.errors)
        queueMicrotask(() => summaryRef.current?.focus())
        return
      }
      setErrors({})
      demoStore.setWish(result.wish)
      onStructured?.(result.wish.id)
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void runStructure()
  }

  const errorKeys = Object.keys(errors) as (keyof FieldErrors)[]
  const firstKey = firstErrorKey(errors)

  return (
    <DemoFrame badge="noSend" title={COPY.wish.h1} supporting={COPY.wish.supporting}>
      {structuringError && (
        <div className="mb-4 rounded-lg border border-kumo-line bg-kumo-elevated p-4" role="alert">
          <p className="m-0 text-[14px] text-kumo-default">{COPY.wish.structuringError}</p>
          <div className="mt-3 flex gap-2">
            <WorkshopButton tone="primary" type="button" onClick={() => void runStructure()}>
              {COPY.wish.tryAgain}
            </WorkshopButton>
            <WorkshopButton type="button" onClick={() => setStructuringError(false)}>
              {COPY.wish.editFields}
            </WorkshopButton>
          </div>
        </div>
      )}

      {errorKeys.length > 0 && (
        <div
          ref={summaryRef}
          role="alert"
          tabIndex={-1}
          className="mb-4 rounded-lg border border-kumo-danger/30 bg-kumo-danger-tint p-4 outline-none"
        >
          <p className="m-0 text-[14px] font-medium text-kumo-danger">
            Fix the highlighted fields to continue.
          </p>
          <ul className="mt-2 list-disc pl-5 text-[13px] text-kumo-danger">
            {errorKeys.map((key) => (
              <li key={key}>
                <a
                  href={`#${formId}-${key}`}
                  className="underline"
                  onClick={(ev) => {
                    ev.preventDefault()
                    document.getElementById(`${formId}-${key}`)?.focus()
                  }}
                >
                  {errors[key]}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading && (
        <p role="status" aria-live="polite" className="mb-4 text-[14px] text-kumo-subtle">
          {COPY.wish.loading}
        </p>
      )}

      <form onSubmit={onSubmit} noValidate className="grid gap-4 md:grid-cols-2">
        <Field
          id={`${formId}-item_name`}
          label="Lens or camera"
          error={errors.item_name}
          className="md:col-span-2"
        >
          <WorkshopInput
            id={`${formId}-item_name`}
            value={values.item_name}
            onChange={(e) => update('item_name', e.target.value)}
            aria-invalid={Boolean(errors.item_name)}
            aria-describedby={errors.item_name ? `${formId}-item_name-err` : undefined}
            className="w-full"
            disabled={loading}
          />
        </Field>

        <Field id={`${formId}-mount`} label="Mount" error={errors.mount}>
          <Select
            aria-label="Mount"
            className="w-full text-sm [&_button]:!h-9"
            value={values.mount || null}
            onValueChange={(v) => update('mount', (v as string) ?? '')}
            placeholder="Select mount"
            renderValue={(v) => (v ? String(v) : 'Select mount')}
          >
            {MOUNT_OPTIONS.map((m) => (
              <Select.Option key={m} value={m}>
                {m}
              </Select.Option>
            ))}
          </Select>
        </Field>

        <Field
          id={`${formId}-focal_length_mm`}
          label="Focal length"
          error={errors.focal_length_mm}
        >
          <WorkshopInput
            id={`${formId}-focal_length_mm`}
            type="number"
            inputMode="decimal"
            value={values.focal_length_mm}
            onChange={(e) => update('focal_length_mm', e.target.value)}
            aria-invalid={Boolean(errors.focal_length_mm)}
            aria-describedby={
              errors.focal_length_mm ? `${formId}-focal_length_mm-err` : undefined
            }
            className="w-full"
            disabled={loading}
          />
        </Field>

        <Field id={`${formId}-max_aperture`} label="Maximum aperture" error={errors.max_aperture}>
          <WorkshopInput
            id={`${formId}-max_aperture`}
            list={`${formId}-aperture-list`}
            value={values.max_aperture}
            onChange={(e) => update('max_aperture', e.target.value)}
            aria-invalid={Boolean(errors.max_aperture)}
            className="w-full"
            disabled={loading}
          />
          <datalist id={`${formId}-aperture-list`}>
            {APERTURE_PRESETS.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </Field>

        <Field id={`${formId}-generation_coating`} label="Generation / coating">
          <WorkshopInput
            id={`${formId}-generation_coating`}
            value={values.generation_coating}
            onChange={(e) => update('generation_coating', e.target.value)}
            className="w-full"
            disabled={loading}
          />
        </Field>

        <Field
          id={`${formId}-camera_body`}
          label="Camera body for compatibility"
          className="md:col-span-2"
        >
          <WorkshopInput
            id={`${formId}-camera_body`}
            value={values.camera_body}
            onChange={(e) => update('camera_body', e.target.value)}
            className="w-full"
            disabled={loading}
          />
        </Field>

        <fieldset
          className="md:col-span-2 rounded-lg border border-kumo-line p-3"
          aria-invalid={Boolean(errors.optical_tolerance)}
        >
          <legend className="px-1 text-[12px] font-medium text-kumo-subtle">
            Optical tolerance
          </legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {OPTICAL_TOLERANCE.map((opt) => (
              <label key={opt.code} className="flex items-center gap-2 text-[13px] text-kumo-default">
                <Checkbox
                  checked={values.optical_tolerance.includes(opt.code)}
                  onCheckedChange={() => toggleOptical(opt.code)}
                  aria-label={opt.label}
                  disabled={loading}
                />
                {opt.label}
              </label>
            ))}
          </div>
          {errors.optical_tolerance && (
            <p id={`${formId}-optical_tolerance-err`} className="mt-2 text-[12px] text-kumo-danger">
              {errors.optical_tolerance}
            </p>
          )}
        </fieldset>

        <fieldset className="md:col-span-2 rounded-lg border border-kumo-line p-3">
          <legend className="px-1 text-[12px] font-medium text-kumo-subtle">
            Mechanical tolerance
          </legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {MECHANICAL_TOLERANCE.map((opt) => (
              <label key={opt.code} className="flex items-center gap-2 text-[13px] text-kumo-default">
                <Checkbox
                  checked={values.mechanical_tolerance.includes(opt.code)}
                  onCheckedChange={() => toggleMechanical(opt.code)}
                  aria-label={opt.label}
                  disabled={loading}
                />
                {opt.label}
              </label>
            ))}
          </div>
          {errors.mechanical_tolerance && (
            <p className="mt-2 text-[12px] text-kumo-danger">{errors.mechanical_tolerance}</p>
          )}
        </fieldset>

        <Field
          id={`${formId}-cosmetic_tolerance`}
          label="Cosmetic tolerance"
          error={errors.cosmetic_tolerance}
        >
          <Select
            aria-label="Cosmetic tolerance"
            className="w-full text-sm [&_button]:!h-9"
            value={values.cosmetic_tolerance || null}
            onValueChange={(v) => update('cosmetic_tolerance', (v as CosmeticGrade) ?? '')}
            placeholder="Select grade"
            renderValue={(v) =>
              COSMETIC_GRADES.find((c) => c.code === v)?.label ?? 'Select grade'
            }
          >
            {COSMETIC_GRADES.map((g) => (
              <Select.Option key={g.code} value={g.code}>
                {g.label}
              </Select.Option>
            ))}
          </Select>
        </Field>

        <Field id={`${formId}-quantity`} label="Quantity" error={errors.quantity}>
          <WorkshopInput
            id={`${formId}-quantity`}
            type="number"
            min={1}
            max={5}
            value={values.quantity}
            onChange={(e) => update('quantity', e.target.value)}
            className="w-full"
            disabled={loading}
          />
        </Field>

        <div className="md:col-span-2">
          <p className="mb-1 text-[12px] font-medium text-kumo-subtle">Budget</p>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <WorkshopInput
              id={`${formId}-budget`}
              type="number"
              inputMode="decimal"
              value={values.budget_amount}
              onChange={(e) => update('budget_amount', e.target.value)}
              aria-invalid={Boolean(errors.budget)}
              aria-describedby={
                errors.budget ? `${formId}-budget-err` : `${formId}-budget-help`
              }
              className="w-full"
              disabled={loading}
              aria-label="Budget amount"
            />
            <Select
              aria-label="Currency"
              className="w-[110px] text-sm [&_button]:!h-9"
              value={values.budget_currency}
              onValueChange={(v) => update('budget_currency', (v as string) ?? 'USD')}
              renderValue={(v) => String(v)}
            >
              {CURRENCY_OPTIONS.map((c) => (
                <Select.Option key={c} value={c}>
                  {c}
                </Select.Option>
              ))}
            </Select>
          </div>
          <p id={`${formId}-budget-help`} className="mt-1 text-[12px] text-kumo-subtle">
            {COPY.wish.budgetHelper}
          </p>
          {errors.budget && (
            <p id={`${formId}-budget-err`} className="mt-1 text-[12px] text-kumo-danger">
              {errors.budget}
            </p>
          )}
        </div>

        <Field id={`${formId}-desired_by`} label="Desired by" error={errors.desired_by}>
          <WorkshopInput
            id={`${formId}-desired_by`}
            type="date"
            value={values.desired_flexible ? '' : values.desired_by}
            onChange={(e) => {
              update('desired_by', e.target.value)
              update('desired_flexible', false)
            }}
            disabled={loading || values.desired_flexible}
            className="w-full"
          />
          <label className="mt-2 flex items-center gap-2 text-[13px] text-kumo-default">
            <Checkbox
              checked={values.desired_flexible}
              onCheckedChange={(checked) => {
                update('desired_flexible', checked === true)
                if (checked === true) update('desired_by', '')
              }}
              aria-label="Flexible"
              disabled={loading}
            />
            Flexible
          </label>
        </Field>

        <Field
          id={`${formId}-destination_region`}
          label="Destination region"
          error={errors.destination_region}
        >
          <Select
            aria-label="Destination region"
            className="w-full text-sm [&_button]:!h-9"
            value={values.destination_region || null}
            onValueChange={(v) => update('destination_region', (v as RegionCode) ?? '')}
            placeholder="Select region"
            renderValue={(v) =>
              REGION_OPTIONS.find((r) => r.code === v)?.label ?? 'Select region'
            }
          >
            {REGION_OPTIONS.map((r) => (
              <Select.Option key={r.code} value={r.code}>
                {r.label}
              </Select.Option>
            ))}
          </Select>
        </Field>

        <Field id={`${formId}-notes`} label="Anything else?" className="md:col-span-2">
          <WorkshopInputArea
            id={`${formId}-notes`}
            value={values.notes}
            onChange={(e) => update('notes', e.target.value)}
            className="w-full min-h-[80px]"
            disabled={loading}
          />
        </Field>

        <div className="md:col-span-2">
          <label className="flex items-start gap-2 text-[13px] text-kumo-default">
            <Checkbox
              checked={values.demo_acknowledged}
              onCheckedChange={(checked) => update('demo_acknowledged', checked === true)}
              aria-invalid={Boolean(errors.demo_acknowledged)}
              disabled={loading}
              aria-label={COPY.wish.consent}
            />
            <span id={`${formId}-demo_acknowledged`}>{COPY.wish.consent}</span>
          </label>
          {errors.demo_acknowledged && (
            <p className="mt-1 text-[12px] text-kumo-danger">{errors.demo_acknowledged}</p>
          )}
        </div>

        <div className="md:col-span-2 flex flex-wrap gap-2 pt-2">
          <WorkshopButton
            tone="primary"
            type="submit"
            disabled={loading}
            aria-busy={loading}
          >
            {COPY.wish.primary}
          </WorkshopButton>
          <WorkshopButton type="button" disabled={loading} onClick={() => setResetOpen(true)}>
            {COPY.wish.secondary}
          </WorkshopButton>
        </div>

        {/* Keep firstKey referenced for a11y tooling / future focus helpers */}
        <span className="sr-only" aria-hidden={!firstKey}>
          {firstKey ?? ''}
        </span>
      </form>

      <DeleteConfirmationDialog
        open={resetOpen}
        title={COPY.wish.resetConfirm}
        description="This clears the demo form and any synthetic records in this session."
        confirmLabel="Reset"
        onOpenChange={setResetOpen}
        onConfirm={() => {
          demoStore.reset()
          setValues({ ...demoStore.getState().form })
          setErrors({})
          setStructuringError(false)
          setResetOpen(false)
        }}
      />
    </DemoFrame>
  )
}

function Field({
  id,
  label,
  error,
  children,
  className = '',
}: {
  id: string
  label: string
  error?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-[12px] font-medium text-kumo-subtle">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-err`} className="mt-1 text-[12px] text-kumo-danger">
          {error}
        </p>
      )}
    </div>
  )
}
