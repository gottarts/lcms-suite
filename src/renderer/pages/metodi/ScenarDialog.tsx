// ─────────────────────────────────────────────────────────────────────────────
// ScenarDialog.tsx  —  Dialog scenari di copertura CRM Mix
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react'
import type { AnalitoItem, CrmItem } from './SchemaCalibrazione.types'
import { C } from './SchemaCalibrazione.types'
import {
  buildMixComposizioni,
  generaScenari,
  type Scenario,
} from './SchemaCalibrazione.scenari'

interface ScenarDialogProps {
  analiti: AnalitoItem[]
  crmItems: CrmItem[]
  firmaToMixIds: Map<string, string[]>
  mixNomiMap: Map<string, Set<string>>
  removedMix: Set<string>
  obbligatorio?: boolean   // true = scenario non ancora scelto, dialog non chiudibile
  onClose: () => void
  onApply: (mixIds: string[]) => void
}

export function ScenarDialog({
  analiti, crmItems, firmaToMixIds, mixNomiMap, removedMix, obbligatorio, onClose, onApply,
}: ScenarDialogProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  const composizioni = useMemo(() => {
    const comps = buildMixComposizioni(analiti, crmItems, firmaToMixIds, mixNomiMap)
    // Filtra composizioni i cui lotti sono tutti rimossi dall'utente
    return comps.filter(c => c.mixIds.some(mid => !removedMix.has(mid)))
  }, [analiti, crmItems, firmaToMixIds, mixNomiMap, removedMix])

  const scenari = useMemo(
    () => generaScenari(analiti, composizioni),
    [analiti, composizioni],
  )

  const handleApply = (s: Scenario) => {
    // Per ogni composizione dello scenario, usa il primo lotto non rimosso
    const mixIds: string[] = []
    for (const comp of s.composizioni) {
      const lotto = comp.mixIds.find(mid => !removedMix.has(mid))
      if (lotto) mixIds.push(lotto)
    }
    onApply(mixIds)
  }

  const toggleExpand = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation()
    setExpandedIdx(prev => prev === idx ? null : idx)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: obbligatorio ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={obbligatorio ? undefined : onClose}
    >
      <div
        style={{
          background: C.page.bg, borderRadius: 14,
          boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          border: `1px solid ${C.page.brd}`,
          width: 500, maxWidth: '95vw', maxHeight: '80vh',
          display: 'flex', flexDirection: 'column',
          fontFamily: 'Lato, sans-serif',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '14px 18px 10px',
          borderBottom: `1px solid ${C.page.brd}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.page.t1 }}>
              Scenari di copertura CRM Mix
            </div>
            <div style={{ fontSize: 10, color: C.page.th, marginTop: 2,
                          fontFamily: 'IBM Plex Mono, monospace' }}>
              {obbligatorio
                ? 'Scegli uno scenario per usare lo schema'
                : `${composizioni.length} composizioni disponibili · ${analiti.length} analiti`}
            </div>
          </div>
          {!obbligatorio && (
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 18, color: C.page.t2, lineHeight: 1, padding: '2px 4px',
              }}
              title="Chiudi"
            >×</button>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
          {scenari.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center',
                          color: C.page.th, fontSize: 12 }}>
              Nessun CRM Mix disponibile.
            </div>
          ) : (
            scenari.map((s, idx) => {
              const pct = Math.round(s.copertura * 100)
              const nCop = analiti.length - s.analitiNonCoperti.length
              const isExpanded = expandedIdx === idx

              return (
                <div
                  key={idx}
                  onClick={() => handleApply(s)}
                  style={{
                    marginBottom: 8, borderRadius: 9,
                    border: `1.5px solid ${C.mix.border}`,
                    background: C.mix.bg,
                    cursor: 'pointer',
                    transition: 'box-shadow 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 10px rgba(107,163,214,0.25)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = '')}
                >
                  {/* Riga principale */}
                  <div style={{ padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* Numero scenario */}
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                      background: C.mix.border, color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700,
                    }}>{idx + 1}</div>

                    {/* Barra + info copertura */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        {/* Barra di copertura */}
                        <div style={{
                          flex: 1, height: 6, borderRadius: 3,
                          background: C.page.brd, overflow: 'hidden',
                        }}>
                          <div style={{
                            width: `${pct}%`, height: '100%',
                            background: C.mix.border, borderRadius: 3,
                          }} />
                        </div>
                        {/* Etichetta */}
                        <span style={{
                          fontSize: 11, fontWeight: 700, color: C.mix.text,
                          fontFamily: 'IBM Plex Mono, monospace', whiteSpace: 'nowrap',
                        }}>
                          {nCop}/{analiti.length} ({pct}%)
                        </span>
                      </div>
                      {/* Chip nomi mix */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {s.composizioni.map(c => (
                          <span key={c.firma} style={{
                            padding: '1px 7px', borderRadius: 10, fontSize: 10,
                            background: C.mix.chip, color: C.mix.text,
                            border: `1px solid ${C.mix.border}`,
                            fontFamily: 'IBM Plex Mono, monospace',
                          }}>{c.nomeDisplay}</span>
                        ))}
                      </div>
                    </div>

                    {/* Pulsante espandi (non applica) */}
                    <button
                      onClick={e => toggleExpand(e, idx)}
                      title={isExpanded ? 'Nascondi dettaglio' : 'Mostra dettaglio analiti'}
                      style={{
                        background: 'none', border: `1px solid ${C.mix.border}`,
                        borderRadius: 6, padding: '2px 7px', cursor: 'pointer',
                        fontSize: 11, color: C.mix.text, flexShrink: 0,
                      }}
                    >
                      {isExpanded ? '▲' : '▼'}
                    </button>
                  </div>

                  {/* Dettaglio espandibile */}
                  {isExpanded && (
                    <div
                      onClick={e => e.stopPropagation()}
                      style={{
                        borderTop: `1px solid ${C.mix.border}`,
                        padding: '8px 12px 10px',
                        background: '#f5faff',
                        borderRadius: '0 0 8px 8px',
                      }}
                    >
                      {s.analitiCopertiPerMix.map(gruppo => (
                        <div key={gruppo.firma} style={{ marginBottom: 6 }}>
                          <div style={{
                            fontSize: 9, fontWeight: 700, color: C.mix.text,
                            textTransform: 'uppercase', letterSpacing: '0.07em',
                            marginBottom: 3, fontFamily: 'IBM Plex Mono, monospace',
                          }}>{gruppo.nome}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                            {gruppo.analiti.map(n => (
                              <span key={n} style={{
                                fontSize: 10, padding: '1px 6px', borderRadius: 8,
                                background: C.mix.chip, color: C.mix.text,
                              }}>{n}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                      {s.analitiNonCoperti.length > 0 && (
                        <div style={{ marginTop: 4 }}>
                          <div style={{
                            fontSize: 9, fontWeight: 700, color: C.page.th,
                            textTransform: 'uppercase', letterSpacing: '0.07em',
                            marginBottom: 3, fontFamily: 'IBM Plex Mono, monospace',
                          }}>Non coperti ({s.analitiNonCoperti.length})</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                            {s.analitiNonCoperti.map(n => (
                              <span key={n} style={{
                                fontSize: 10, padding: '1px 6px', borderRadius: 8,
                                background: C.page.sur, color: C.page.th,
                                border: `1px solid ${C.page.brd}`,
                              }}>{n}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '8px 18px 12px',
          borderTop: `1px solid ${C.page.brd}`,
          flexShrink: 0,
          fontSize: 10, color: C.page.th, fontFamily: 'IBM Plex Mono, monospace',
        }}>
          Clicca uno scenario per applicarlo · ▼ per vedere gli analiti coperti
        </div>
      </div>
    </div>
  )
}
