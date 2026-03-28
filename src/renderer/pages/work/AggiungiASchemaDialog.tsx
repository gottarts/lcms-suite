// ─────────────────────────────────────────────────────────────────────────────
// AggiungiASchemaDialog.tsx — Dialog per aggiungere una work orfana a uno schema
//
// Usato da WorkPage quando una work non è collegata ad alcun metodo
// (primo_metodo_id = null). A differenza di ImportaWorkDialog, non filtra per
// analiti condivisi: la work può entrare in qualsiasi schema.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { metodiApi, schemaCalApi, workApi, compostiApi } from '../../lib/api'
import { ricostruisciWorkInSchema, verificaCompatibilitaCrm } from '../metodi/SchemaCalibrazione.logic'
import type { CrmItem, WorkInSchema } from '../metodi/SchemaCalibrazione.types'
import { C } from '../metodi/SchemaCalibrazione.types'

interface Props {
  open: boolean
  workId: number | null
  workNome: string
  onClose: () => void
}

interface SchemaState {
  workCols: WorkInSchema[][]
  removedCon: string[]
  removedMix: string[]
  crmItems: CrmItem[]
  rebuilt: WorkInSchema | null
  dipMancante: string | null
  compat: { compatibile: boolean; mancanti: string[] } | null
  colIdx: number
  alreadyIn: boolean
}

function buildCrmItems(rows: any[]): CrmItem[] {
  const oggi = new Date().toISOString().slice(0, 10)
  const disponibili = rows.filter((r: any) => {
    if (r.data_dismissione) return false
    if (!r.mix_id && r.scadenza_prodotto && r.scadenza_prodotto < oggi) {
      if (!r.ultima_rivalidazione || r.ultima_rivalidazione < oggi) return false
    }
    return true
  })
  const items: CrmItem[] = disponibili.map((r: any) => {
    const cv = Number(r.concentrazione) || 0
    const raw = String(r.destinazione_uso ?? r.nome ?? '').toLowerCase()
    const isIS = raw.includes('intern') || raw.includes(' is') || /^m[0-9]/.test(r.nome ?? '')
    return {
      id: r.id,
      nome: r.nome ?? '',
      mix_id: r.mix_id ?? null,
      mix: r.forma_commerciale ?? r.mix ?? null,
      concentrazione: r.concentrazione ?? null,
      unita_conc: r.unita_conc ?? 'mg/L',
      forma: r.forma ?? null,
      lotto: r.lotto ?? null,
      produttore: r.produttore ?? null,
      scadenza_prodotto: r.scadenza_prodotto ?? null,
      ultima_rivalidazione: r.ultima_rivalidazione ?? null,
      cv,
      concVariabile: false,
      isIS,
    }
  })
  // Rileva mix eterogenei
  const mixCvSets = new Map<string, Set<number>>()
  for (const item of items) {
    if (item.mix_id) {
      const s = mixCvSets.get(item.mix_id) ?? new Set<number>()
      s.add(item.cv)
      mixCvSets.set(item.mix_id, s)
    }
  }
  return items.map(item => ({
    ...item,
    concVariabile: item.mix_id ? (mixCvSets.get(item.mix_id)?.size ?? 0) > 1 : false,
  }))
}

