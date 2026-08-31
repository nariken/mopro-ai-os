import type { FieldErrorKey, FieldErrors, WishFormValues } from './types'
import { REGION_OPTIONS } from './vocabulary'

/** Exact MOP-595 validation copy — single source of truth. */
export const VALIDATION_COPY = {
  item_name: 'Enter a lens or camera name.',
  mount: 'Choose a mount.',
  focal_length_mm: 'Enter a focal length greater than 0.',
  max_aperture: 'Enter a maximum aperture.',
  optical_tolerance: 'Choose what optical condition you can accept.',
  mechanical_tolerance: 'Choose what mechanical condition you can accept.',
  cosmetic_tolerance: 'Choose a cosmetic grade.',
  quantity: 'Enter a quantity between 1 and 5.',
  budget: 'Enter a budget and currency.',
  desired_by: 'Choose a desired date or Flexible.',
  destination_region: 'Choose a destination country or region.',
  demo_acknowledged: 'Confirm the synthetic-demo notice to continue.',
} as const satisfies Record<FieldErrorKey, string>

const REGION_CODES = new Set(REGION_OPTIONS.map((r) => r.code))

export function validateWishForm(values: WishFormValues): FieldErrors {
  const errors: FieldErrors = {}

  if (!values.item_name.trim()) errors.item_name = VALIDATION_COPY.item_name
  if (!values.mount.trim()) errors.mount = VALIDATION_COPY.mount

  const focal = Number(values.focal_length_mm)
  if (!Number.isFinite(focal) || focal <= 0) {
    errors.focal_length_mm = VALIDATION_COPY.focal_length_mm
  }

  if (!values.max_aperture.trim()) errors.max_aperture = VALIDATION_COPY.max_aperture

  if (values.optical_tolerance.length === 0) {
    errors.optical_tolerance = VALIDATION_COPY.optical_tolerance
  }
  if (values.mechanical_tolerance.length === 0) {
    errors.mechanical_tolerance = VALIDATION_COPY.mechanical_tolerance
  }
  if (!values.cosmetic_tolerance) {
    errors.cosmetic_tolerance = VALIDATION_COPY.cosmetic_tolerance
  }

  const qty = Number(values.quantity)
  if (!Number.isInteger(qty) || qty < 1 || qty > 5) {
    errors.quantity = VALIDATION_COPY.quantity
  }

  const amount = Number(values.budget_amount)
  if (!Number.isFinite(amount) || amount <= 0 || !values.budget_currency.trim()) {
    errors.budget = VALIDATION_COPY.budget
  }

  if (values.desired_flexible) {
    // ok
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(values.desired_by.trim())) {
    errors.desired_by = VALIDATION_COPY.desired_by
  }

  if (!values.destination_region || !REGION_CODES.has(values.destination_region)) {
    errors.destination_region = VALIDATION_COPY.destination_region
  }

  if (!values.demo_acknowledged) {
    errors.demo_acknowledged = VALIDATION_COPY.demo_acknowledged
  }

  return errors
}

export function firstErrorKey(errors: FieldErrors): FieldErrorKey | null {
  const order: FieldErrorKey[] = [
    'item_name',
    'mount',
    'focal_length_mm',
    'max_aperture',
    'optical_tolerance',
    'mechanical_tolerance',
    'cosmetic_tolerance',
    'quantity',
    'budget',
    'desired_by',
    'destination_region',
    'demo_acknowledged',
  ]
  return order.find((k) => errors[k]) ?? null
}
