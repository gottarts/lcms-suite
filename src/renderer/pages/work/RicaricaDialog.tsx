import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { workApi } from '@/lib/api'

interface RicaricaDialogProps {
  workId: number | null
  onClose: () => void
  onSuccess: (newWorkId: number) => void
}

// Raggruppa ingredienti per mix_id (null = singolo)
// Restituisce una lista di "gruppi": mix o singolo
interface MixGroup {
  mix_id: string | null
  forma_commerciale: string | null
  members: any[]
  // Stato del gruppo: il peggiore dei membri (mancante > ambiguo > auto > ok)
  stato: 'ok' | 'auto' | 'ambiguo' | 'mancante'
}

const STATO_RANK: Record<string, number> = { ok: 0, auto: 1, ambiguo: 2, mancante: 3 }

function buildGroups(lotStatus: any[]): MixGroup[] {
  const mixMap = new Map<string, MixGroup>()
  const singles: MixGroup[] = []

  for (const ing of lotStatus) {
    if (ing.mix_id) {
      if (!mixMap.has(ing.mix_id)) {
        mixMap.set(ing.mix_id, {
          mix_id: ing.mix_id,
          forma_commerciale: ing.forma_commerciale ?? ing.mix_id,
          members: [],
          stato: 'ok',
        })
      }
      const g = mixMap.get(ing.mix_id)!
      g.members.push(ing)
      if (STATO_RANK[ing.stato] > STATO_RANK[g.stato]) {
        g.stato = ing.stato
      }
    } else {
      singles.push({
        mix_id: null,
        forma_commerciale: null,
        members: [ing],
        stato: ing.stato,
      })
    }
  }

  return [...mixMap.values(), ...singles]
}

