import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '\u2014'
  try {
    // Aggiungi T00:00:00 se è solo una data YYYY-MM-DD, per evitare sfasamento UTC→locale
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr + 'T00:00:00' : dateStr
    return new Date(iso).toLocaleDateString('it-IT')
  } catch {
    return dateStr
  }
}
