# Piano — Classe libera + Auto-populate Anagrafiche + Merge voci
**Data:** 2026-03-16  
**Stato DB:** user_version 9 (nessuna migration necessaria)  
**Branch base:** master

---

## Panoramica

| Macro | Descrizione | Task |
|-------|-------------|------|
| **A** | Campo `classe` libero con autocomplete | A-1, A-2, A-3 |
| **B** | Auto-populate anagrafiche al salvataggio | B-1, B-2, B-3 |
| **C** | Merge voci anagrafica (rename + merge esplicito) | C-1, C-2, C-3 |

---

## MACRO A — Campo `classe` libero con autocomplete

**Problema attuale:** `classe` è una `<Select>` con valori hardcoded in `MixPesticidiForm.tsx`. Deve diventare input testo libero con suggerimenti dinamici presi dal DB.

---

### TASK A-1 — Backend: handler `composti:distinct-values`

**File:** `src/main/ipc/composti.ipc.ts`

Aggiungere un handler generico che restituisce i valori distinti non-null di una colonna della tabella `composti`. Usato da tutti i campi autocomplete (classe, produttore, solvente).

```ts
ipcMain.handle('composti:distinct-values', (_, campo: string) => {
  // Whitelist dei campi consentiti per sicurezza
  const ALLOWED = ['classe', 'produttore', 'solvente', 'stoccaggio', 'ubicazione']
  if (!ALLOWED.includes(campo)) return []
  const db = getDb()
  return db.prepare(
    `SELECT DISTINCT ${campo} as valore FROM composti
     WHERE ${campo} IS NOT NULL AND ${campo} != ''
     ORDER BY ${campo} COLLATE NOCASE`
  ).all().map((r: any) => r.valore)
})
```

Aggiungere anche la firma nel tipo `ElectronAPI` in `src/preload/index.ts` (o dove è dichiarato `invoke`).

---

### TASK A-2 — Componente condiviso `AutocompleteInput`

**File nuovo:** `src/renderer/components/shared/AutocompleteInput.tsx`

Componente riusabile per tutti i campi testo-libero con suggerimenti. Pattern identico al campo Metodi già implementato in `CompostoForm`.

```tsx
interface AutocompleteInputProps {
  value: string
  onChange: (val: string) => void
  suggestions: string[]          // lista suggerimenti da fuori
  placeholder?: string
  disabled?: boolean
  className?: string
}
```

Comportamento:
- Input testo libero
- Dropdown con suggerimenti filtrati sul testo digitato (case-insensitive, `includes`)
- Selezione con click o Enter (se suggerimento unico)
- Escape chiude dropdown senza modificare il valore
- Nessuna opzione "crea" — il campo è libero, non crea nulla da solo

---

### TASK A-3 — Frontend: sostituire `<Select>` classe con `AutocompleteInput`

**File:** `src/renderer/pages/composti/MixPesticidiForm.tsx`  
**File:** `src/renderer/pages/composti/CompostoForm.tsx`

**In entrambi i file:**

1. Aggiungere stato `classiDisponibili: string[]`
2. Nel `useEffect` iniziale, caricare:
   ```ts
   window.electronAPI.invoke('composti:distinct-values', 'classe').then(setClassiDisponibili)
   ```
3. Sostituire il blocco `<Select>` del campo Classe con:
   ```tsx
   <AutocompleteInput
     value={form.classe || ''}
     onChange={v => set('classe', v)}
     suggestions={classiDisponibili}
     placeholder="es. Pesticidi, Antibiotici..."
   />
   ```

**In `MixPesticidiForm.tsx`** rimuovere anche l'import `SelectItem` per le classi hardcoded (Antibiotico, Antiviral, FANS ecc.) e la costante con la lista.

---

## MACRO B — Auto-populate anagrafiche al salvataggio

**Logica:** quando l'utente salva un composto (create o update), l'app verifica per ogni campo "collegato" se il valore inserito esiste già come voce nell'anagrafica corrispondente. Se non esiste, lo aggiunge automaticamente — senza chiedere.

### Mappa campi → anagrafiche

