import type {
  DemoBoardCard,
  DemoMatch,
  DemoOffer,
  DemoRecordSet,
  DemoSupplier,
  DemoWish,
  WishFormValues,
} from './types'

/** Fixed primary fixture IDs and timestamps from MOP-595. Never regenerated per run. */
export const FIXTURE_IDS = {
  wish: 'wish_syn_20260831_001',
  supplier: 'supplier_syn_founder_001',
  offer: 'offer_syn_20260831_001',
  match: 'match_syn_20260831_001',
  board: 'board_syn_20260831_001',
} as const

export const FIXTURE_TIMESTAMPS = {
  submitted_at: '2026-08-31T02:00:00.000Z',
  confirmed_at: '2026-08-31T02:01:00.000Z',
  supplier_created_at: '2026-08-31T02:01:10.000Z',
  offer_created_at: '2026-08-31T02:01:20.000Z',
  match_confirmed_at: '2026-08-31T02:01:30.000Z',
  board_generated_at: '2026-08-31T02:01:40.000Z',
} as const

export const PRIMARY_WISH = {
  id: FIXTURE_IDS.wish,
  submitted_at: FIXTURE_TIMESTAMPS.submitted_at,
  confirmed_at: FIXTURE_TIMESTAMPS.confirmed_at,
  status: 'confirmed',
  category: 'vintage_lens',
  not_found_reason: 'price_or_terms_mismatch',
  raw: {
    buyer_name: 'Alex Demo',
    buyer_email: 'alex.demo@example.invalid',
    raw_text: 'Minor cleaning marks are acceptable if they do not affect images.',
  },
  structured: {
    item_name: 'Canon FD 50mm f/1.4 S.S.C.',
    mount: 'Canon FD',
    focal_length_mm: 50,
    max_aperture: 'f/1.4',
    generation_coating: 'S.S.C.',
    camera_body: 'Sony α7 IV with FD–E adapter',
    serial_number: null,
    optical_tolerance: [
      'no_haze',
      'no_fungus',
      'no_balsam_separation',
      'minor_dust_allowed',
      'minor_cleaning_marks_if_no_image_impact',
    ],
    mechanical_tolerance: ['smooth_helicoid', 'responsive_aperture', 'dry_blades'],
    cosmetic_tolerance: 'user_grade',
    quantity: 1,
    budget: { amount: 350, currency: 'USD', scope: 'item_only' },
    desired_by: '2026-10-31',
    destination_region: 'US',
    contact_consent: false,
    demo_acknowledged: true,
  },
} as const satisfies DemoWish

export const PRIMARY_SUPPLIER = {
  id: FIXTURE_IDS.supplier,
  created_at: FIXTURE_TIMESTAMPS.supplier_created_at,
  display_name: 'Founder Demo Supplier',
  type: 'synthetic_internal',
  identity_verified: false,
  inventory_verified: false,
} as const satisfies DemoSupplier

export const PRIMARY_OFFER = {
  id: FIXTURE_IDS.offer,
  wish_id: FIXTURE_IDS.wish,
  supplier_id: FIXTURE_IDS.supplier,
  created_at: FIXTURE_TIMESTAMPS.offer_created_at,
  status: 'synthetic_internal',
  item_service_cost: null,
  supplier_reward: null,
  shipping_other_cost: null,
  currency: null,
  availability_verified: false,
  commercial_validity: false,
} as const satisfies DemoOffer

export const PRIMARY_MATCH = {
  id: FIXTURE_IDS.match,
  wish_id: FIXTURE_IDS.wish,
  offer_id: FIXTURE_IDS.offer,
  confirmed_at: FIXTURE_TIMESTAMPS.match_confirmed_at,
  status: 'synthetic_internal_confirmed',
  transaction_status: 'not_applicable',
} as const satisfies DemoMatch

export const PRIMARY_BOARD_CARD = {
  id: FIXTURE_IDS.board,
  wish_id: FIXTURE_IDS.wish,
  generated_at: FIXTURE_TIMESTAMPS.board_generated_at,
  visibility: 'local_preview_only',
  demo_label: 'Synthetic demo',
  title: 'Canon FD 50mm f/1.4 S.S.C. vintage lens',
  mount: 'Canon FD',
  focal_length: '50 mm',
  max_aperture: 'f/1.4',
  optical: 'No haze, fungus, or balsam separation; minor dust accepted',
  mechanical: 'Smooth helicoid; responsive aperture; dry blades',
  cosmetic: 'User grade',
  quantity: 1,
  budget_band: 'USD 300–399',
  desired_timing: 'By Oct 2026',
  destination: 'United States',
  reason: 'Condition confidence not available locally',
  status: 'Demo matched internally',
} as const satisfies DemoBoardCard

export const PRIMARY_FIXTURE = {
  demo_label: 'Synthetic demo',
  wish: PRIMARY_WISH,
  supplier: PRIMARY_SUPPLIER,
  offer: PRIMARY_OFFER,
  match: PRIMARY_MATCH,
  board_card: PRIMARY_BOARD_CARD,
} as const satisfies DemoRecordSet

/** Test-only offer that points at a different wish — drives mismatch UI. */
export const MISMATCHED_OFFER = {
  ...PRIMARY_OFFER,
  id: 'offer_syn_mismatch_001',
  wish_id: 'wish_syn_other_999',
} as const satisfies DemoOffer

/** Happy-path form seed matching the primary fixture (no buyer identity fields). */
export const FIXTURE_FORM_VALUES: WishFormValues = {
  item_name: 'Canon FD 50mm f/1.4 S.S.C.',
  mount: 'Canon FD',
  focal_length_mm: '50',
  max_aperture: 'f/1.4',
  generation_coating: 'S.S.C.',
  camera_body: 'Sony α7 IV with FD–E adapter',
  optical_tolerance: [
    'no_haze',
    'no_fungus',
    'no_balsam_separation',
    'minor_dust_allowed',
    'minor_cleaning_marks_if_no_image_impact',
  ],
  mechanical_tolerance: ['smooth_helicoid', 'responsive_aperture', 'dry_blades'],
  cosmetic_tolerance: 'user_grade',
  quantity: '1',
  budget_amount: '350',
  budget_currency: 'USD',
  desired_by: '2026-10-31',
  desired_flexible: false,
  destination_region: 'US',
  notes: 'Minor cleaning marks are acceptable if they do not affect images.',
  demo_acknowledged: true,
}

export const EMPTY_FORM_VALUES: WishFormValues = {
  item_name: '',
  mount: '',
  focal_length_mm: '',
  max_aperture: '',
  generation_coating: '',
  camera_body: '',
  optical_tolerance: [],
  mechanical_tolerance: [],
  cosmetic_tolerance: '',
  quantity: '1',
  budget_amount: '',
  budget_currency: 'USD',
  desired_by: '',
  desired_flexible: false,
  destination_region: '',
  notes: '',
  demo_acknowledged: false,
}

export const STRUCTURING_DELAY_MS = 400
