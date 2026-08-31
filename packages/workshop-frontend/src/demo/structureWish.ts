import {
  FIXTURE_IDS,
  FIXTURE_TIMESTAMPS,
  PRIMARY_WISH,
} from './fixtures'
import type {
  CosmeticGrade,
  DemoWish,
  DemoWishStructured,
  MechanicalToleranceCode,
  OpticalToleranceCode,
  RegionCode,
  WishFormValues,
} from './types'
import { validateWishForm } from './validation'

export type StructureWishResult =
  | { ok: true; wish: DemoWish }
  | { ok: false; errors: ReturnType<typeof validateWishForm> }

/**
 * Deterministic local structuring: form values → DemoWish.
 * No model, fetch, RPC, or network call.
 */
export function structureWish(values: WishFormValues): StructureWishResult {
  const errors = validateWishForm(values)
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  const optical = [...values.optical_tolerance] as OpticalToleranceCode[]
  const mechanical = [...values.mechanical_tolerance] as MechanicalToleranceCode[]

  // Include minor_cleaning_marks when notes mention cleaning marks (fixture path).
  const notes = values.notes.trim()
  if (
    /cleaning marks/i.test(notes) &&
    !optical.includes('minor_cleaning_marks_if_no_image_impact')
  ) {
    optical.push('minor_cleaning_marks_if_no_image_impact')
  }

  const structured: DemoWishStructured = {
    item_name: values.item_name.trim(),
    mount: values.mount.trim(),
    focal_length_mm: Number(values.focal_length_mm),
    max_aperture: values.max_aperture.trim(),
    generation_coating: values.generation_coating.trim() || null,
    camera_body: values.camera_body.trim() || null,
    serial_number: null,
    optical_tolerance: optical,
    mechanical_tolerance: mechanical,
    cosmetic_tolerance: values.cosmetic_tolerance as CosmeticGrade,
    quantity: Number(values.quantity),
    budget: {
      amount: Number(values.budget_amount),
      currency: values.budget_currency.trim().toUpperCase(),
      scope: 'item_only',
    },
    desired_by: values.desired_flexible ? 'Flexible' : values.desired_by.trim(),
    destination_region: values.destination_region as RegionCode,
    contact_consent: false,
    demo_acknowledged: true,
  }

  // Poison identity values exist only for privacy-projection tests — never collected by the form.
  const wish: DemoWish = {
    id: FIXTURE_IDS.wish,
    submitted_at: FIXTURE_TIMESTAMPS.submitted_at,
    confirmed_at: null,
    status: 'draft',
    category: 'vintage_lens',
    not_found_reason: PRIMARY_WISH.not_found_reason,
    raw: {
      buyer_name: PRIMARY_WISH.raw.buyer_name,
      buyer_email: PRIMARY_WISH.raw.buyer_email,
      raw_text: notes || PRIMARY_WISH.raw.raw_text,
    },
    structured,
  }

  return { ok: true, wish }
}
