# Piano di Sviluppo — FEAT-G: Fiale nei Mix e sincronizzazione per lotto
**Data:** 2026-03-10  
**Stato DB:** user_version 7  
**Branch base:** master

---

## Decisioni di progettazione

| Decisione | Scelta |
|-----------|--------|
| Campo N fiale nel form Mix | Propagato uguale a tutti i composti generati dal .txt |
| Modifica fiale su un composto | Sincronizzazione automatica a tutti i composti con stesso `lotto` |
| Apertura fiala in un composto con lotto | Crea evento `apertura_fiala` per tutti i composti con stesso `lotto` |
| Avviso nel dialog apertura | Sì — compare solo se il lotto è condiviso con più di 1 composto |
| Pallini visibili | Solo se `parseInt(fiala) > 1` — campo vuoto o = 1: nessun pallino |

> ℹ️ Nessuna migration DB necessaria. Il campo `fiala` esiste già su `composti`. La sincronizzazione avviene tramite `UPDATE ... WHERE lotto = ?`.

---

## Panoramica Task

| Task | File modificati | Branch |
|------|-----------------|--------|
| G-1 — N fiale nel form Mix | `MixPesticidiForm.tsx`, `composti.ipc.ts` | `feat/mix-fiale-field` |
| G-2 — Sync fiale per lotto (backend) | `composti.ipc.ts` | `feat/fiale-sync-lotto` |
| G-3 — Campo fiale form edit (verifica) | `CompostoForm.tsx` | `feat/fiale-sync-lotto` (stesso branch di G-2) |
| G-4 — Apertura fiala condivisa per lotto | `composti.ipc.ts`, `ApriAperturaDialog.tsx`, `CompostiTable.tsx` | `feat/apertura-fiala-lotto` |
| G-5 — Nuovi composti in coda | `composti.ipc.ts` | `fix/composti-insert-order` |
| G-6 — Reset sort al terzo click | `DataTable.tsx` | `fix/sort-reset` |

---

## TASK G-1 — Campo N fiale nel form Mix

### Branch
```bash
git checkout master
```

### File 1 di 2: `src/renderer/pages/composti/MixPesticidiForm.tsx`

**Modifica A — aggiungere `fiale` allo stato iniziale**

Trova il blocco `useState` all'inizio del componente. Attualmente è:
```ts
const [form, setForm] = useState({
  forma_commerciale: '',
  concentrazione: '',
  unita_conc: UNITA_DEFAULT,
  solvente: '',
  produttore: '',
  lotto: '',
  data_apertura: '',
  scadenza_prodotto: '',
  classe: '',
  destinazione_uso: '',
  stoccaggio: '',
  accreditamento_crm: 'ISO 17034',
  codice_interno: '',
})
```

Aggiungere `fiale: ''` come ultima riga prima della parentesi di chiusura:
```ts
const [form, setForm] = useState({
  forma_commerciale: '',
  concentrazione: '',
  unita_conc: UNITA_DEFAULT,
  solvente: '',
  produttore: '',
  lotto: '',
  data_apertura: '',
  scadenza_prodotto: '',
  classe: '',
  destinazione_uso: '',
  stoccaggio: '',
  accreditamento_crm: 'ISO 17034',
  codice_interno: '',
  fiale: '1',           // ← aggiungere questa riga
})
```

---

**Modifica B — aggiungere `fiale: ''` alla funzione `reset()`**

Trova la funzione `reset()`. Attualmente è:
```ts
const reset = () => {
  setForm({
    forma_commerciale: '', concentrazione: '', unita_conc: UNITA_DEFAULT,
    solvente: '', produttore: '', lotto: '', data_apertura: '',
    scadenza_prodotto: '', classe: '', destinazione_uso: '',
    stoccaggio: '', accreditamento_crm: 'ISO 17034',
    codice_interno: '',
  })
  setNomi([])
  if (fileRef.current) fileRef.current.value = ''
}
```

