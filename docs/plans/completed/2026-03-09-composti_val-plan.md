# Piano Implementazione — Rivalidazione con Scadenza Estesa e Stato Aggiornato
**Data:** 2026-03-09  
**Branch:** master  
**DB user_version attuale:** 7  
**DB user_version dopo questo piano:** 8  

---

## Obiettivo

Quando si esegue una rivalidazione di un composto bisogna poter:

1. Inserire una **nuova data di scadenza estesa** (oltre ai campi già presenti nel dialog)
2. Aggiornare **automaticamente la `scadenza_prodotto`** del composto con la nuova data
3. Mostrare nella tabella lo **stato "Attivo — Rivalidato"** con un link "vedi storico"
4. Far scattare lo stato **"In scadenza"** (30 giorni) sulla **nuova** data estesa, non su quella originale
5. Nello **storico** del pannello laterale, mostrare chiaramente la nuova scadenza accanto all'evento di rivalidazione

---

## Schema delle modifiche per task

```
TASK 1 — Database: nuova colonna in composti_storia
TASK 2 — Backend (IPC): storia-add aggiorna anche scadenza_prodotto
TASK 3 — Tipi TypeScript condivisi
TASK 4 — Dialog Rivalidazione: aggiungere campo nuova scadenza
TASK 5 — Logica stato: computeStato considera ultima rivalidazione
TASK 6 — Badge stato tabella: "Attivo — Rivalidato" + link storico
TASK 7 — Pannello storico: mostrare la nuova scadenza nell'evento
```

---

## TASK 1 ✅ — Migration DB: colonna `nuova_scadenza` in `composti_storia` 

**Perché:** la nuova data di scadenza deve essere salvata nello storico come dato dell'evento di rivalidazione, in modo che sia visibile nella cronologia. Serve anche al backend per aggiornare `scadenza_prodotto`.

### File da creare

**`src/main/migrations/008-rivalidazione-scadenza.sql`** ← file nuovo

```sql
ALTER TABLE composti_storia ADD COLUMN nuova_scadenza TEXT DEFAULT NULL;
```

Questo aggiunge una colonna opzionale alla tabella degli eventi storici. È `NULL` per tutti gli eventi passati e per le Dismissioni — viene popolata solo nelle nuove Rivalidazioni che includono un'estensione di scadenza.

### Comando da eseguire sul DB di sviluppo (una tantum)

Dopo aver creato il file SQL, applicare manualmente al database locale:

```bash
# Sostituire il percorso con quello reale del tuo DB
sqlite3 /Users/vitogelao/Documents/Personali/Chem/Arpa/LCMS\ Suite\ Progetto/LCMS_Suite_Storage/lcms.db "ALTER TABLE composti_storia ADD COLUMN nuova_scadenza TEXT DEFAULT NULL; PRAGMA user_version = 8;"
```

> ℹ️ **Come trovare il percorso del DB:** nell'app, in alto a destra nella topbar c'è il percorso del file DB visualizzato in font monospace.

---

## TASK 2 ✅ — Backend IPC: `composti:storia-add` aggiorna anche `scadenza_prodotto`

**Perché:** quando si salva una rivalidazione con una nuova scadenza, il backend deve fare due cose in una sola transazione atomica:
1. inserire il record in `composti_storia` (come già fa)
2. aggiornare `scadenza_prodotto` nella tabella `composti` con la nuova data

Usare una transazione garantisce che se uno dei due passaggi fallisce, non rimanga lo stato a metà.

### File da modificare

**`src/main/ipc/composti.ipc.ts`**

Trovare il blocco dell'handler `composti:storia-add` (circa a metà file). Attualmente è così:

