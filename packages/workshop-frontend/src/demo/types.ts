/** Optical tolerance codes for the vintage-lens vertical. */
export type OpticalToleranceCode =
  | 'no_haze'
  | 'no_fungus'
  | 'no_balsam_separation'
  | 'minor_dust_allowed'
  | 'minor_cleaning_marks_if_no_image_impact'

export type MechanicalToleranceCode =
  | 'smooth_helicoid'
  | 'responsive_aperture'
  | 'dry_blades'

export type CosmeticGrade = 'user_grade' | 'collector_grade'

export type RegionCode = 'US' | 'JP' | 'GB' | 'CA' | 'AU' | 'DE' | 'FR'

/** Internal-only. Never projected onto the Board. */
export interface DemoWishRaw {
  buyer_name: string
  buyer_email: string
  raw_text: string
}

export interface DemoWishStructured {
  item_name: string
  mount: string
  focal_length_mm: number
  max_aperture: string
  generation_coating: string | null
  camera_body: string | null
  serial_number: string | null
  optical_tolerance: readonly OpticalToleranceCode[]
  mechanical_tolerance: readonly MechanicalToleranceCode[]
  cosmetic_tolerance: CosmeticGrade
  quantity: number
  budget: { amount: number; currency: string; scope: 'item_only' }
  desired_by: string | 'Flexible'
  destination_region: RegionCode
  contact_consent: false
  demo_acknowledged: true
}

export interface DemoWish {
  id: string
  submitted_at: string
  confirmed_at: string | null
  status: 'draft' | 'confirmed'
  category: 'vintage_lens'
  not_found_reason: string
  raw: DemoWishRaw
  structured: DemoWishStructured
}

export interface DemoSupplier {
  id: string
  created_at: string
  display_name: string
  type: 'synthetic_internal'
  identity_verified: false
  inventory_verified: false
}

export interface DemoOffer {
  id: string
  wish_id: string
  supplier_id: string
  created_at: string
  status: 'synthetic_internal'
  item_service_cost: null
  supplier_reward: null
  shipping_other_cost: null
  currency: null
  availability_verified: false
  commercial_validity: false
}

export interface DemoMatch {
  id: string
  wish_id: string
  offer_id: string
  confirmed_at: string
  status: 'synthetic_internal_confirmed'
  transaction_status: 'not_applicable'
}

/**
 * Board-safe fields only. Forbidden fields are absent from the type —
 * buyer_name / buyer_email / raw_text / exact budget / exact date / address /
 * supplier internals cannot be written here.
 */
export interface DemoBoardCard {
  id: string
  wish_id: string
  generated_at: string
  visibility: 'local_preview_only'
  demo_label: 'Synthetic demo'
  title: string
  mount: string
  focal_length: string
  max_aperture: string
  optical: string
  mechanical: string
  cosmetic: string
  quantity: number
  budget_band: string
  desired_timing: string
  destination: string
  reason: string
  status: string
}

export const BOARD_CARD_KEYS = [
  'id',
  'wish_id',
  'generated_at',
  'visibility',
  'demo_label',
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
] as const satisfies readonly (keyof DemoBoardCard)[]

export type BoardCardKey = (typeof BOARD_CARD_KEYS)[number]

export interface DemoRecordSet {
  demo_label: 'Synthetic demo'
  wish: DemoWish
  supplier: DemoSupplier
  offer: DemoOffer
  match: DemoMatch
  board_card: DemoBoardCard
}

/** Form values collected on the landing screen (no buyer identity fields). */
export interface WishFormValues {
  item_name: string
  mount: string
  focal_length_mm: string
  max_aperture: string
  generation_coating: string
  camera_body: string
  optical_tolerance: OpticalToleranceCode[]
  mechanical_tolerance: MechanicalToleranceCode[]
  cosmetic_tolerance: CosmeticGrade | ''
  quantity: string
  budget_amount: string
  budget_currency: string
  desired_by: string
  desired_flexible: boolean
  destination_region: RegionCode | ''
  notes: string
  demo_acknowledged: boolean
}

export type FieldErrorKey =
  | 'item_name'
  | 'mount'
  | 'focal_length_mm'
  | 'max_aperture'
  | 'optical_tolerance'
  | 'mechanical_tolerance'
  | 'cosmetic_tolerance'
  | 'quantity'
  | 'budget'
  | 'desired_by'
  | 'destination_region'
  | 'demo_acknowledged'

export type FieldErrors = Partial<Record<FieldErrorKey, string>>
