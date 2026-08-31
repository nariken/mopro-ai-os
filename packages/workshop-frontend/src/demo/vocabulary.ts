import type {
  CosmeticGrade,
  MechanicalToleranceCode,
  OpticalToleranceCode,
  RegionCode,
} from './types'

export interface VocabEntry<T extends string> {
  code: T
  label: string
  /** When true, provenance is raw free text — omit from Board projection. */
  fromRawText?: boolean
}

export const MOUNT_OPTIONS = [
  'Canon FD',
  'Nikon F',
  'M42',
  'Leica M',
  'Minolta MD',
  'Pentax K',
  'Other',
] as const

export const OPTICAL_TOLERANCE: readonly VocabEntry<OpticalToleranceCode>[] = [
  { code: 'no_haze', label: 'No haze' },
  { code: 'no_fungus', label: 'No fungus' },
  { code: 'no_balsam_separation', label: 'No balsam separation' },
  { code: 'minor_dust_allowed', label: 'Minor dust accepted' },
  {
    code: 'minor_cleaning_marks_if_no_image_impact',
    label: 'Minor cleaning marks if no image impact',
    fromRawText: true,
  },
]

export const MECHANICAL_TOLERANCE: readonly VocabEntry<MechanicalToleranceCode>[] = [
  { code: 'smooth_helicoid', label: 'Smooth helicoid' },
  { code: 'responsive_aperture', label: 'Responsive aperture' },
  { code: 'dry_blades', label: 'Dry blades' },
]

export const COSMETIC_GRADES: readonly VocabEntry<CosmeticGrade>[] = [
  { code: 'user_grade', label: 'User grade' },
  { code: 'collector_grade', label: 'Collector grade' },
]

export const REGION_OPTIONS: readonly { code: RegionCode; label: string }[] = [
  { code: 'US', label: 'United States' },
  { code: 'JP', label: 'Japan' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'CA', label: 'Canada' },
  { code: 'AU', label: 'Australia' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
]

export const CURRENCY_OPTIONS = ['USD', 'JPY', 'EUR', 'GBP'] as const

export const APERTURE_PRESETS = ['f/1.2', 'f/1.4', 'f/1.8', 'f/2', 'f/2.8', 'f/3.5', 'f/4'] as const

export function regionLabel(code: RegionCode): string {
  return REGION_OPTIONS.find((r) => r.code === code)?.label ?? code
}

export function cosmeticLabel(code: CosmeticGrade): string {
  return COSMETIC_GRADES.find((c) => c.code === code)?.label ?? code
}

export function opticalLabel(code: OpticalToleranceCode): string {
  return OPTICAL_TOLERANCE.find((o) => o.code === code)?.label ?? code
}

export function mechanicalLabel(code: MechanicalToleranceCode): string {
  return MECHANICAL_TOLERANCE.find((m) => m.code === code)?.label ?? code
}

export function isFromRawText(code: OpticalToleranceCode): boolean {
  return OPTICAL_TOLERANCE.find((o) => o.code === code)?.fromRawText === true
}