| Campo composto | Anagrafica (ricerca per nome, case-insensitive) |
|---------------|------------------------------------------------|
| `classe` | `"Classi"` (o `"Classe"`) |
| `produttore` | `"Produttori"` (o `"Fornitori"`) |
| `solvente` | `"Solventi"` |
| `stoccaggio` | `"Posizioni stoccaggio"` (già esistente) |
| `operatore_apertura` | `"Operatori"` |

> **Nota:** la ricerca dell'anagrafica avviene per nome con `LOWER(nome) LIKE LOWER(?)`. Se l'anagrafica non esiste ancora, viene creata automaticamente.

---

### TASK B-1 — Backend: handler `anagrafiche:sync-voce`

**File:** `src/main/ipc/anagrafiche.ipc.ts`

Nuovo handler che riceve il nome dell'anagrafica e il valore da sincronizzare. Trova o crea l'anagrafica, poi aggiunge la voce se non è già presente (UNIQUE per anagrafica).

```ts
ipcMain.handle('anagrafiche:sync-voce', (_, nomeAnagrafica: string, valore: string) => {
  if (!valore || !valore.trim()) return { ok: true, skipped: true }
  const db = getDb()

  // Trova o crea anagrafica
  let anagrafica = db.prepare(
    `SELECT * FROM anagrafiche WHERE LOWER(nome) = LOWER(?)`
  ).get(nomeAnagrafica.trim()) as any

  if (!anagrafica) {
    const result = db.prepare(
      `INSERT INTO anagrafiche (nome) VALUES (?)`
    ).run(nomeAnagrafica.trim())
    anagrafica = { id: result.lastInsertRowid }
  }

  // Inserisce la voce solo se non esiste già (ignora errore UNIQUE)
  try {
    db.prepare(
      `INSERT INTO anagrafiche_voci (anagrafica_id, valore) VALUES (?, ?)`
    ).run(anagrafica.id, valore.trim())
  } catch {
    // UNIQUE constraint → voce già presente, nessun problema
  }

  return { ok: true }
})
```

---

### TASK B-2 — Utility frontend `syncAnagrafiche`

**File nuovo:** `src/renderer/lib/anagrafiche-sync.ts`

Funzione helper che riceve un oggetto con i campi del composto salvato e lancia le chiamate IPC in parallelo.

```ts
const CAMPO_ANAGRAFICA_MAP: Record<string, string> = {
  classe:             'Classi',
  produttore:         'Produttori',
  solvente:           'Solventi',
  stoccaggio:         'Posizioni stoccaggio',
  operatore_apertura: 'Operatori',
}

export async function syncAnagrafiche(data: Partial<Record<string, string>>) {
  const promises = Object.entries(CAMPO_ANAGRAFICA_MAP)
    .filter(([campo]) => data[campo]?.trim())
    .map(([campo, nomeAnagrafica]) =>
      window.electronAPI.invoke('anagrafiche:sync-voce', nomeAnagrafica, data[campo]!)
    )
  await Promise.allSettled(promises) // non blocca il salvataggio se fallisce
}
```

---

### TASK B-3 — Chiamare `syncAnagrafiche` in `handleSave`

**File:** `src/renderer/pages/composti/CompostoForm.tsx`  
**File:** `src/renderer/pages/composti/MixPesticidiForm.tsx`

In entrambi i file, nella funzione `handleSave`, **dopo** la chiamata a `compostiApi.create(...)` / `compostiApi.update(...)` (e prima di `onSave()` / chiusura dialog):

```ts
// Dopo il salvataggio composto
await syncAnagrafiche({
  classe:             form.classe,
  produttore:         form.produttore,
  solvente:           form.solvente,
  stoccaggio:         form.stoccaggio,
  operatore_apertura: form.operatore_apertura,
})
onSave()
```

In `MixPesticidiForm` il sync va chiamato **una sola volta** sul form comune (non per ogni riga del mix — i valori condivisi sono gli stessi).

---

## MACRO C — Merge voci anagrafica

**Obiettivo:** in `AnagrafichePage`, l'utente può:
1. **Rename con propagazione** — rinomina una voce e tutti i composti che avevano quel valore vengono aggiornati automaticamente
2. **Merge esplicito** — seleziona due voci e le unisce in una sola, riassegnando tutti i composti

