# Feature Plan — Preparazioni: Ubicazione, Stoccaggio, Autocomplete

**Data:** 2026-03-18  
**Branch:** `master`  
**Modulo:** Composti → PreparazioniTab  
**DB user_version attuale:** 10 → diventerà **11**

---

## Obiettivo

1. **Sostituire il campo `posizione`** nel form Preparazioni con due campi separati: `ubicazione` e `stoccaggio`, con autocompilazione da anagrafica.
2. **Aggiungere `AutocompleteInput`** ai campi `solvente` e `operatore` nel form Preparazioni, con suggerimenti caricati dall'anagrafica (stesso pattern di `CompostoForm`).

---

## Decisioni prese

| Domanda | Risposta |
|---------|----------|
| `posizione` → sostituire o affiancare? | **Sostituire** con `ubicazione` + `stoccaggio` |
| Sorgente suggerimenti autocomplete | **Solo anagrafica** (come in `CompostoForm`) |

---

## Analisi stato attuale

- `preparazioni` ha il campo `posizione TEXT` introdotto in migration 002 — rimane nel DB ma non sarà più usato dall'app (SQLite non supporta DROP COLUMN in versioni precedenti).
- Il form `PreparazioniTab.tsx` usa `<Input>` plain per `solvente`, `operatore`, `posizione`.
- `AutocompleteInput` esiste già in `src/renderer/components/shared/AutocompleteInput.tsx`.
- `CompostoForm.tsx` ha la logica di caricamento anagrafica da seguire come modello.
- `db.ts` applica migration automaticamente dal prefisso numerico del filename — **non serve modificare `db.ts`**.

---

## File da modificare

| # | File | Operazione | Descrizione |
|---|------|------------|-------------|
| 1 | `src/main/migrations/011-preparazioni-ubicazione-stoccaggio.sql` | ✨ Crea | Aggiunge `ubicazione` e `stoccaggio` alla tabella `preparazioni` |
| 2 | `src/main/ipc/preparazioni.ipc.ts` | 🔧 Modifica | Sostituisce `posizione` con `ubicazione` + `stoccaggio` in CREATE e UPDATE |
| 3 | `src/renderer/pages/composti/PreparazioniTab.tsx` | 🔧 Modifica | Sostituisce `posizione` con i due nuovi campi + `AutocompleteInput` per solvente e operatore |

---

## TASK 1 — Migration DB

### File da creare: `src/main/migrations/011-preparazioni-ubicazione-stoccaggio.sql`

```sql
ALTER TABLE preparazioni ADD COLUMN ubicazione TEXT;
ALTER TABLE preparazioni ADD COLUMN stoccaggio TEXT;
```

> `posizione` rimane nel DB ma non viene più letta né scritta dall'app. I dati esistenti non si perdono.

### Commit
```bash
git add src/main/migrations/011-preparazioni-ubicazione-stoccaggio.sql
git commit -m "feat(db): migration 011 — preparazioni ubicazione + stoccaggio"
```

---

## TASK 2 — Backend IPC (`preparazioni.ipc.ts`)

### 2a — Handler `preparazioni:create`

**Nell'oggetto `row`**, trovare:
```ts
      posizione: data.posizione ?? null,
```
Sostituire con:
```ts
      ubicazione: data.ubicazione ?? null,
      stoccaggio: data.stoccaggio ?? null,
```

**Nella query INSERT**, trovare nelle colonne:
```
data_prep, scadenza, operatore, posizione, note,
```
Sostituire con:
```
data_prep, scadenza, operatore, ubicazione, stoccaggio, note,
```

**Nella parte VALUES**, trovare:
```
@data_prep, @scadenza, @operatore, @posizione, @note,
```
Sostituire con:
```
@data_prep, @scadenza, @operatore, @ubicazione, @stoccaggio, @note,
```

---

### 2b — Handler `preparazioni:update`

**Nell'oggetto `row`**, trovare:
```ts
      posizione: data.posizione ?? null,
```
Sostituire con:
```ts
      ubicazione: data.ubicazione ?? null,
      stoccaggio: data.stoccaggio ?? null,
```

**Nella query UPDATE**, trovare:
```
operatore=@operatore, posizione=@posizione, note=@note,
```
Sostituire con:
```
operatore=@operatore, ubicazione=@ubicazione, stoccaggio=@stoccaggio, note=@note,
```

### Commit
```bash
git add src/main/ipc/preparazioni.ipc.ts
git commit -m "feat(ipc): preparazioni — ubicazione + stoccaggio in create/update"
```

---

## TASK 3 — Frontend (`PreparazioniTab.tsx`)

### 3a — Import: aggiungere `AutocompleteInput`

Trovare la riga degli import dei componenti shared (quella con `Label`, `Input`, ecc.) e aggiungere:
```tsx
import { AutocompleteInput } from '@/components/shared/AutocompleteInput'
```

---

### 3b — Stato: aggiungere suggerimenti anagrafica

Dopo le righe degli `useState` esistenti, aggiungere:
```tsx
const [suggestSolvente, setSuggestSolvente] = useState<string[]>([])
const [suggestOperatore, setSuggestOperatore] = useState<string[]>([])
const [suggestUbicazione, setSuggestUbicazione] = useState<string[]>([])
const [suggestStoccaggio, setSuggestStoccaggio] = useState<string[]>([])
```

---