Aggiungere `fiale: ''` nell'oggetto passato a `setForm`:
```ts
const reset = () => {
  setForm({
    forma_commerciale: '', concentrazione: '', unita_conc: UNITA_DEFAULT,
    solvente: '', produttore: '', lotto: '', data_apertura: '',
    scadenza_prodotto: '', classe: '', destinazione_uso: '',
    stoccaggio: '', accreditamento_crm: 'ISO 17034',
    codice_interno: '',
    fiale: '1',           // ← aggiungere questa riga
  })
  setNomi([])
  if (fileRef.current) fileRef.current.value = ''
}
```

---

**Modifica C — aggiungere il campo nel JSX**

Trova nel JSX il blocco del campo "Codice Interno":
```tsx
<div className="col-span-2">
  <Label className="text-xs">Codice Interno</Label>
  <Input value={form.codice_interno} onChange={e => set('codice_interno', e.target.value)} placeholder="es. MIX-001" />
</div>
```

Aggiungere immediatamente dopo quel `</div>`:
```tsx
<div>
  <Label className="text-xs">N fiale</Label>
  <Input
    type="number"
    min="1"
    value={form.fiale}
    onChange={e => set('fiale', e.target.value)}
    placeholder="es. 4"
  />
</div>
```

---

**Modifica D — includere `fiala` nel payload di `handleSave`**

Trova la funzione `handleSave`. Il blocco `const data = { ... }` attualmente è:
```ts
const data = {
  ...form,
  forma: 'mix',
  concentrazione: form.concentrazione ? parseFloat(form.concentrazione) : null,
  unita_conc: form.unita_conc || UNITA_DEFAULT,
  nomi,
}
```

Aggiungere la riga `fiala` prima di `nomi` (nota: il campo nel DB si chiama `fiala`, il campo del form si chiama `fiale`):
```ts
const data = {
  ...form,
  forma: 'mix',
  concentrazione: form.concentrazione ? parseFloat(form.concentrazione) : null,
  unita_conc: form.unita_conc || UNITA_DEFAULT,
  fiala: form.fiale ? String(parseInt(form.fiale)) : null,   // ← aggiungere questa riga
  nomi,
}
```

---

### File 2 di 2: `src/main/ipc/composti.ipc.ts`

**Modifica A — aggiungere `fiala` al tipo del payload di `composti:create-mix`**

Trova la dichiarazione del tipo del handler `composti:create-mix`. Attualmente è:
```ts
ipcMain.handle('composti:create-mix', (_, data: {
  forma_commerciale: string
  forma: string
  concentrazione: number | null
  unita_conc?: string
  solvente: string | null
  produttore: string | null
  lotto: string | null
  data_apertura: string | null
  scadenza_prodotto: string | null
  classe: string | null
  destinazione_uso: string | null
  nomi: string[]
}) => {
```

Aggiungere `fiala?: string | null` prima della riga `nomi: string[]`:
```ts
ipcMain.handle('composti:create-mix', (_, data: {
  forma_commerciale: string
  forma: string
  concentrazione: number | null
  unita_conc?: string
  solvente: string | null
  produttore: string | null
  lotto: string | null
  data_apertura: string | null
  scadenza_prodotto: string | null
  classe: string | null
  destinazione_uso: string | null
  fiala?: string | null    // ← aggiungere questa riga
  nomi: string[]
}) => {
```

**Modifica B — usare `data.fiala` nell'oggetto `common`**

Più in basso nello stesso handler, trova l'oggetto `common`. La riga che riguarda `fiala` attualmente è:
```ts
      fiala: null,
```

Sostituirla con:
```ts
      fiala: data.fiala ?? null,
```

### Verifica
- Creare una Mix con N fiale = 4 → aprire il pannello di ogni composto generato e verificare che il campo fiala mostri "4"
- La colonna Nome nella tabella mostra i pallini per quei composti
- Creare una Mix senza compilare N fiale → campo fiala null, nessun pallino

### Commit
```bash
git add src/renderer/pages/composti/MixPesticidiForm.tsx
git add src/main/ipc/composti.ipc.ts
git commit -m "feat(mix): aggiungi campo N fiale al form Mix"
```

