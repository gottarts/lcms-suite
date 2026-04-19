import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { X, CheckSquare, Upload } from 'lucide-react'
import { metodoAnalitiApi, compostiApi, metodiApi } from '@/lib/api'
import { AliasImportDialog } from './AliasImportDialog'

interface Analita {
  id: number
  nome: string
  ordine: number | null
  accreditato: number
  alias_strumento: string | null
  alias_lims: string | null
  alias_oqlab: string | null
}

type AliasField = 'alias_strumento' | 'alias_lims' | 'alias_oqlab'

interface ParametriMetodoPageProps {
  metodoId: string
  metodoNome: string
  onClose: () => void
}

export function ParametriMetodoPage({ metodoId, metodoNome, onClose }: ParametriMetodoPageProps) {
  const [analiti, setAnaliti] = useState<Analita[]>([])
  const [sel, setSel] = useState<Set<number>>(new Set())
  const [addInput, setAddInput] = useState('')
  const [addSugg, setAddSugg] = useState<string[]>([])
  const [allNomiDb, setAllNomiDb] = useState<string[]>([])
  // alias editing: field -> id -> valore corrente
  const [aliasEdit, setAliasEdit] = useState<Record<AliasField, Record<number, string>>>({
    alias_strumento: {},
    alias_lims: {},
    alias_oqlab: {},
  })
  const [showImport, setShowImport] = useState(false)

  const load = useCallback(async () => {
    const rows = await metodoAnalitiApi.list(metodoId)
    setAnaliti(rows.sort((a, b) => a.nome.localeCompare(b.nome)))
    setSel(new Set())
  }, [metodoId])

  const loadNomiDb = useCallback(async () => {
    const rows: any[] = await compostiApi.list({})
    const nomiUnici = Array.from(new Set(rows.map((r: any) => r.nome as string).filter(Boolean))).sort()
    setAllNomiDb(nomiUnici)
  }, [])

  useEffect(() => {
    load()
    loadNomiDb()
  }, [load, loadNomiDb])

  const handleAddInputChange = (val: string) => {
    setAddInput(val)
    if (val.trim().length < 2) { setAddSugg([]); return }
    const esistenti = new Set(analiti.map(a => a.nome.toLowerCase()))
    const sugg = allNomiDb
      .filter(n => n.toLowerCase().includes(val.toLowerCase()) && !esistenti.has(n.toLowerCase()))
      .slice(0, 8)
    setAddSugg(sugg)
  }

  const handleAdd = async (nome: string) => {
    const trimmed = nome.trim()
    if (!trimmed) return
    if (analiti.some(a => a.nome.toLowerCase() === trimmed.toLowerCase())) return
    await metodoAnalitiApi.add(metodoId, [trimmed])
    await metodiApi.get(metodoId)
    setAddInput('')
    setAddSugg([])
    await load()
  }

  const handleRimuoviSelezionati = async () => {
    if (sel.size === 0) return
    const nomi = analiti.filter(a => sel.has(a.id)).map(a => a.nome)
    await metodoAnalitiApi.remove(metodoId, nomi)
    await load()
  }

  const toggleSel = (id: number) => {
    setSel(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (sel.size === analiti.length) setSel(new Set())
    else setSel(new Set(analiti.map(a => a.id)))
  }

  const handleAccreditatoChange = async (analita: Analita, checked: boolean) => {
    setAnaliti(prev => prev.map(a => a.id === analita.id ? { ...a, accreditato: checked ? 1 : 0 } : a))
    await metodoAnalitiApi.update(analita.id, { accreditato: checked ? 1 : 0 })
  }

  const handleAccreditaTutti = async () => {
    setAnaliti(prev => prev.map(a => ({ ...a, accreditato: 1 })))
    await metodoAnalitiApi.bulkSetAccreditato(metodoId, 'all', 1)
  }

  const handleAliasChange = (field: AliasField, id: number, val: string) => {
    setAliasEdit(prev => ({
      ...prev,
      [field]: { ...prev[field], [id]: val },
    }))
  }

  const handleAliasBlur = async (analita: Analita, field: AliasField) => {
    const val = aliasEdit[field][analita.id] ?? analita[field] ?? ''
    const newVal = val.trim() || null
    if (newVal === (analita[field] || null)) return
    setAnaliti(prev => prev.map(a => a.id === analita.id ? { ...a, [field]: newVal } : a))
    await metodoAnalitiApi.update(analita.id, { [field]: newVal })
    setAliasEdit(prev => {
      const next = { ...prev, [field]: { ...prev[field] } }
      delete next[field][analita.id]
      return next
    })
  }

  const aliasColumns: { field: AliasField; label: string }[] = [
    { field: 'alias_strumento', label: 'Alias strumento' },
    { field: 'alias_lims', label: 'Alias LIMS' },
    { field: 'alias_oqlab', label: 'Alias OQLab' },
  ]

  return (
    <div className="flex flex-col bg-background" style={{ margin: -16, marginTop: -60, height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div className="flex items-center gap-3 flex-shrink-0" style={{ padding: '12px 24px', boxShadow: '0 1px 0 rgba(0,0,0,0.06)' }}>
        <Button size="sm" variant="ghost" onClick={onClose} className="gap-1">
          ← Torna a Metodi
        </Button>
        <div className="h-4 w-px bg-border" />
        <h2 className="font-heading text-lg font-semibold">Parametri analitici</h2>
        <span className="text-sm text-muted-foreground bg-muted rounded-full px-3 py-0.5 font-mono">{metodoNome}</span>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap flex-shrink-0" style={{ padding: '12px 24px 0' }}>
        <div className="relative flex-1 max-w-sm">
          <Input
            placeholder="Nome parametro (dal catalogo o libero)"
            value={addInput}
            onChange={e => handleAddInputChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); handleAdd(addInput) }
              if (e.key === 'Escape') { setAddInput(''); setAddSugg([]) }
            }}
            className="text-xs h-8"
          />
          {addSugg.length > 0 && (
            <div className="absolute z-50 left-0 right-0 mt-1 bg-background border rounded-md shadow-lg max-h-40 overflow-y-auto">
              {addSugg.map(n => (
                <div
                  key={n}
                  className="px-3 py-1.5 text-xs font-mono cursor-pointer hover:bg-muted"
                  onClick={() => handleAdd(n)}
                >
                  {n}
                </div>
              ))}
            </div>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          disabled={!addInput.trim()}
          onClick={() => handleAdd(addInput)}
        >
          Aggiungi
        </Button>

        <div className="h-4 w-px bg-border mx-1" />

        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1"
          onClick={handleAccreditaTutti}
          disabled={analiti.length === 0}
          title="Marca tutti i parametri come accreditati"
        >
          <CheckSquare className="h-3.5 w-3.5" />
          Accredita tutti
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1"
          onClick={() => setShowImport(true)}
          disabled={analiti.length === 0}
          title="Importa alias da file LIMS/OQLab con mappatura automatica"
        >
          <Upload className="h-3.5 w-3.5" />
          Importa alias…
        </Button>

        {sel.size > 0 && (
          <Button
            size="sm"
            variant="destructive"
            className="h-8 text-xs ml-auto gap-1"
            onClick={handleRimuoviSelezionati}
          >
            <X className="h-3.5 w-3.5" />
            Rimuovi selezionati ({sel.size})
          </Button>
        )}
      </div>

      {/* Tabella */}
      <div className="flex-1 min-h-0 flex flex-col" style={{ padding: '12px 24px 12px' }}>
      <div className="border rounded-md overflow-auto flex-1">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 sticky top-0">
            <tr>
              <th className="w-8 px-3 py-2 text-left">
                <input
                  type="checkbox"
                  checked={analiti.length > 0 && sel.size === analiti.length}
                  ref={el => { if (el) el.indeterminate = sel.size > 0 && sel.size < analiti.length }}
                  onChange={toggleAll}
                  className="accent-primary"
                />
              </th>
              <th className="px-3 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wider">Nome</th>
              <th className="w-28 px-3 py-2 text-center font-semibold text-muted-foreground uppercase tracking-wider">Accreditato</th>
              {aliasColumns.map(col => (
                <th key={col.field} className="w-44 px-3 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wider">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {analiti.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-muted-foreground italic">
                  Nessun parametro — aggiungili dal catalogo o manualmente
                </td>
              </tr>
            )}
            {analiti.map(a => (
              <tr key={a.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={sel.has(a.id)}
                    onChange={() => toggleSel(a.id)}
                    className="accent-destructive"
                  />
                </td>
                <td className="px-3 py-2 font-mono">{a.nome}</td>
                <td className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={!!a.accreditato}
                    onChange={e => handleAccreditatoChange(a, e.target.checked)}
                    className="accent-primary h-4 w-4"
                  />
                </td>
                {aliasColumns.map(col => (
                  <td key={col.field} className="px-3 py-2">
                    <Input
                      value={aliasEdit[col.field][a.id] ?? a[col.field] ?? ''}
                      onChange={e => handleAliasChange(col.field, a.id, e.target.value)}
                      onBlur={() => handleAliasBlur(a, col.field)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                        if (e.key === 'Escape') {
                          setAliasEdit(prev => {
                            const next = { ...prev, [col.field]: { ...prev[col.field] } }
                            delete next[col.field][a.id]
                            return next
                          })
                          ;(e.target as HTMLInputElement).blur()
                        }
                      }}
                      placeholder="—"
                      className="h-7 text-xs"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground mt-2 flex-shrink-0">
        Le modifiche sono immediate. Un parametro aggiunto manualmente apparirà grigio nello schema finché non viene associato un CRM.
      </p>
      </div>

      {showImport && (
        <AliasImportDialog
          open={showImport}
          metodoId={metodoId}
          analiti={analiti.map(a => a.nome)}
          onClose={() => setShowImport(false)}
          onSaved={() => { setShowImport(false); load() }}
        />
      )}
    </div>
  )
}
