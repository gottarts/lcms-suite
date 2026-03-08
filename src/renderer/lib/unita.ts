export const UNITA_CONCENTRAZIONE = [
  'mg/L',
  'µg/L',
  'ng/L',
  'ng/mL',
  'pg/mL',
  'ppm',
  'ppb',
  'ppt',
  '%',
] as const

export type UnitaConcentrazione = typeof UNITA_CONCENTRAZIONE[number]

export const UNITA_DEFAULT: UnitaConcentrazione = 'mg/L'

export function parseConcentrazione(raw: string | number): number {
  if (typeof raw === 'number') return raw
  return parseFloat(raw.replace(/[^\d.,]/g, '').replace(',', '.')) || 0
}