---

## TASK G-2 — Sincronizzazione fiale per lotto (backend)

### Branch
```bash
git checkout master
```

### File: `src/main/ipc/composti.ipc.ts`

L'handler `composti:update` esegue l'aggiornamento dentro una transazione. Trova il blocco:
```ts
    db.transaction(() => {
      updateComposto.run(row)
      deleteLinks.run(id)
      for (const mid of metodiIds) {
        insertLink.run(id, mid)
      }
    })()
```

Aggiungere la sincronizzazione fiale **dentro la transazione**, subito dopo `updateComposto.run(row)`:
```ts
    db.transaction(() => {
      updateComposto.run(row)

      // sincronizzazione fiale per lotto
      if (row.fiala !== undefined && row.fiala !== null && row.lotto) {
        db.prepare('UPDATE composti SET fiala = ? WHERE lotto = ? AND id != ?')
          .run(row.fiala, row.lotto, id)
      }

      deleteLinks.run(id)
      for (const mid of metodiIds) {
        insertLink.run(id, mid)
      }
    })()
```

> ℹ️ `row` è l'oggetto già costruito sopra con tutti i campi del composto, inclusi `fiala` e `lotto`. Non serve una SELECT separata.
> ⚠️ Se `row.lotto` è null o stringa vuota la condizione è falsy e la sincronizzazione non parte.

### Verifica
- Modificare il campo N fiale di un composto che ha lotto valorizzato → tutti i composti con lo stesso lotto aggiornano il campo fiala
- Modificare il campo N fiale di un composto senza lotto → solo quel composto cambia

### Commit
```bash
git add src/main/ipc/composti.ipc.ts
git commit -m "feat(fiale): sincronizzazione automatica numero fiale per lotto"
```

---

## TASK G-3 — Campo fiale nel form edit composto (verifica)

### File: `src/renderer/pages/composti/CompostoForm.tsx`

Aprire il file e cercare la stringa `fiala`. Esistono due casi possibili:

**Caso A — il campo esiste già nel form:** verificare che nel payload passato a `composti:update` sia presente:
```ts
fiala: form.fiala ?? null,
```
Se c'è, non serve fare nient'altro.

**Caso B — il campo non esiste nel form:** trovare il campo Concentrazione nel JSX e aggiungere subito dopo:
```tsx
<div>
  <Label className="text-xs">N fiale</Label>
  <Input
    type="number"
    min="1"
    value={form.fiala ?? ''}
    onChange={e => setForm(f => ({ ...f, fiala: e.target.value }))}
    placeholder="es. 4"
  />
</div>
```
E nel payload dell'update aggiungere:
```ts
fiala: form.fiala || null,
```

> ℹ️ In questo form non aggiungere pallini. I pallini sono solo nella tabella (`CompostiTable.tsx`).

### Verifica
- Modificare N fiale dal pannello laterale → valore salvato correttamente
- I pallini nella tabella si aggiornano al refresh
- Se il composto ha lotto, gli altri composti con stesso lotto si aggiornano (verifica G-2)

### Commit
```bash
git add src/renderer/pages/composti/CompostoForm.tsx
git commit -m "feat(fiale): campo fiale nel form edit composto"
```

---

## TASK G-4 — Apertura fiala condivisa per lotto

### Branch
```bash
git checkout master
```

### File 1 di 3: `src/main/ipc/composti.ipc.ts`

Trovare l'handler `composti:apri-fiala`. Attualmente è:
```ts
  ipcMain.handle('composti:apri-fiala', (_, compostoId: number, data: {
   fiala_numero: number
   data_apertura: string
   operatore?: string
   note?: string
   }) => {
     const result = getDb().prepare(
     `INSERT INTO composti_storia (composto_id, tipo, data, fiala_numero, note)
     VALUES (?, 'apertura_fiala', ?, ?, ?)`
    ).run(
    compostoId,
    data.data_apertura,
    data.fiala_numero,
    data.note || null
     )
    return { id: result.lastInsertRowid }
  })
```