```typescript
ipcMain.handle('composti:storia-add', (_, compostoId: number, data: {
  tipo: string
  data: string
  note?: string
  n_registro_qc?: string
  batch_analitico?: string
  lotto_crm_valido?: string
}) => {
  const result = getDb().prepare(
    `INSERT INTO composti_storia (composto_id, tipo, data, note, n_registro_qc, batch_analitico, lotto_crm_valido)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    compostoId,
    data.tipo,
    data.data,
    data.note || null,
    data.n_registro_qc || null,
    data.batch_analitico || null,
    data.lotto_crm_valido || null
  )
  return { id: result.lastInsertRowid }
})
```

**Sostituirlo con:**

```typescript
ipcMain.handle('composti:storia-add', (_, compostoId: number, data: {
  tipo: string
  data: string
  note?: string
  n_registro_qc?: string
  batch_analitico?: string
  lotto_crm_valido?: string
  nuova_scadenza?: string        // ← NUOVO campo aggiunto
}) => {
  const db = getDb()
  let newId: number | bigint = 0

  db.transaction(() => {
    // 1. Inserisce l'evento nello storico
    const result = db.prepare(
      `INSERT INTO composti_storia
         (composto_id, tipo, data, note, n_registro_qc, batch_analitico, lotto_crm_valido, nuova_scadenza)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      compostoId,
      data.tipo,
      data.data,
      data.note || null,
      data.n_registro_qc || null,
      data.batch_analitico || null,
      data.lotto_crm_valido || null,
      data.nuova_scadenza || null    // ← NUOVO
    )
    newId = result.lastInsertRowid

    // 2. Se è una Rivalidazione con nuova scadenza, aggiorna scadenza_prodotto del composto
    if (data.tipo === 'Rivalidazione' && data.nuova_scadenza) {
      db.prepare(
        `UPDATE composti SET scadenza_prodotto = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(data.nuova_scadenza, compostoId)
    }
  })()

  return { id: newId }
})
```

**Logica della modifica:** la transazione fa sì che l'inserimento storico e l'aggiornamento della scadenza avvengano insieme o non avvengano affatto. Se `nuova_scadenza` non è fornita (o se il tipo non è Rivalidazione), il comportamento è identico a prima — compatibilità totale con le Dismissioni e le rivalidazioni vecchie senza scadenza.

---

## TASK 3 ✅ — Tipi TypeScript: aggiungere `nuova_scadenza` a `CompostoStoria`

**Perché:** TypeScript deve sapere del nuovo campo per non dare errori nei componenti che usano il tipo.

### File da modificare

**`src/shared/types.ts`**

Trovare l'interfaccia `CompostoStoria` e aggiungere il nuovo campo opzionale:

```typescript
export interface CompostoStoria {
  id: number
  composto_id: number
  tipo: 'Rivalidazione' | 'Dismissione' | 'apertura_fiala'
  data: string
  note: string | null
  n_registro_qc: string | null
  batch_analitico: string | null
  lotto_crm_valido: string | null
  fiala_numero: number | null
  nuova_scadenza: string | null    // ← NUOVO campo da aggiungere
  created_at: string
}
```

---

## TASK 4 ✅ — Dialog Rivalidazione: campo "Nuova data di scadenza"

**Perché:** l'utente deve poter inserire la nuova data nel dialog esistente, senza aprire altri form.

Il dialog di rivalidazione è usato in **due posti** dell'app — entrambi vanno aggiornati:

### File da modificare — A

**`src/renderer/pages/composti/StoriaDialog.tsx`**

Questo è il dialog standalone usato dalla tabella principale (click riga → dropdown → Rivalidazione).

**Modifiche:**

1. Aggiungere stato per il nuovo campo, dopo le righe degli altri stati:
```typescript
const [nuovaScadenza, setNuovaScadenza] = useState('')
```

2. Nel blocco `useEffect` (quello che fa reset all'apertura), aggiungere il reset:
```typescript
setNuovaScadenza('')
```

3. Nella funzione `handleConfirm`, aggiungere il campo al payload:
```typescript
await compostiApi.addStoria(compostoId, {
  tipo,
  data,
  note: note || undefined,
  n_registro_qc: nRegistroQc || undefined,
  batch_analitico: batchAnalitico || undefined,
  lotto_crm_valido: lottoCrmValido || undefined,
  nuova_scadenza: nuovaScadenza || undefined,    // ← NUOVO
})
```

4. Nel JSX, **dentro il blocco `{tipo === 'Rivalidazione' && (...)}` già esistente**, aggiungere dopo il campo "Lotto CRM valido":
```tsx
<div>
  <Label className="text-xs">Nuova data di scadenza</Label>
  <Input
    type="date"
    value={nuovaScadenza}
    onChange={e => setNuovaScadenza(e.target.value)}
  />
  <p className="text-xs text-muted-foreground mt-1">
    Se compilato, aggiorna la scadenza del composto e compare nello storico.
  </p>
