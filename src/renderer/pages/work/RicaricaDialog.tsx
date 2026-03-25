import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { workApi } from '@/lib/api'

interface RicaricaDialogProps {
  workId: number | null
  onClose: () => void
  onSuccess: (newWorkId: number) => void
}

export function RicaricaDialog({ workId, onClose, onSuccess }: RicaricaDialogProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lotStatus, setLotStatus] = useState<any[]>([])
  const [metodi_ids, setMetodiIds] = useState<string[]>([])
  // Mappa source_id → new_source_id scelto dall'utente (per gli ambigui)
  const [scelte, setScelte] = useState<Record<number, number>>({})

  useEffect(() => {
    if (!workId) return
    setLoading(true)
    setLotStatus([])
    setScelte({})
    Promise.all([
      workApi.checkLotStatus(workId),
      workApi.get(workId),
    ]).then(([status, work]) => {
      setLotStatus(status)
      setMetodiIds(work?.metodi_ids ?? [])
      // Pre-popola scelte per gli "auto" (1 solo sostituto)
      const autoscelte: Record<number, number> = {}
      for (const ing of status) {
        if (ing.stato === 'auto') {
          autoscelte[ing.source_id] = ing.sostituti[0].id
        }
      }
      setScelte(autoscelte)
    }).finally(() => setLoading(false))
  }, [workId])

  if (!workId) return null

  const daRisolvere = lotStatus.filter(i => i.stato !== 'ok')
  const tuttiRisolti = daRisolvere.every(i => {
    if (i.stato === 'auto') return true
    if (i.stato === 'ambiguo') return scelte[i.source_id] != null
    return false // mancante → non risolvibile automaticamente
  })
  const haMancanti = daRisolvere.some(i => i.stato === 'mancante')

  const handleConferma = async () => {
    if (!workId) return
    setSaving(true)
    try {
      const nuovi_ingredienti = lotStatus
        .filter(i => i.stato !== 'ok')
        .map(i => ({
          old_source_id: i.source_id,
          new_source_id: scelte[i.source_id] ?? i.source_id,
        }))
      const result = await workApi.ricarica({ old_work_id: workId, nuovi_ingredienti, metodi_ids })
      onSuccess(result.new_work_id)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'hsl(var(--background))', borderRadius: 8, padding: 24,
          width: 520, maxWidth: '95vw', maxHeight: '85vh',
          overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,.18)',
          border: '1px solid hsl(var(--border))',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontFamily: 'var(--font-heading, inherit)', fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
          Aggiorna lotti CRM
        </div>
        <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', marginBottom: 16 }}>
          Verranno creati nuovi ingredienti con i lotti attivi e la vecchia work verrà archiviata.
        </div>

        {loading ? (
          <div style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))', padding: '16px 0' }}>
            Analisi lotti in corso...
          </div>
        ) : (
          <>
            {/* Ingredienti OK */}
            {lotStatus.filter(i => i.stato === 'ok').length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#16a34a', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Lotti OK ({lotStatus.filter(i => i.stato === 'ok').length})
                </div>
                {lotStatus.filter(i => i.stato === 'ok').map(ing => (
                  <div key={ing.source_id} style={{
                    fontSize: 11, padding: '3px 8px', display: 'flex', justifyContent: 'space-between',
                    borderRadius: 4, background: '#f0fdf4', marginBottom: 2,
                  }}>
                    <span style={{ fontWeight: 500 }}>{ing.nome}</span>
                    <span style={{ fontFamily: 'IBM Plex Mono, monospace', color: '#16a34a' }}>
                      {ing.lotto_corrente ?? '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Ingredienti automatici */}
            {lotStatus.filter(i => i.stato === 'auto').length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#92400e', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Sostituzione automatica ({lotStatus.filter(i => i.stato === 'auto').length})
                </div>
                {lotStatus.filter(i => i.stato === 'auto').map(ing => (
                  <div key={ing.source_id} style={{
                    fontSize: 11, padding: '4px 8px', marginBottom: 2,
                    borderRadius: 4, background: '#fffbeb', border: '1px solid #fde68a',
                  }}>
                    <div style={{ fontWeight: 500 }}>{ing.nome}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, fontFamily: 'IBM Plex Mono, monospace', fontSize: 10 }}>
                      <span style={{ color: '#dc2626', textDecoration: 'line-through' }}>
                        {ing.lotto_usato ?? '—'}
                      </span>
                      <span style={{ color: 'hsl(var(--muted-foreground))' }}>→</span>
                      <span style={{ color: '#16a34a', fontWeight: 600 }}>
                        {ing.sostituti[0]?.lotto ?? '—'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Ingredienti ambigui — scelta richiesta */}
            {lotStatus.filter(i => i.stato === 'ambiguo').length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#b45309', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Scelta richiesta ({lotStatus.filter(i => i.stato === 'ambiguo').length})
                </div>
                {lotStatus.filter(i => i.stato === 'ambiguo').map(ing => (
                  <div key={ing.source_id} style={{
                    fontSize: 11, padding: '6px 8px', marginBottom: 4,
                    borderRadius: 4, background: '#fff7ed', border: '1px solid #fed7aa',
                  }}>
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>{ing.nome}</div>
                    <div style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', fontFamily: 'IBM Plex Mono, monospace', marginBottom: 4 }}>
                      Lotto attuale (dismesso): {ing.lotto_usato ?? '—'}
                    </div>
                    <select
                      value={scelte[ing.source_id] ?? ''}
                      onChange={e => setScelte(prev => ({ ...prev, [ing.source_id]: Number(e.target.value) }))}
                      style={{
                        width: '100%', padding: '4px 6px', fontSize: 11,
                        border: '1px solid hsl(var(--border))', borderRadius: 4,
                        background: 'hsl(var(--background))', color: 'hsl(var(--foreground))',
                        fontFamily: 'IBM Plex Mono, monospace',
                      }}
                    >
                      <option value="">— Scegli un lotto —</option>
                      {ing.sostituti.map((s: any) => (
                        <option key={s.id} value={s.id}>
                          {s.lotto ?? 'Lotto n/d'}{s.concentrazione != null ? ` · ${s.concentrazione} ${s.unita_conc}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}

            {/* Ingredienti mancanti — nessun sostituto */}
            {lotStatus.filter(i => i.stato === 'mancante').length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#dc2626', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Nessun lotto attivo trovato ({lotStatus.filter(i => i.stato === 'mancante').length})
                </div>
                {lotStatus.filter(i => i.stato === 'mancante').map(ing => (
                  <div key={ing.source_id} style={{
                    fontSize: 11, padding: '4px 8px', marginBottom: 2,
                    borderRadius: 4, background: '#fef2f2', border: '1px solid #fca5a5',
                  }}>
                    <span style={{ fontWeight: 500 }}>{ing.nome}</span>
                    <div style={{ fontSize: 10, color: '#dc2626', marginTop: 2 }}>
                      Nessun lotto attivo nel DB. Inserire un nuovo lotto prima di procedere.
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <Button size="sm" variant="ghost" onClick={onClose} disabled={saving}>
                Annulla
              </Button>
              <Button
                size="sm"
                onClick={handleConferma}
                disabled={saving || !tuttiRisolti || haMancanti || daRisolvere.length === 0}
                title={haMancanti ? 'Inserire i lotti mancanti prima di procedere' : undefined}
              >
                {saving ? 'Salvataggio...' : 'Conferma e Ricarica'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
