import { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface AutocompleteInputProps {
  value: string
  onChange: (val: string) => void
  suggestions: string[]       // lista suggerimenti da fuori, già caricati dal padre
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function AutocompleteInput({
  value,
  onChange,
  suggestions,
  placeholder,
  disabled,
  className,
}: AutocompleteInputProps) {
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState<number>(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Filtra i suggerimenti in base al testo digitato (case-insensitive, include)
  // Esclude il valore esatto già digitato (inutile suggerire quello che c'è già)
  const filtered = value.trim().length === 0
    ? []
    : suggestions.filter(
        s =>
          s.toLowerCase().includes(value.toLowerCase()) &&
          s.toLowerCase() !== value.toLowerCase()
      )

  // Chiude il dropdown se si clicca fuori
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setHighlighted(-1)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Apre/chiude il dropdown al cambiare del testo filtrato
  useEffect(() => {
    setOpen(filtered.length > 0)
    setHighlighted(-1)
  }, [value, filtered.length])

  const select = (val: string) => {
    onChange(val)
    setOpen(false)
    setHighlighted(-1)
    inputRef.current?.blur()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted(h => Math.min(h + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlighted >= 0 && filtered[highlighted]) {
        select(filtered[highlighted])
      } else if (filtered.length === 1) {
        select(filtered[0])
      }
      // Se highlighted === -1 e ci sono più suggerimenti, Enter non fa nulla:
      // il valore rimane quello digitato liberamente (campo libero)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      setHighlighted(-1)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (filtered.length > 0) setOpen(true)
        }}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
        autoComplete="off"
      />

      {open && filtered.length > 0 && (
        <ul
          className={cn(
            'absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md',
            'max-h-48 overflow-y-auto py-1 text-sm'
          )}
          // Impedisce che il click sulla lista tolga il focus dall'input
          // prima che onMouseDown chiami select()
          onMouseDown={e => e.preventDefault()}
        >
          {filtered.map((s, i) => (
            <li
              key={s}
              className={cn(
                'cursor-pointer px-3 py-1.5 transition-colors',
                i === highlighted
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent hover:text-accent-foreground'
              )}
              onMouseEnter={() => setHighlighted(i)}
              onMouseDown={() => select(s)}
            >
              {/* Evidenzia la parte che matcha il testo digitato */}
              <MatchHighlight text={s} query={value} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Sottocomponente: evidenzia in grassetto la parte del suggerimento che matcha
function MatchHighlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>

  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>

  return (
    <>
      {text.slice(0, idx)}
      <span className="font-semibold">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  )
}