</div>
```

### File da modificare — B

**`src/renderer/pages/composti/CompostoPanel.tsx`**

Questo è il dialog di rivalidazione nel pannello laterale (tab Storico → pulsante "Rivalidazione").

Stessa logica: trovare il Dialog interno che gestisce `storiaForm` (già presente nel componente) e aggiungere il campo `nuova_scadenza` in modo identico a quanto descritto sopra per `StoriaDialog.tsx`.

Nello specifico:
- Aggiungere `nuova_scadenza: ''` all'oggetto `storiaData` iniziale
- Aggiungere reset `nuova_scadenza: ''` nel blocco `openStoria`
- Aggiungere `nuova_scadenza: storiaData.nuova_scadenza || undefined` al payload di `handleAddStoria`
- Aggiungere il campo Input nel JSX dentro `{storiaForm.tipo === 'Rivalidazione' && (...)}`

---

## TASK 5 ✅ — Logica stato: `computeStato` considera l'ultima rivalidazione

**Perché:** `computeStato` attualmente legge solo `scadenza_prodotto` dalla tabella `composti`. Poiché TASK 2 aggiorna direttamente `scadenza_prodotto` al momento della rivalidazione, la logica "In scadenza" funziona **automaticamente** senza modifiche a `computeStato`.

Tuttavia, `computeStato` deve anche saper restituire il nuovo stato `'rivalidato'` (già presente in `StatusBadge.tsx` come tipo ma mai attivato). La condizione per "rivalidato" è: il composto ha almeno un evento di tipo `Rivalidazione` nello storico.

Poiché `computeStato` oggi riceve solo i campi del composto (senza la storia), ci sono **due opzioni**:

**Opzione A (raccomandata — più semplice):** aggiungere il campo `ultima_rivalidazione` al composto restituito dalla query `composti:list`, calcolato con una subquery SQL. Poi `computeStato` lo usa.

**Opzione B:** passare la storia completa a `computeStato` — più pesante.

### Si procede con Opzione A.

### File da modificare — A

**`src/main/ipc/composti.ipc.ts`**

Nella query `composti:list` (la SELECT principale che restituisce la lista), aggiungere una subquery per l'ultima rivalidazione. La query attuale ha già dei COUNT per `fiale_aperte_count`. Aggiungere analogamente:

```sql
(SELECT MAX(data) FROM composti_storia 
 WHERE composto_id = c.id AND tipo = 'Rivalidazione') AS ultima_rivalidazione
```

Quindi la SELECT principale diventa (solo la parte aggiuntiva, lasciando invariato il resto):

```sql
SELECT c.*,
  COUNT(...) AS prep_attive_count,
  COUNT(...) AS fiale_aperte_count,
  (SELECT MAX(data) FROM composti_storia 
   WHERE composto_id = c.id AND tipo = 'Rivalidazione') AS ultima_rivalidazione