Sostituire **l'intero handler** con:
```ts
  ipcMain.handle('composti:apri-fiala', (_, compostoId: number, data: {
    fiala_numero: number
    data_apertura: string
    operatore?: string
    note?: string
  }) => {
    const db = getDb()
    const comp = db.prepare('SELECT lotto FROM composti WHERE id = ?').get(compostoId) as any

    if (comp?.lotto) {
      const siblings = db.prepare('SELECT id FROM composti WHERE lotto = ?').all(comp.lotto) as any[]
      const stmt = db.prepare(
        `INSERT INTO composti_storia (composto_id, tipo, data, fiala_numero, note)
         VALUES (?, 'apertura_fiala', ?, ?, ?)`
      )
      db.transaction(() => {
        for (const s of siblings) {
          stmt.run(s.id, data.data_apertura, data.fiala_numero, data.note || null)
        }
      })()
      return { count: siblings.length }
    } else {
      const result = db.prepare(
        `INSERT INTO composti_storia (composto_id, tipo, data, fiala_numero, note)
         VALUES (?, 'apertura_fiala', ?, ?, ?)`
      ).run(compostoId, data.data_apertura, data.fiala_numero, data.note || null)
      return { id: result.lastInsertRowid }
    }
  })
```

---

### File 2 di 3: `src/renderer/pages/composti/ApriAperturaDialog.tsx`