### 3c — useEffect: caricare i suggerimenti dall'anagrafica

Aggiungere un `useEffect` subito dopo quelli esistenti (modello da `CompostoForm.tsx`):
```tsx
useEffect(() => {
  window.electronAPI.invoke('anagrafiche:list').then((result: unknown) => {
    const anagrafiche = result as any[]
    const get = (nome: string) =>
      anagrafiche.find((a: any) =>
        a.nome.toLowerCase() === nome.toLowerCase()
      )?.voci?.map((v: any) => v.valore) ?? []

    setSuggestSolvente(get('solventi'))
    setSuggestOperatore(get('operatori'))
    setSuggestUbicazione(get('ubicazioni'))
    setSuggestStoccaggio(get('posizioni stoccaggio'))
  })
}, [])
```

> ℹ️ I nomi delle categorie anagrafica devono corrispondere a quelli creati nella pagina Anagrafiche dell'app. Sono case-insensitive.

---

### 3d — `EMPTY_FORM`: sostituire `posizione` con i due nuovi campi

Trovare nell'oggetto `EMPTY_FORM`:
```ts
  posizione: '',
```
Sostituire con:
```ts
  ubicazione: '',
  stoccaggio: '',
```

---

### 3e — `openEdit`: aggiornare il mapping

Trovare in `openEdit`:
```ts
      posizione: p.posizione || '',
```
Sostituire con:
```ts
      ubicazione: p.ubicazione || '',
      stoccaggio: p.stoccaggio || '',
```

---

### 3f — `handleSave`: aggiornare il payload

Trovare in `handleSave`:
```ts
      posizione: form.posizione || null,
```
Sostituire con:
```ts
      ubicazione: form.ubicazione || null,
      stoccaggio: form.stoccaggio || null,
```

---

### 3g — JSX del form: sostituire i campi

**Trovare il campo Solvente** (attualmente `<Input>`):
```tsx
<div><Label className="text-xs">Solvente</Label><Input value={form.solvente} onChange={e => setForm(f => ({ ...f, solvente: e.target.value }))} /></div>
```
Sostituire con:
```tsx
<div>
  <Label className="text-xs">Solvente</Label>
  <AutocompleteInput
    value={form.solvente}
    onChange={v => setForm(f => ({ ...f, solvente: v }))}
    suggestions={suggestSolvente}
    placeholder="es. MeOH"
  />
</div>
```

**Trovare il campo Operatore** (attualmente `<Input>`):
```tsx
<div><Label className="text-xs">Operatore</Label><Input value={form.operatore} onChange={e => setForm(f => ({ ...f, operatore: e.target.value }))} /></div>
```
Sostituire con:
```tsx
<div>
  <Label className="text-xs">Operatore</Label>
  <AutocompleteInput
    value={form.operatore}
    onChange={v => setForm(f => ({ ...f, operatore: v }))}
    suggestions={suggestOperatore}
    placeholder="es. Mario Rossi"
  />
</div>
```

**Trovare il campo Posizione** (attualmente `<Input>`, inizia con `<div><Label className="text-xs">Posizione</Label>`):

Sostituire l'intero blocco con:
```tsx
<div>
  <Label className="text-xs">Ubicazione</Label>
  <AutocompleteInput
    value={form.ubicazione}
    onChange={v => setForm(f => ({ ...f, ubicazione: v }))}
    suggestions={suggestUbicazione}
    placeholder="es. Frigo 1"
  />
</div>
<div>
  <Label className="text-xs">Stoccaggio</Label>
  <AutocompleteInput
    value={form.stoccaggio}
    onChange={v => setForm(f => ({ ...f, stoccaggio: v }))}
    suggestions={suggestStoccaggio}
    placeholder="es. -20°C"
  />
</div>
```

### Commit
```bash
git add src/renderer/pages/composti/PreparazioniTab.tsx
git commit -m "feat(ui): preparazioni — ubicazione+stoccaggio con autocomplete, solvente+operatore con autocomplete"
```

---

## Checklist verifica

1. Apri una preparazione esistente → Ubicazione e Stoccaggio sono vuoti (dati vecchi in `posizione` non migrati — comportamento atteso)
2. Crea una nuova preparazione → compilando Solvente compare il dropdown dall'anagrafica
3. Crea una nuova preparazione → compilando Operatore compare il dropdown
4. Crea una nuova preparazione → Ubicazione e Stoccaggio mostrano suggerimenti dall'anagrafica
5. Salva e riapri → i valori sono persistiti correttamente
6. Il campo "Posizione" non compare più nel form

---

## Note operative

- `posizione` rimane nella tabella DB come colonna orfana — nessun impatto funzionale.
- I nomi delle categorie anagrafica nel `useEffect` (`'solventi'`, `'operatori'`, `'ubicazioni'`, `'posizioni stoccaggio'`) devono corrispondere alle categorie create in `/anagrafiche`. Se non esistono, i campi funzionano come input libero senza suggerimenti.
- Nessuna modifica a `src/shared/types.ts` strettamente necessaria (i tipi `any` nel form lo gestiscono), ma consigliata per coerenza futura.

---

## Stato database dopo questa sessione

```
user_version = 11
```

| Migration | Tabella | Campi aggiunti |
|-----------|---------|----------------|
| 011 | `preparazioni` | `ubicazione TEXT`, `stoccaggio TEXT` |