---

### TASK C-1 — Backend: handler `anagrafiche:rename-voce-propagate`

**File:** `src/main/ipc/anagrafiche.ipc.ts`

Nuovo handler che rinomina una voce **e** aggiorna tutti i composti che usavano il vecchio valore nel campo corrispondente.

```ts
ipcMain.handle('anagrafiche:rename-voce-propagate',
  (_, voceId: number, nuovoValore: string, campoDB: string) => {
  const ALLOWED_CAMPI = ['classe', 'produttore', 'solvente', 'stoccaggio', 'operatore_apertura']
  if (!ALLOWED_CAMPI.includes(campoDB)) return { ok: false, error: 'Campo non consentito' }

  const db = getDb()
  const voce = db.prepare('SELECT * FROM anagrafiche_voci WHERE id = ?').get(voceId) as any
  if (!voce) return { ok: false, error: 'Voce non trovata' }

  const vecchioValore = voce.valore

  db.transaction(() => {
    // Aggiorna la voce nell'anagrafica
    db.prepare('UPDATE anagrafiche_voci SET valore = ? WHERE id = ?')
      .run(nuovoValore.trim(), voceId)
    // Propaga a tutti i composti che avevano il vecchio valore
    db.prepare(`UPDATE composti SET ${campoDB} = ? WHERE ${campoDB} = ?`)
      .run(nuovoValore.trim(), vecchioValore)
  })()

  return { ok: true }
})
```

---

### TASK C-2 — Backend: handler `anagrafiche:merge-voci`

**File:** `src/main/ipc/anagrafiche.ipc.ts`

Unisce due voci: tutti i composti che avevano `voce_sorgente` vengono aggiornati a `voce_destinazione`, poi `voce_sorgente` viene eliminata.

```ts
ipcMain.handle('anagrafiche:merge-voci',
  (_, voceSourceId: number, voceDestId: number, campoDB: string) => {
  const ALLOWED_CAMPI = ['classe', 'produttore', 'solvente', 'stoccaggio', 'operatore_apertura']
  if (!ALLOWED_CAMPI.includes(campoDB)) return { ok: false, error: 'Campo non consentito' }

  const db = getDb()
  const src  = db.prepare('SELECT * FROM anagrafiche_voci WHERE id = ?').get(voceSourceId) as any
  const dest = db.prepare('SELECT * FROM anagrafiche_voci WHERE id = ?').get(voceDestId)   as any
  if (!src || !dest) return { ok: false, error: 'Voci non trovate' }

  db.transaction(() => {
    // Riassegna composti dal valore sorgente al valore destinazione
    db.prepare(`UPDATE composti SET ${campoDB} = ? WHERE ${campoDB} = ?`)
      .run(dest.valore, src.valore)
    // Elimina la voce sorgente
    db.prepare('DELETE FROM anagrafiche_voci WHERE id = ?').run(voceSourceId)
  })()

  return { ok: true, compostiAggiornati: true }
})
```

---

### TASK C-3 — Frontend: UI merge/rename in `AnagraficaCard`

**File:** `src/renderer/pages/anagrafiche/AnagraficaCard.tsx`  
**File:** `src/renderer/lib/api.ts`

#### Modifica `api.ts`

Aggiungere a `anagraficheApi`:
```ts
renameVocePropagate: (voceId: number, nuovoValore: string, campoDB: string) =>
  api.invoke('anagrafiche:rename-voce-propagate', voceId, nuovoValore, campoDB) as Promise<{ok: boolean}>,
mergeVoci: (sourceId: number, destId: number, campoDB: string) =>
  api.invoke('anagrafiche:merge-voci', sourceId, destId, campoDB) as Promise<{ok: boolean}>,
```

#### Modifica `AnagraficaCard.tsx`

La card deve sapere a quale campo del DB è collegata. Aggiungere prop:
```ts
campoDB?: string  // es. 'classe', 'produttore' — undefined = anagrafica non collegata a composti
```