Aprire il file e trovare la definizione delle props del componente (l'interfaccia o il tipo delle props). Aggiungere le due nuove prop opzionali `compostoLotto` e `conteggioLotto`.

Nel JSX, trovare il pulsante "Salva" nel footer del dialog. Aggiungere immediatamente **prima** del pulsante:
```tsx
{conteggioLotto && conteggioLotto > 1 && (
  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded mb-2">
    ⚠ Questa apertura verrà registrata per tutti i {conteggioLotto} composti
    con lotto &quot;{compostoLotto}&quot;.
  </p>
)}
```

---

### File 3 di 3: `src/renderer/pages/composti/CompostiTable.tsx`

**Modifica A — aggiungere `lotto` allo stato `apriTarget`**

Trovare:
```ts
  const [apriTarget, setApriTarget] = useState<{ compostoId: number; fialaNumero: number; nome: string } | null>(null)
```
Sostituire con:
```ts
  const [apriTarget, setApriTarget] = useState<{ compostoId: number; fialaNumero: number; nome: string; lotto: string | null } | null>(null)
```

**Modifica B — aggiungere `lotto` nella chiamata `setApriTarget`**

Trovare nella colonna Nome la chiamata:
```ts
onApri={(fialaNumero) => setApriTarget({ compostoId: row.id, fialaNumero, nome: row.nome })}
```
Sostituire con:
```ts
onApri={(fialaNumero) => setApriTarget({ compostoId: row.id, fialaNumero, nome: row.nome, lotto: row.lotto ?? null })}
```

**Modifica C — passare le nuove prop ad `ApriAperturaDialog`**

Trovare il blocco `<ApriAperturaDialog ...>`. Attualmente è:
```tsx
      <ApriAperturaDialog
        open={!!apriTarget}
        onOpenChange={(v) => { if (!v) setApriTarget(null) }}
        compostoId={apriTarget?.compostoId ?? null}
        compostoNome={apriTarget?.nome}
        fialaNumero={apriTarget?.fialaNumero ?? 1}
        onSaved={() => { setApriTarget(null); onRefresh() }}
      />
```
Sostituire con:
```tsx
      <ApriAperturaDialog
        open={!!apriTarget}
        onOpenChange={(v) => { if (!v) setApriTarget(null) }}
        compostoId={apriTarget?.compostoId ?? null}
        compostoNome={apriTarget?.nome}
        fialaNumero={apriTarget?.fialaNumero ?? 1}
        compostoLotto={apriTarget?.lotto}
        conteggioLotto={apriTarget?.lotto ? data.filter(c => c.lotto === apriTarget.lotto).length : 0}
        onSaved={() => { setApriTarget(null); onRefresh() }}
      />
```

### Verifica
- Aprire una fiala su un composto senza lotto → nessun avviso, solo quel composto registra l'evento nel tab Storico
- Aprire una fiala su un composto con lotto condiviso → avviso ambra con numero corretto di composti
- Controllare il tab Storico nel pannello di ciascun composto del lotto → tutti mostrano l'apertura

### Commit
```bash
git add src/main/ipc/composti.ipc.ts
git add src/renderer/pages/composti/ApriAperturaDialog.tsx
git add src/renderer/pages/composti/CompostiTable.tsx
git commit -m "feat(fiale): apertura fiala condivisa per lotto con avviso"
```

---

## TASK G-5 — Nuovi composti inseriti in coda

### Branch
```bash
git checkout master
```

### File: `src/main/ipc/composti.ipc.ts`

Trovare la riga finale della query nell'handler `composti:list`. Attualmente è:
```ts
    sql += ' GROUP BY c.id ORDER BY c.nome'
```

Sostituire con:
```ts
    sql += ' GROUP BY c.id ORDER BY c.id ASC'
```

> ℹ️ L'ordinamento per click su colonna nell'UI continua a funzionare — è gestito da `DataTable.tsx` lato frontend e sovrascrive questo ordine.

### Verifica
- Inserire un nuovo composto → appare in fondo alla tabella
- Creare una Mix → i composti generati appaiono in fondo
- Ricaricare la pagina → l'ordine rimane invariato

### Commit
```bash
git add src/main/ipc/composti.ipc.ts
git commit -m "fix(composti): nuovi record inseriti in coda (ORDER BY id ASC)"
```

---

## TASK G-6 — Reset ordinamento colonna al terzo click

### Branch
```bash
git checkout master
git checkout -b fix/sort-reset
```

### File: `src/renderer/components/shared/DataTable.tsx`

> ⚠️ La logica del sort è in `DataTable.tsx` (componente condiviso), **non** in `CompostiTable.tsx`.

Trovare la funzione `handleSort`. Attualmente è:
```ts
  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }
```

Sostituire con:
```ts
  const handleSort = (key: string) => {
    if (sortKey !== key) {
      setSortKey(key)       // primo click su nuova colonna: ASC
      setSortDir('asc')
    } else if (sortDir === 'asc') {
      setSortDir('desc')    // secondo click: DESC
    } else {
      setSortKey(null)      // terzo click: reset
    }
  }
```

Il resto del componente non va modificato: quando `sortKey === null`, il `useMemo` già restituisce `data` invariato (`if (!sortKey) return data`), che corrisponde all'ordine `id ASC` del backend.

### Verifica
- Click su colonna Nome → ordine A→Z, icona `ChevronUp` visibile nell'header
- Secondo click → ordine Z→A, icona `ChevronDown`
- Terzo click → nessuna icona attiva, ordine torna a quello di inserimento (id ASC)

### Commit
```bash
git add src/renderer/components/shared/DataTable.tsx
git commit -m "fix(tabella): terzo click su colonna resetta ordinamento"
```

---

## Riepilogo e ordine consigliato

| Task | Dipende da | Branch | Stato |
|------|-----------|--------|-------|
| G-1 — N fiale form Mix | — | `feat/mix-fiale-field` | ⏳ |
| G-2 + G-3 — Sync fiale per lotto | — | `feat/fiale-sync-lotto` | ⏳ |
| G-4 — Apertura fiala per lotto | G-1 e G-2 per test completo | `feat/apertura-fiala-lotto` | ⏳ |
| G-5 — Insert in coda | — | `fix/composti-insert-order` | ⏳ |
| G-6 — Reset sort | G-5 per comportamento coerente | `fix/sort-reset` | ⏳ |

> ℹ️ G-1, G-2/G-3, G-5 sono indipendenti. G-6 ha senso testarlo dopo G-5. G-4 può partire subito ma per verificare lo scenario Mix + apertura condivisa è meglio che G-1 e G-2 siano già funzionanti.