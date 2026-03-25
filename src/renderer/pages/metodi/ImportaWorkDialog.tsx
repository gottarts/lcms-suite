// ─────────────────────────────────────────────────────────────────────────────
// ImportaWorkDialog.tsx — Dialog per importare una work esistente nello schema
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef, useMemo } from 'react'
import { workApi } from '../../lib/api'
import { verificaCompatibilitaCrm, ricostruisciWorkInSchema } from './SchemaCalibrazione.logic'
import type { CrmItem, WorkInSchema } from './SchemaCalibrazione.types'
import { C } from './SchemaCalibrazione.types'

interface Props {
  open: boolean
  metodoId: string
  crmItems: CrmItem[]
  workCols: WorkInSchema[][]
  onClose: () => void
  onImported: (work: WorkInSchema, colIdx: number) => void
}

export function ImportaWorkDialog({ open, metodoId, crmItems, workCols, onClose, onImported }: Props) {
  const [works, setWorks] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [filtro, setFiltro] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [importing, setImporting] = useState(false)
  const filtroRef = useRef<HTMLInputElement>(null)

  // dbId già presenti nello schema (per escluderle dalla lista)
  const schemaDbIds = useMemo(() => {
    const ids = new Set<number>()
    for (const col of workCols) for (const w of col) if (w.dbId != null) ids.add(w.dbId)
    return ids
  }, [workCols])

  // Carica works importabili all'apertura
  useEffect(() => {
    if (!open) return
    setLoading(true)
    setSelectedId(null)
    setFiltro('')
    workApi.listForImport(metodoId)
      .then(list => setWorks(list.filter(w => !schemaDbIds.has(w.id))))
      .catch(() => setWorks([]))
      .finally(() => {
        setLoading(false)
        setTimeout(() => filtroRef.current?.focus(), 80)
      })
  }, [open, metodoId, schemaDbIds])

  if (!open) return null

  const filtroLower = filtro.toLowerCase()
  const filtered = filtro
    ? works.filter(w => w.nome.toLowerCase().includes(filtroLower))
    : works

  const selected = selectedId != null ? works.find(w => w.id === selectedId) : null
  const compat = selected ? verificaCompatibilitaCrm(selected, crmItems) : null

  // Verifica dipendenze work mancanti
  const workColsFlat = workCols.flat()
  let dipMancante: string | null = null
  if (selected) {
    for (const ing of (selected.ingredienti ?? [])) {
      if (ing.source_type === 'work') {
        const found = workColsFlat.some(w => w.dbId === ing.source_id)
        if (!found) {
          dipMancante = ing.source_nome ?? `Work ID ${ing.source_id}`
          break
        }
      }
    }
  }

  const canImport = selected && !dipMancante && !importing

  const handleImport = async () => {
    if (!selected || !canImport) return
    setImporting(true)
    try {
      await workApi.addToMetodo(selected.id, metodoId)
      const rebuilt = ricostruisciWorkInSchema(selected, crmItems, workColsFlat, workCols)
      if (!rebuilt) return // non dovrebbe accadere se canImport è true

      // Determina colonna target: lv0 se tutte le sorgenti sono CRM, altrimenti in base alle dipendenze
      let colIdx = 0
      const hasWorkSrc = rebuilt.srcs.some(s => s.tipo === 'work')
      if (hasWorkSrc) {
        // Colonna = max(colSrc di sorgenti work) + 1
        const maxCol = Math.max(...rebuilt.srcs.filter(s => s.tipo === 'work').map(s => s.colSrc ?? 0))
        colIdx = maxCol + 1
      }
      onImported(rebuilt, colIdx)
    } finally {
      setImporting(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '7px 10px', border: `1px solid ${C.page.brd}`,
    borderRadius: 8, fontSize: 13, fontFamily: 'Lato, sans-serif',
    color: C.page.t1, background: '#fafafa', outline: 'none',
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      }}
    >
      <div style={{
        background: C.page.sur, borderRadius: 14, width: 520, maxWidth: '95vw',
        maxHeight: '88vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 12px 40px rgba(0,0,0,.12)',
        border: `1px solid ${C.page.brd}`,
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 12px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
            Importa Work esistente
          </div>
          <div style={{ fontSize: 11, color: C.page.t2, marginBottom: 12 }}>
            Seleziona una work da un altro metodo per riutilizzarla in questo schema
          </div>
          <input
            ref={filtroRef}
            type="text"
            placeholder="Cerca per nome..."
            value={filtro}
            onChange={e => setFiltro(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Lista works */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '0 24px',
          minHeight: 120, maxHeight: 340,
        }}>
          {loading && (
            <div style={{ padding: 24, textAlign: 'center', color: C.page.t2, fontSize: 12 }}>
              Caricamento...
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: C.page.t2, fontSize: 12 }}>
              {works.length === 0 ? 'Nessuna work disponibile per l\'importazione' : 'Nessun risultato'}
            </div>
          )}
          {filtered.map(w => {
            const isSelected = w.id === selectedId
            return (
              <div
                key={w.id}
                onClick={() => setSelectedId(isSelected ? null : w.id)}
                style={{
                  padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                  marginBottom: 4,
                  background: isSelected ? C.work.chip : 'transparent',
                  border: `1px solid ${isSelected ? C.work.border : 'transparent'}`,
                  transition: 'background .15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.page.t1 }}>
                    {w.nome}
                  </span>
                  {w.concentrazione != null && (
                    <span style={{ fontSize: 11, color: C.page.t2 }}>
                      {w.concentrazione} {w.unita_conc}
                    </span>
                  )}
                  {w.volume_ml != null && (
                    <span style={{ fontSize: 11, color: C.page.t2 }}>
                      {w.volume_ml} mL
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                  {(w.metodi ?? []).map((m: { id: string; nome: string }) => (
                    <span key={m.id} style={{
                      fontSize: 9, padding: '1px 6px', borderRadius: 4,
                      background: C.mix.chip, color: C.mix.text,
                      fontWeight: 600,
                    }}>
                      {m.nome}
                    </span>
                  ))}
                  <span style={{
                    fontSize: 9, padding: '1px 6px', borderRadius: 4,
                    background: '#f0f0f0', color: C.page.t2, fontWeight: 600,
                  }}>
                    {w.n_ingredienti ?? (w.ingredienti?.length ?? 0)} ingredienti
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Compatibilità + azioni */}
        <div style={{ padding: '12px 24px 20px', borderTop: `1px solid ${C.page.brd}` }}>
          {selected && compat && (
            <div style={{ marginBottom: 10 }}>
              {dipMancante ? (
                <div style={{ fontSize: 11, color: '#c62828' }}>
                  <span style={{ fontWeight: 700 }}>Dipendenza mancante: </span>
                  questa work dipende da <b>{dipMancante}</b> che non è presente nello schema.
                  Importala prima.
                </div>
              ) : compat.compatibile ? (
                <div style={{ fontSize: 11, color: '#2e7d32', fontWeight: 600 }}>
                  Tutti i CRM compatibili con questo metodo
                </div>
              ) : (
                <div style={{ fontSize: 11, color: '#e65100', fontWeight: 600 }}>
                  <span style={{ fontWeight: 700 }}>CRM extra non nello schema: </span>
                  <span style={{ fontWeight: 400 }}>{compat.mancanti.join(', ')}</span>
                  <div style={{ fontWeight: 400, marginTop: 2, color: C.page.t2 }}>
                    La work verrà importata ma questi CRM non avranno connessioni nello schema
                  </div>
                </div>
              )}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                padding: '7px 14px', borderRadius: 8, border: `1px solid ${C.page.brd}`,
                background: C.page.sur, cursor: 'pointer', fontSize: 13,
                fontWeight: 700, color: C.page.t2,
              }}
            >
              Annulla
            </button>
            <button
              onClick={handleImport}
              disabled={!canImport}
              style={{
                padding: '7px 18px', borderRadius: 8, border: 'none', cursor: canImport ? 'pointer' : 'default',
                fontSize: 13, fontWeight: 700,
                background: canImport ? C.work.border : C.page.brd,
                color: canImport ? '#fff' : C.page.th,
                opacity: importing ? 0.6 : 1,
              }}
            >
              {importing ? 'Importazione...' : 'Importa'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
