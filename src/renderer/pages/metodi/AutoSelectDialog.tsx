// ─────────────────────────────────────────────────────────────────────────────
// AutoSelectDialog.tsx  —  Dialog selezione automatica CRM (Mix + Singoli)
//
// Calcola la combinazione ottimale di CRM (mix + singoli) che massimizza la
// copertura degli analiti rispettando la disgiunzione tra mix.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react'
import type { AnalitoItem, CrmItem } from './SchemaCalibrazione.types'
import { C } from './SchemaCalibrazione.types'
import {
  buildMixComposizioni,
  generaScenari,
} from './SchemaCalibrazione.scenari'

interface AutoSelectDialogProps {
  analiti: AnalitoItem[]
  crmItems: CrmItem[]
  firmaToMixIds: Map<string, string[]>
  mixNomiMap: Map<string, Set<string>>
  removedMix: Set<string>
  onClose: () => void
  onApply: (mixIds: string[], sngIds: string[]) => void
}

export function AutoSelectDialog({
  analiti, crmItems, firmaToMixIds, mixNomiMap, removedMix, onClose, onApply,
}: AutoSelectDialogProps) {

  const risultato = useMemo(() => {
    // 1. Costruisci composizioni filtrando quelle con tutti i lotti rimossi
    const comps = buildMixComposizioni(analiti, crmItems, firmaToMixIds, mixNomiMap)
      .filter(c => c.mixIds.some(mid => !removedMix.has(mid)))

    // 2. Scenario 1 = mix ottimali (massima copertura disgiunta)
    const scenari = generaScenari(analiti, comps)
    const scenario1 = scenari[0] ?? null

    // 3. Analiti coperti dai mix scelti
    const coperteDaMix = new Set<string>()
    const mixScelti: Array<{ nomeDisplay: string; mixId: string; analiti: string[] }> = []
    if (scenario1) {
      for (const comp of scenario1.composizioni) {
        const lotto = comp.mixIds.find(mid => !removedMix.has(mid))
        if (lotto) {
          const listaAnaliti = [...comp.analiti]
          for (const n of listaAnaliti) coperteDaMix.add(n)
          mixScelti.push({ nomeDisplay: comp.nomeDisplay, mixId: lotto, analiti: listaAnaliti })
        }
      }
    }

    // 4. Per analiti non coperti da mix: seleziona primo singolo disponibile
    const singoleScelti: Array<{ sngId: string; nome: string }> = []
    const nonCopertiNemmeno: string[] = []
    for (const a of analiti) {
      if (coperteDaMix.has(a.nome.toLowerCase())) continue
      if (a.sngIds.length > 0) {
        singoleScelti.push({ sngId: a.sngIds[0], nome: a.nome })
      } else {
        nonCopertiNemmeno.push(a.nome)
      }
    }

    // 5. CRM esclusi
    const mixIdSceltiSet = new Set(mixScelti.map(m => m.mixId))
    // Mix esclusi: nomi commerciali distinti dei mix non selezionati
    const mixEsclusi: string[] = []
    for (const c of crmItems) {
      if (c.mix_id && !mixIdSceltiSet.has(c.mix_id)) {
        const nome = c.mix ?? c.mix_id
        if (!mixEsclusi.includes(nome)) mixEsclusi.push(nome)
      }
    }
    // Singoli esclusi: singoli disponibili per analiti già coperti da mix, o secondi lotti
    const sngIdSceltiSet = new Set(singoleScelti.map(s => s.sngId))
    const sngEsclusi: string[] = []
    for (const c of crmItems) {
      if (!c.mix_id && !sngIdSceltiSet.has(String(c.id))) {
        if (!sngEsclusi.includes(c.nome)) sngEsclusi.push(c.nome)
      }
    }

    const nCoperti = coperteDaMix.size + singoleScelti.length
    const copertaTotale = analiti.length > 0 ? nCoperti / analiti.length : 0

    return {
      mixScelti,
      singoleScelti,
      nonCopertiNemmeno,
      mixEsclusi,
      sngEsclusi,
      copertaTotale,
      nCoperti,
      mixIds: mixScelti.map(m => m.mixId),
      sngIds: singoleScelti.map(s => s.sngId),
    }
  }, [analiti, crmItems, firmaToMixIds, mixNomiMap, removedMix])

  const pct = Math.round(risultato.copertaTotale * 100)

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: C.page.bg, borderRadius: 14,
          boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          border: `1px solid ${C.page.brd}`,
          width: 520, maxWidth: '95vw', maxHeight: '82vh',
          display: 'flex', flexDirection: 'column',
          fontFamily: 'Lato, sans-serif',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '14px 18px 10px',
          borderBottom: `1px solid ${C.page.brd}`,
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.page.t1 }}>
            Selezione automatica CRM
          </div>
          <div style={{
            fontSize: 10, color: C.page.th, marginTop: 3,
            fontFamily: 'IBM Plex Mono, monospace',
          }}>
            {risultato.nCoperti}/{analiti.length} analiti coperti · {pct}%
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px' }}>

          {/* Mix selezionati */}
          {risultato.mixScelti.length > 0 && (
            <Section label="Mix selezionati" count={risultato.mixScelti.length}>
              {risultato.mixScelti.map(m => (
                <div key={m.mixId} style={{ marginBottom: 6 }}>
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: C.mix.text,
                    fontFamily: 'IBM Plex Mono, monospace', marginBottom: 3,
                  }}>{m.nomeDisplay}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {m.analiti.map(n => (
                      <span key={n} style={{
                        fontSize: 10, padding: '1px 7px', borderRadius: 8,
                        background: C.mix.chip, color: C.mix.text,
                        border: `1px solid ${C.mix.border}`,
                      }}>{n}</span>
                    ))}
                  </div>
                </div>
              ))}
            </Section>
          )}

          {/* Singoli selezionati */}
          {risultato.singoleScelti.length > 0 && (
            <Section label="Singoli selezionati" count={risultato.singoleScelti.length}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {risultato.singoleScelti.map(s => (
                  <span key={s.sngId} style={{
                    fontSize: 10, padding: '1px 7px', borderRadius: 8,
                    background: C.sng.chip, color: C.sng.text,
                    border: `1px solid ${C.sng.border}`,
                  }}>{s.nome}</span>
                ))}
              </div>
            </Section>
          )}

          {/* Non coperti */}
          {risultato.nonCopertiNemmeno.length > 0 && (
            <Section label="Non coperti" count={risultato.nonCopertiNemmeno.length} warn>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {risultato.nonCopertiNemmeno.map(n => (
                  <span key={n} style={{
                    fontSize: 10, padding: '1px 7px', borderRadius: 8,
                    background: C.page.sur, color: C.page.th,
                    border: `1px solid ${C.page.brd}`,
                  }}>{n}</span>
                ))}
              </div>
            </Section>
          )}

          {/* Esclusi */}
          {(risultato.mixEsclusi.length > 0 || risultato.sngEsclusi.length > 0) && (
            <Section label="Esclusi" count={risultato.mixEsclusi.length + risultato.sngEsclusi.length} muted>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {risultato.mixEsclusi.map(n => (
                  <span key={`mix-${n}`} style={{
                    fontSize: 10, padding: '1px 7px', borderRadius: 8,
                    background: '#fff0ee', color: '#b05040',
                    border: '1px solid #e0b0a8',
                  }}>{n}</span>
                ))}
                {risultato.sngEsclusi.map(n => (
                  <span key={`sng-${n}`} style={{
                    fontSize: 10, padding: '1px 7px', borderRadius: 8,
                    background: C.page.sur, color: C.page.t2,
                    border: `1px solid ${C.page.brd}`,
                  }}>{n}</span>
                ))}
              </div>
            </Section>
          )}

          {/* Caso: nessun CRM disponibile */}
          {risultato.mixScelti.length === 0 && risultato.singoleScelti.length === 0 && (
            <div style={{ padding: '24px 0', textAlign: 'center', color: C.page.th, fontSize: 12 }}>
              Nessun CRM disponibile per la selezione automatica.
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '8px 18px 12px',
          borderTop: `1px solid ${C.page.brd}`,
          flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '6px 16px', borderRadius: 8,
              border: `1px solid ${C.page.brd}`,
              background: C.page.sur, cursor: 'pointer',
              fontSize: 11, fontWeight: 500, color: C.page.t2,
              fontFamily: 'Lato, sans-serif',
            }}
          >Annulla</button>
          <button
            onClick={() => onApply(risultato.mixIds, risultato.sngIds)}
            disabled={risultato.mixIds.length === 0 && risultato.sngIds.length === 0}
            style={{
              padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 700, fontFamily: 'Lato, sans-serif',
              background: (risultato.mixIds.length > 0 || risultato.sngIds.length > 0)
                ? C.mix.border : C.page.brd,
              color: (risultato.mixIds.length > 0 || risultato.sngIds.length > 0)
                ? '#fff' : C.page.th,
            }}
          >Applica</button>
        </div>
      </div>
    </div>
  )
}

// ── Helper UI ─────────────────────────────────────────────────────────────────

function Section({
  label, count, warn, muted, children,
}: {
  label: string
  count: number
  warn?: boolean
  muted?: boolean
  children: React.ReactNode
}) {
  const color = warn ? '#b05040' : muted ? C.page.th : C.page.t2
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        fontSize: 9, fontWeight: 700, color,
        textTransform: 'uppercase', letterSpacing: '0.07em',
        marginBottom: 5, fontFamily: 'IBM Plex Mono, monospace',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {label}
        <span style={{
          fontSize: 9, padding: '0 5px', borderRadius: 6,
          background: C.page.brd, color: C.page.th,
        }}>{count}</span>
      </div>
      {children}
    </div>
  )
}