export function AggiungiASchemaDialog({ open, workId, workNome, onClose }: Props) {
  const navigate = useNavigate()
  const [metodi, setMetodi] = useState<any[]>([])
  const [selectedMetodoId, setSelectedMetodoId] = useState<string>('')
  const [schemaState, setSchemaState] = useState<SchemaState | null>(null)
  const [loadingSchema, setLoadingSchema] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Carica metodi all'apertura
  useEffect(() => {
    if (!open) return
    setSelectedMetodoId('')
    setSchemaState(null)
    setError(null)
    metodiApi.list().then(setMetodi).catch(() => setMetodi([]))
  }, [open])

  // Carica schema del metodo selezionato
  useEffect(() => {
    if (!selectedMetodoId || !workId) return
    setLoadingSchema(true)
    setSchemaState(null)
    setError(null)

    Promise.all([
      workApi.get(workId),
      schemaCalApi.get(selectedMetodoId),
      compostiApi.listForSchema(selectedMetodoId),
    ]).then(([dbWork, schema, crmRows]) => {
      if (!dbWork) { setError('Work non trovata.'); return }

      const workCols: WorkInSchema[][] = schema?.workCols ?? [[], []]
      const removedCon: string[] = schema?.removedCon ?? []
      const removedMix: string[] = schema?.removedMix ?? []

      // Controlla se già presente
      const schemaDbIds = new Set(workCols.flat().map((w: WorkInSchema) => w.dbId).filter((id: any) => id != null))
      if (schemaDbIds.has(workId)) {
        setSchemaState({ workCols, removedCon, removedMix, crmItems: [], rebuilt: null, dipMancante: null, compat: null, colIdx: 0, alreadyIn: true })
        return
      }

      const crmItems = buildCrmItems(crmRows as any[])
      const workColsFlat = workCols.flat()
      const rebuilt = ricostruisciWorkInSchema(dbWork, crmItems, workColsFlat, workCols)

      // Dipendenza work mancante
      let dipMancante: string | null = null
      for (const ing of (dbWork.ingredienti ?? [])) {
        if (ing.source_type === 'work') {
          const found = workColsFlat.some((w: WorkInSchema) => w.dbId === ing.source_id)
          if (!found) { dipMancante = ing.source_nome ?? `Work ID ${ing.source_id}`; break }
        }
      }

      const compat = verificaCompatibilitaCrm(dbWork, crmItems)

      // Colonna target
      let colIdx = 0
      if (rebuilt?.srcs.some(s => s.tipo === 'work')) {
        const maxCol = Math.max(...rebuilt.srcs.filter(s => s.tipo === 'work').map(s => s.colSrc ?? 0))
        colIdx = maxCol + 1
      }

      setSchemaState({ workCols, removedCon, removedMix, crmItems, rebuilt, dipMancante, compat, colIdx, alreadyIn: false })
    }).catch(e => {
      setError(`Errore caricamento: ${e?.message ?? e}`)
    }).finally(() => setLoadingSchema(false))
  }, [selectedMetodoId, workId])

  const handleConfirm = async () => {
    if (!schemaState?.rebuilt || !selectedMetodoId) return
    setSaving(true)
    setError(null)
    try {
      const { workCols, removedCon, removedMix, rebuilt, colIdx } = schemaState
      const newWorkCols: WorkInSchema[][] = workCols.map(col => [...col])
      while (newWorkCols.length <= colIdx) newWorkCols.push([])
      newWorkCols[colIdx] = [...newWorkCols[colIdx], rebuilt]

      await schemaCalApi.save(selectedMetodoId, newWorkCols, removedCon, removedMix)
      onClose()
      navigate('/metodi', { state: { schemaMetodoId: selectedMetodoId } })
    } catch (e: any) {
      setError(`Errore salvataggio: ${e?.message ?? e}`)
      setSaving(false)
    }
  }

  if (!open) return null

  const canConfirm = !!schemaState?.rebuilt && !schemaState.dipMancante && !schemaState.alreadyIn && !saving && !loadingSchema

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px',
    border: `1px solid ${C.page.brd}`, borderRadius: 8,
    fontSize: 13, fontFamily: 'Lato, sans-serif',
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
        background: C.page.sur, borderRadius: 14, width: 480, maxWidth: '95vw',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 12px 40px rgba(0,0,0,.12)',
        border: `1px solid ${C.page.brd}`,
        padding: '24px',
        gap: 0,
      }}>
        {/* Header */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
            Aggiungi allo Schema
          </div>
          <div style={{ fontSize: 11, color: C.page.t2 }}>
            Seleziona lo schema di calibrazione per <b>{workNome}</b>
          </div>
        </div>

        {/* Selezione metodo */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.page.t2, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Schema di calibrazione
          </div>
          <select
            value={selectedMetodoId}
            onChange={e => setSelectedMetodoId(e.target.value)}
            style={inputStyle}
          >
            <option value="">— Seleziona metodo —</option>
            {metodi.map(m => (
              <option key={m.id} value={m.id}>{m.nome}</option>
            ))}
          </select>
        </div>

        {/* Stato caricamento */}
        {loadingSchema && (
          <div style={{ fontSize: 12, color: C.page.t2, marginBottom: 12 }}>
            Caricamento schema...
          </div>
        )}

        {/* Errore */}
        {error && (
          <div style={{ fontSize: 11, color: '#c62828', marginBottom: 12, padding: '8px 12px', background: '#fff3f3', borderRadius: 6 }}>
            {error}
          </div>
        )}

        {/* Compatibilità */}
        {schemaState && !loadingSchema && !error && (
          <div style={{ marginBottom: 16 }}>
            {schemaState.alreadyIn ? (
              <div style={{ fontSize: 11, color: C.page.t2, padding: '8px 12px', background: '#f5f5f5', borderRadius: 6 }}>
                Questa work è già presente in questo schema.
              </div>
            ) : schemaState.dipMancante ? (
              <div style={{ fontSize: 11, color: '#c62828', padding: '8px 12px', background: '#fff3f3', borderRadius: 6 }}>
                <span style={{ fontWeight: 700 }}>Dipendenza mancante: </span>
                questa work dipende da <b>{schemaState.dipMancante}</b> che non è ancora nello schema. Aggiungila prima.
              </div>
            ) : !schemaState.rebuilt ? (
              <div style={{ fontSize: 11, color: '#c62828', padding: '8px 12px', background: '#fff3f3', borderRadius: 6 }}>
                Impossibile aggiungere la work a questo schema.
              </div>
            ) : schemaState.compat?.compatibile ? (
              <div style={{ fontSize: 11, color: '#2e7d32', fontWeight: 600, padding: '8px 12px', background: '#f1f8f1', borderRadius: 6 }}>
                Tutti i CRM sono presenti in questo schema
              </div>
            ) : (
              <div style={{ fontSize: 11, color: '#e65100', padding: '8px 12px', background: '#fff8f0', borderRadius: 6 }}>
                <span style={{ fontWeight: 700 }}>CRM non in schema: </span>
                <span>{schemaState.compat?.mancanti.join(', ')}</span>
                <div style={{ marginTop: 2, color: C.page.t2 }}>
                  La work verrà aggiunta ma questi CRM appariranno come ingredienti extra (⚠)
                </div>
              </div>
            )}
          </div>
        )}

        {/* Azioni */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          paddingTop: 16, borderTop: `1px solid ${C.page.brd}`,
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '7px 14px', borderRadius: 8,
              border: `1px solid ${C.page.brd}`,
              background: C.page.sur, cursor: 'pointer',
              fontSize: 13, fontWeight: 700, color: C.page.t2,
            }}
          >
            Annulla
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            style={{
              padding: '7px 18px', borderRadius: 8, border: 'none',
              cursor: canConfirm ? 'pointer' : 'default',
              fontSize: 13, fontWeight: 700,
              background: canConfirm ? C.work.border : C.page.brd,
              color: canConfirm ? '#fff' : C.page.th,
              opacity: saving ? 0.6 : 1,
              transition: 'opacity .15s',
            }}
          >
            {saving ? 'Aggiunta in corso...' : 'Aggiungi allo Schema ↗'}
          </button>
        </div>
      </div>
    </div>
  )
}
