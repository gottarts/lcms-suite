interface FialeSelectorProps {
  numeroFiale: number
  fialeAperte: number
  onApri: (fialaNumero: number) => void
}

export function FialeSelector({ numeroFiale, fialeAperte, onApri }: FialeSelectorProps) {
  if (numeroFiale <= 1) return null

  return (
  <div className="flex gap-1 items-center">
    {Array.from({ length: numeroFiale }, (_, i) => {
      const aperta = i < fialeAperte
      return (
        <button
          key={i}
          onClick={e => { e.stopPropagation(); if (!aperta) onApri(i + 1) }}
          className={`text-base leading-none transition-colors ${
            aperta
              ? 'cursor-default text-foreground'
              : 'cursor-pointer text-muted-foreground hover:text-foreground'
          }`}
          title={aperta ? `Fiala ${i + 1} aperta` : `Apri fiala ${i + 1}`}
        >
          {aperta ? '●' : '○'}
        </button>
      )
    })}
    <span className="text-xs text-muted-foreground ml-1">
      {fialeAperte}/{numeroFiale} aperte
    </span>
   </div>
   )
}