**Rename con propagazione:**  
Se `campoDB` è definito, la funzione `handleUpdateVoce` deve chiamare `renameVocePropagate` invece di `updateVoce`. Prima del salvataggio mostrare un `AlertDialog` di conferma:

> "Rinominare **Pesticidi** in **Fitofarmaci** aggiornerà automaticamente tutti i composti che usano questa classe. Continuare?"

Con contatore opzionale: richiamare `composti:distinct-values` per mostrare quanti composti verranno toccati (nice-to-have, non bloccante).

**Merge esplicito:**  
Aggiungere accanto a ogni voce (oltre al tasto elimina esistente) un tasto **"Unisci con..."** (icona `GitMerge` o `ArrowRightLeft`). Al click apre un popover/dialog che mostra le altre voci della stessa card come opzioni. L'utente sceglie la voce destinazione e conferma. Il dialog mostra:

> "Tutti i composti con classe **Fito** verranno spostati sotto **Pesticidi**. La voce **Fito** verrà eliminata."

Il pulsante Unisci è disabilitato (con tooltip) se `campoDB` non è definito, oppure se la card ha solo una voce.

#### Modifica `AnagrafichePage.tsx`

Passare la prop `campoDB` alle card in base al nome dell'anagrafica:

```ts
const NOME_CAMPO_MAP: Record<string, string> = {
  'classi':               'classe',
  'classe':               'classe',
  'produttori':           'produttore',
  'fornitori':            'produttore',
  'solventi':             'solvente',
  'posizioni stoccaggio': 'stoccaggio',
  'operatori':            'operatore_apertura',
}

// Nel render della card:
campoDB={NOME_CAMPO_MAP[a.nome.toLowerCase()]}
```

---

## Riepilogo file modificati

| File | Tipo | Task |
|------|------|------|
| `src/main/ipc/composti.ipc.ts` | 🔧 Modifica | A-1 — handler `composti:distinct-values` |
| `src/main/ipc/anagrafiche.ipc.ts` | 🔧 Modifica | B-1 — `anagrafiche:sync-voce`; C-1 — `rename-voce-propagate`; C-2 — `merge-voci` |
| `src/renderer/components/shared/AutocompleteInput.tsx` | ✨ Nuovo | A-2 |
| `src/renderer/lib/anagrafiche-sync.ts` | ✨ Nuovo | B-2 |
| `src/renderer/pages/composti/CompostoForm.tsx` | 🔧 Modifica | A-3 — autocomplete classe; B-3 — sync al salvataggio |
| `src/renderer/pages/composti/MixPesticidiForm.tsx` | 🔧 Modifica | A-3 — autocomplete classe; B-3 — sync al salvataggio |
| `src/renderer/lib/api.ts` | 🔧 Modifica | C-3 — `renameVocePropagate`, `mergeVoci` |
| `src/renderer/pages/anagrafiche/AnagraficaCard.tsx` | 🔧 Modifica | C-3 — UI rename propagate + merge esplicito |
| `src/renderer/pages/anagrafiche/AnagrafichePage.tsx` | 🔧 Modifica | C-3 — prop `campoDB` alle card |

---

## Ordine di implementazione consigliato

```
A-1 → A-2 → A-3   (campo classe libero — indipendente, testabile subito)
B-1 → B-2 → B-3   (auto-populate — dipende da A-1 per avere classi nel DB)
C-1 → C-2 → C-3   (merge — dipende da B per avere voci popolate su cui fare merge)
```

---

## Note importanti

- **Nessuna migration DB** — tutti i campi esistono già. I nuovi handler lavorano su tabelle e colonne esistenti.
- **`Promise.allSettled` in B-2** — il sync anagrafiche non blocca il flusso di salvataggio anche se l'IPC fallisce.
- **Whitelist campi** in A-1, C-1, C-2 — prevenzione SQL injection via campo dinamico.
- **`campoDB` undefined** — le card anagrafiche non collegate a composti (es. "Metodi analisi interni") non mostrano il bottone merge e usano il rename semplice già esistente.
- Il rename con propagazione **sostituisce** `handleUpdateVoce` esistente solo per le card con `campoDB` definito — le altre card continuano a usare `anagrafiche:update-voce` invariato.