FROM composti c
...
```

### File da modificare — B

**`src/shared/types.ts`**

Aggiungere `ultima_rivalidazione` all'interfaccia `Composto`:

```typescript
ultima_rivalidazione?: string | null   // ← NUOVO, data ISO dell'ultima rivalidazione
```

### File da modificare — C

**`src/renderer/components/shared/StatusBadge.tsx`**

Modificare `computeStato` per restituire `'rivalidato'` quando il composto è stato rivalidato e non è scaduto:

```typescript
export function computeStato(composto: {
  data_dismissione?: string | null
  scadenza_prodotto?: string | null
  ultima_rivalidazione?: string | null   // ← NUOVO parametro
}): CompostoStato {
  if (composto.data_dismissione) return 'dismesso'
  if (!composto.scadenza_prodotto) {
    // Anche senza scadenza, se c'è una rivalidazione → rivalidato
    if (composto.ultima_rivalidazione) return 'rivalidato'
    return 'attivo'
  }

  const now = new Date()
  const scadenza = new Date(composto.scadenza_prodotto)

  // Nota: scadenza_prodotto è già la data aggiornata dopo rivalidazione (TASK 2)
  if (scadenza < now) return 'scaduto'

  const thirtyDays = 30 * 24 * 60 * 60 * 1000
  if (scadenza.getTime() - now.getTime() < thirtyDays) return 'in_scadenza'

  // Se non scaduto e non in scadenza, ma c'è stata una rivalidazione → rivalidato
  if (composto.ultima_rivalidazione) return 'rivalidato'

  return 'attivo'
}
```

**Nota importante:** lo stato `scaduto` rimane possibile anche per un composto rivalidato — se la nuova scadenza estesa è a sua volta scaduta, il composto torna `scaduto`. Questo è il comportamento corretto.

---

## TASK 6 ✅ — Badge tabella: "Attivo — Rivalidato" con link "vedi storico"

**Perché:** nella tabella principale il badge di stato deve mostrare chiaramente che il composto è stato rivalidato, e permettere all'utente di aprire direttamente il pannello laterale sul tab Storico.

### Comportamento atteso

- Badge blu con testo **"Attivo — Rivalidato"**
- Sotto il badge (o accanto), un link piccolo **"vedi storico"** cliccabile che apre il pannello del composto sul tab Storico
- Non è necessario un popup separato: il click su "vedi storico" seleziona il composto e porta al tab Storico del pannello laterale

### File da modificare — A

**`src/renderer/components/shared/StatusBadge.tsx`**

Il tipo `'rivalidato'` e il suo stile sono già definiti (badge blu). Nessuna modifica necessaria qui.

### File da modificare — B

**`src/renderer/pages/composti/CompostiTable.tsx`**

Nella colonna Stato (quella che renderizza `<StatusBadge>`), aggiungere il link condizionale sotto il badge quando lo stato è `'rivalidato'`:

```tsx
// Nella cella della colonna Stato:
{(() => {
  const stato = computeStato(row)
  return (
    <div className="flex flex-col gap-0.5">
      <StatusBadge status={stato} />
      {stato === 'rivalidato' && (
        <button
          className="text-xs text-blue-500 hover:underline text-left"
          onClick={(e) => {
            e.stopPropagation()
            onOpenStorico?.(row)   // ← callback da aggiungere alle props
          }}
        >
          vedi storico
        </button>
      )}
    </div>
  )
})()}
```

Aggiungere la prop `onOpenStorico` all'interfaccia delle props di `CompostiTable`:

```typescript
interface CompostiTableProps {
  // ...props esistenti...
  onOpenStorico?: (composto: Composto) => void   // ← NUOVO
}
```

### File da modificare — C

**`src/renderer/pages/composti/CompostiPage.tsx`**

Passare il callback `onOpenStorico` alla tabella. Questo callback deve:
1. Impostare il composto selezionato (come fa già il click sulla riga)
2. Aprire il pannello laterale sul tab "storico"

```tsx
<CompostiTable
  ...
  onOpenStorico={(composto) => {
    setSelected(composto)
    setPanelTab('storico')   // ← nuovo stato da aggiungere
  }}