export function RicaricaDialog({ workId, onClose, onSuccess }: RicaricaDialogProps) {
  const navigate = useNavigate()
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

  // Quando l'utente sceglie un sostituto per un gruppo mix, propagare a tutti i membri.
  // value è il mix_id (per sostituti mix) oppure "single:<id>" (per sostituti singoli senza mix).
  const handleMixScelta = (group: MixGroup, value: string) => {
    const newScelte: Record<number, number> = { ...scelte }
    const isSingle = value.startsWith('single:')
    const singleId = isSingle ? Number(value.slice(7)) : null

    for (const member of group.members) {
      let sostituto: any
      if (isSingle) {
        sostituto = member.sostituti.find((s: any) => s.id === singleId)
      } else {
        sostituto = member.sostituti.find((s: any) => s.mix_id === value)
        // Fallback: se il membro non ha sostituti con quel mix_id esatto (il backend
        // cerca per nome individuale e potrebbe non avere lo stesso mix_id), prendi il
        // primo sostituto con qualsiasi mix_id non nullo dello stesso batch
        if (!sostituto) {
          sostituto = member.sostituti.find((s: any) => s.mix_id != null)
        }
      }
      if (sostituto) {
        newScelte[member.source_id] = sostituto.id
      }
    }
    setScelte(newScelte)
  }

  // Ottieni il value attualmente selezionato per un gruppo (dal primo membro con scelta valida)
  const getMixSceltaAttuale = (group: MixGroup): string => {
    const opzioni = getMixOpzioni(group)
    const valoriValidi = new Set(opzioni.map(o => o.mix_id ?? `single:${o.id}`))
    for (const member of group.members) {
      const chosenId = scelte[member.source_id]
      if (chosenId != null) {
        const sostituto = member.sostituti.find((s: any) => s.id === chosenId)
        if (sostituto) {
          const val = sostituto.mix_id ? sostituto.mix_id : `single:${sostituto.id}`
          // Restituisce solo valori presenti nelle opzioni del dropdown, altrimenti
          // il <select> nativo con value non valido resetta visivamente al placeholder
          if (valoriValidi.has(val)) return val
        }
      }
    }
    return ''
  }

  // Opzioni lotto per un gruppo mix: mix_id distinti o singoli (con mix_id = null)
  const getMixOpzioni = (group: MixGroup): Array<{ mix_id: string | null; id?: number; lotto: string }> => {
    const firstAmbiguo = group.members.find(m => m.stato === 'ambiguo' || m.stato === 'auto')
    if (!firstAmbiguo) return []
    const seen = new Set<string>()
    const result: Array<{ mix_id: string | null; id?: number; lotto: string }> = []
    for (const s of firstAmbiguo.sostituti) {
      if (s.mix_id) {
        if (!seen.has(s.mix_id)) {
          seen.add(s.mix_id)
          result.push({ mix_id: s.mix_id, lotto: s.lotto ?? s.mix_id })
        }
      } else {
        // Sostituto singolo (senza mix): usa id come chiave univoca
        result.push({ mix_id: null, id: s.id, lotto: s.lotto ?? `#${s.id}` })
      }
    }
    return result
  }

  // Costruisce l'etichetta del gruppo: "Prep: {nome}" per ingredienti prep, altrimenti il nome CRM/mix
  const groupLabel = (g: MixGroup): string => {
    const rep = g.members[0]
    if (g.mix_id) return g.forma_commerciale ?? g.mix_id
    if (rep.source_type === 'prep') return `Prep: ${rep.nome ?? '—'}`
    return rep.nome ?? '—'
  }

  const groups = buildGroups(lotStatus)
  const groupsOk = groups.filter(g => g.stato === 'ok')
  const groupsAuto = groups.filter(g => g.stato === 'auto')
  const groupsAmbiguo = groups.filter(g => g.stato === 'ambiguo')
  const groupsMancante = groups.filter(g => g.stato === 'mancante')

  const daRisolvere = lotStatus.filter(i => i.stato !== 'ok')
  const haMancanti = daRisolvere.some(i => i.stato === 'mancante')
  // tuttiRisolti lavora a livello di gruppi per gestire correttamente i CRM mix:
  // un gruppo mix è risolto se getMixSceltaAttuale trova almeno un membro con scelta valida
  const tuttiRisolti = daRisolvere.length > 0 &&
    groups.filter(g => g.stato !== 'ok' && g.stato !== 'mancante').every(g => {
      if (g.stato === 'auto') return true
      if (g.stato === 'ambiguo') {
        if (g.mix_id) return getMixSceltaAttuale(g) !== ''
        return scelte[g.members[0].source_id] != null
      }
      return false
    })

  const renderMemberList = (group: MixGroup) => {
    if (!group.mix_id) return null
    return (
      <div style={{ marginTop: 4, paddingLeft: 10, borderLeft: '2px solid hsl(var(--border))' }}>
        {group.members.map(m => (
          <div key={m.source_id} style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', padding: '1px 0' }}>
            {m.nome}
          </div>
        ))}
      </div>
    )
  }

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff', borderRadius: 8, padding: 24,
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
            {groupsOk.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#16a34a', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Lotti OK ({lotStatus.filter(i => i.stato === 'ok').length})
                </div>
                {groupsOk.map(g => {
                  const rep = g.members[0]
                  const label = groupLabel(g)
                  const lotto = rep.lotto_corrente ?? '—'
                  return (
                    <div key={g.mix_id ?? rep.source_id} style={{
                      fontSize: 11, padding: '3px 8px', marginBottom: 2,
                      borderRadius: 4, background: '#f0fdf4',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 500 }}>{label}</span>
                        <span style={{ fontFamily: 'IBM Plex Mono, monospace', color: '#16a34a' }}>{lotto}</span>
                      </div>
                      {renderMemberList(g)}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Ingredienti automatici */}
            {groupsAuto.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#92400e', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Sostituzione automatica ({lotStatus.filter(i => i.stato === 'auto').length})
                </div>
                {groupsAuto.map(g => {
                  const rep = g.members[0]
                  const label = groupLabel(g)
                  const opzioni = getMixOpzioni(g)
                  const lottoNuovo = g.mix_id
                    ? (opzioni[0]?.lotto ?? '—')
                    : (rep.sostituti[0]?.lotto ?? '—')
                  return (
                    <div key={g.mix_id ?? rep.source_id} style={{
                      fontSize: 11, padding: '4px 8px', marginBottom: 2,
                      borderRadius: 4, background: '#fffbeb', border: '1px solid #fde68a',
                    }}>
                      <div style={{ fontWeight: 500 }}>{label}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, fontFamily: 'IBM Plex Mono, monospace', fontSize: 10 }}>
                        <span style={{ color: '#dc2626', textDecoration: 'line-through' }}>
                          {rep.lotto_usato ?? '—'}
                        </span>
                        <span style={{ color: 'hsl(var(--muted-foreground))' }}>→</span>
                        <span style={{ color: '#16a34a', fontWeight: 600 }}>{lottoNuovo}</span>
                      </div>
                      {renderMemberList(g)}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Ingredienti ambigui — scelta richiesta */}
            {groupsAmbiguo.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#b45309', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Scelta richiesta ({lotStatus.filter(i => i.stato === 'ambiguo').length})
                </div>
                {groupsAmbiguo.map(g => {
                  const rep = g.members[0]
                  const label = groupLabel(g)

                  if (g.mix_id) {
                    // Mix: un selettore per lotto mix
                    const opzioni = getMixOpzioni(g)
                    const sceltaAttuale = getMixSceltaAttuale(g)
                    return (
                      <div key={g.mix_id} style={{
                        fontSize: 11, padding: '6px 8px', marginBottom: 4,
                        borderRadius: 4, background: '#fff7ed', border: '1px solid #fed7aa',
                      }}>
                        <div style={{ fontWeight: 500, marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', fontFamily: 'IBM Plex Mono, monospace', marginBottom: 4 }}>
                          Lotto attuale ({rep.data_dismissione ? 'dismesso' : 'scaduto'}): {rep.lotto_usato ?? '—'}
                        </div>
                        {renderMemberList(g)}
                        <select
                          value={sceltaAttuale}
                          onChange={e => handleMixScelta(g, e.target.value)}
                          style={{
                            width: '100%', padding: '4px 6px', fontSize: 11, marginTop: 6,
                            border: '1px solid hsl(var(--border))', borderRadius: 4,
                            background: 'hsl(var(--background))', color: 'hsl(var(--foreground))',
                            fontFamily: 'IBM Plex Mono, monospace',
                          }}
                        >
                          <option value="">— Scegli un lotto —</option>
                          {opzioni.map(o => {
                            const val = o.mix_id ?? `single:${o.id}`
                            return <option key={val} value={val}>{o.lotto}</option>
                          })}
                        </select>
                      </div>
                    )
                  } else {
                    // Singolo: selettore per source_id come prima
                    return (
                      <div key={rep.source_id} style={{
                        fontSize: 11, padding: '6px 8px', marginBottom: 4,
                        borderRadius: 4, background: '#fff7ed', border: '1px solid #fed7aa',
                      }}>
                        <div style={{ fontWeight: 500, marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', fontFamily: 'IBM Plex Mono, monospace', marginBottom: 4 }}>
                          Lotto attuale ({rep.data_dismissione ? 'dismesso' : 'scaduto'}): {rep.lotto_usato ?? '—'}
                        </div>
                        <select
                          value={scelte[rep.source_id] ?? ''}
                          onChange={e => setScelte(prev => ({ ...prev, [rep.source_id]: Number(e.target.value) }))}
                          style={{
                            width: '100%', padding: '4px 6px', fontSize: 11,
                            border: '1px solid hsl(var(--border))', borderRadius: 4,
                            background: 'hsl(var(--background))', color: 'hsl(var(--foreground))',
                            fontFamily: 'IBM Plex Mono, monospace',
                          }}
                        >
                          <option value="">— Scegli un lotto —</option>
                          {rep.sostituti.map((s: any) => (
                            <option key={s.id} value={s.id}>
                              {s.lotto ?? 'Lotto n/d'}{s.concentrazione != null ? ` · ${s.concentrazione} ${s.unita_conc}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )
                  }
                })}
              </div>
            )}

            {/* Ingredienti mancanti — nessun sostituto */}
            {groupsMancante.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#dc2626', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Nessun lotto attivo trovato ({lotStatus.filter(i => i.stato === 'mancante').length})
                </div>
                {groupsMancante.map(g => {
                  const rep = g.members[0]
                  const label = groupLabel(g)
                  return (
                    <div key={g.mix_id ?? rep.source_id} style={{
                      fontSize: 11, padding: '6px 8px', marginBottom: 4,
                      borderRadius: 4, background: '#fef2f2', border: '1px solid #fca5a5',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontWeight: 500 }}>{label}</span>
                        <button
                          onClick={() => { onClose(); navigate('/composti', { state: { searchFilter: rep.nome, mostraDismessi: true } }) }}
                          style={{
                            fontSize: 10, padding: '2px 8px', borderRadius: 4,
                            border: '1px solid #fca5a5', background: '#fff',
                            color: '#dc2626', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                          }}
                        >
                          Vai al DB Composti →
                        </button>
                      </div>
                      <div style={{ fontSize: 10, color: '#dc2626', marginTop: 3 }}>
                        Nessun lotto attivo nel DB. Aggiungere un nuovo lotto nel DB Composti, poi riaprire questo dialog.
                      </div>
                      {renderMemberList(g)}
                    </div>
                  )
                })}
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
    </div>,
    document.body
  )
}
