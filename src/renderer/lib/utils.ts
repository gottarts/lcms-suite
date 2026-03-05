import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '\u2014'
  try {
    return new Date(dateStr).toLocaleDateString('it-IT')
  } catch {
    return dateStr
  }
}