/>
```

Aggiungere lo stato `panelTab` in `CompostiPage.tsx`:

```typescript
const [panelTab, setPanelTab] = useState<string>('dettaglio')
```

Passarlo a `CompostoPanel`:

```tsx
<CompostoPanel
  ...
  defaultTab={panelTab}
  onClose={() => { setSelected(null); setPanelTab('dettaglio') }}
/>
```

### File da modificare — D

**`src/renderer/pages/composti/CompostoPanel.tsx`**

Aggiungere la prop `defaultTab` che controlla quale tab viene aperto inizialmente:

```typescript
interface CompostoPanelProps {
  // ...props esistenti...
  defaultTab?: string    // ← NUOVO
}
```

Nel componente `Tabs`, usare `defaultTab` se fornito:

```tsx
<Tabs defaultValue={defaultTab ?? 'dettaglio'} ...>
```

> ⚠️ Attenzione: se il pannello rimane aperto mentre si cambia `defaultTab` (es. click su un secondo composto), React potrebbe non re-renderizzare il tab. Potrebbe servire una `key={selected?.id}` sul componente `CompostoPanel` in `CompostiPage.tsx` per forzare il remount. Da verificare durante i test.

---

## TASK 7 ✅ — Pannello Storico: mostrare la nuova scadenza nell'evento

**Perché:** nel tab Storico del pannello laterale, ogni evento di Rivalidazione deve mostrare anche la nuova data di scadenza impostata, rendendo la cronologia completa e leggibile.

### File da modificare

**`src/renderer/pages/composti/CompostoPanel.tsx`**

Nel blocco che renderizza la lista degli eventi storici (il `.map` su `composto.storia`), aggiungere la visualizzazione di `nuova_scadenza` per gli eventi di tipo Rivalidazione:

Attualmente ogni evento mostra: tipo, data, n_registro_qc, batch_analitico, lotto_crm_valido, note.

Aggiungere dopo `lotto_crm_valido` e prima di `note`:

```tsx
{s.nuova_scadenza && (
  <div className="text-xs">
    <span className="text-muted-foreground">Scadenza estesa al: </span>
    <span className="font-mono font-medium text-blue-700">
      {formatDate(s.nuova_scadenza)}
    </span>
  </div>
)}
```

---

## Riepilogo file coinvolti

| File | Tipo modifica | Task |
|------|---------------|------|
| `src/main/migrations/008-rivalidazione-scadenza.sql` | ✨ Nuovo | TASK 1 |
| `src/main/ipc/composti.ipc.ts` | 🔧 Modifica | TASK 2, TASK 5A |
| `src/shared/types.ts` | 🔧 Modifica | TASK 3, TASK 5B |
| `src/renderer/pages/composti/StoriaDialog.tsx` | 🔧 Modifica | TASK 4A |
| `src/renderer/pages/composti/CompostoPanel.tsx` | 🔧 Modifica | TASK 4B, TASK 6D, TASK 7 |
| `src/renderer/components/shared/StatusBadge.tsx` | 🔧 Modifica | TASK 5C |
| `src/renderer/pages/composti/CompostiTable.tsx` | 🔧 Modifica | TASK 6B |
| `src/renderer/pages/composti/CompostiPage.tsx` | 🔧 Modifica | TASK 6C |

---

## Ordine consigliato di esecuzione

Eseguire i task nell'ordine indicato: prima il DB (TASK 1), poi il backend (TASK 2), poi i tipi (TASK 3), poi il frontend (TASK 4→7). Questo evita errori TypeScript durante lo sviluppo.

Dopo ogni task eseguire:

```bash
# Verificare che non ci siano errori TypeScript
npx tsc --noEmit

# Commit del singolo task
git add -A
git commit -m "feat(rivalidazione): TASK N — descrizione"
```

---

## Stato DB dopo questo piano

```
user_version = 8
migrations applicate: 001 → ... → 007 → 008
```

| Migration | Tabella | Campi aggiunti |
|-----------|---------|----------------|
| 008 | `composti_storia` | `nuova_scadenza` |