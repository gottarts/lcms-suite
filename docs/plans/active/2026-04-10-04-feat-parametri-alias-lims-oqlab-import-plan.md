# Piano: Alias LIMS/OQLab e Import con Automap — ParametriMetodoPage

## Contesto

La tabella parametri dei metodi (`ParametriMetodoPage`) richiede tre miglioramenti:

1. **"Accredita tutti"** — oggi per marcare accreditati 50+ analiti bisogna cliccare ogni checkbox manualmente.
2. **Colonne alias** — servono `alias_lims` e `alias_oqlab` (accanto al già esistente `alias_strumento`) per mappare i nomi interni ai codici dei sistemi esterni.
3. **Import con automap** — dato un file CSV/Excel da LIMS o OQLab, mappare automaticamente le colonne al DB usando Levenshtein fuzzy, con step di revisione per i non mappati.

L'algoritmo ML locale (TF.js) è stato scartato: per nomi chimici brevi (<50 char) Levenshtein normalizzato è equivalente e ha zero latenza/dipendenze.

---

## File critici

| File | Ruolo |
|------|-------|
| [src/renderer/pages/metodi/ParametriMetodoPage.tsx](src/renderer/pages/metodi/ParametriMetodoPage.tsx) | UI principale — va esteso |
| [src/main/ipc/metodo-analiti.ipc.ts](src/main/ipc/metodo-analiti.ipc.ts) | IPC handler — aggiungere `bulk-update` e `import-alias` |
| [src/renderer/lib/api.ts](src/renderer/lib/api.ts) | Client IPC renderer — aggiungere nuovi metodi |
| [src/main/migrations/](src/main/migrations/) | Nuova migrazione per `alias_lims` e `alias_oqlab` |
| [src/renderer/pages/composti/ImportDialog.tsx](src/renderer/pages/composti/ImportDialog.tsx) | Riferimento architetturale per il dialog di import |

---

## Step 1 — Migrazione DB: aggiungere alias_lims e alias_oqlab

Nuovo file: `src/main/migrations/020-metodo-analiti-alias-extra.sql`

```sql
ALTER TABLE metodo_analiti ADD COLUMN alias_lims TEXT;
ALTER TABLE metodo_analiti ADD COLUMN alias_oqlab TEXT;
```

Il pattern backward-compat con `PRAGMA table_info` già usato in `metodo-analiti.ipc.ts:8-13` copre il caso di DB vecchi senza rifare da zero.

---

## Step 2 — IPC: estendere handler esistenti

### `metodo-analiti:list` — aggiungere le 2 colonne nuove
In `metodo-analiti.ipc.ts:10-13`: aggiungere `alias_lims` e `alias_oqlab` al `selectCols` condizionale (già gestisce PRAGMA, basta aggiungere le colonne).

### `metodo-analiti:update` — già generico, gestisce patch parziale
Nessuna modifica strutturale: il loop `'alias_lims' in patch && cols.includes('alias_lims')` funziona già per il pattern esistente — basta aggiungere le due chiavi al type della patch.

### Nuovo handler `metodo-analiti:bulk-set-accreditato`
Input: `{ metodo_id: string, nomi?: string[] | 'all', accreditato: 0 | 1 }`

```ts
// nomi = 'all' → UPDATE WHERE metodo_id = ?
// nomi = array → UPDATE WHERE metodo_id = ? AND nome IN (...)
```

Usato dal pulsante "Accredita tutti" / "Rimuovi accreditamento a tutti".

### Nuovo handler `metodo-analiti:bulk-update-alias`
Input: `Array<{ nome: string; alias_lims?: string | null; alias_oqlab?: string | null; alias_strumento?: string | null }>`  
Match per `LOWER(nome) = LOWER(?)` all'interno di una transazione.  
Usato dal dialog di import dopo la revisione.

---

## Step 3 — UI: ParametriMetodoPage

### 3a. Colonne alias_lims e alias_oqlab

Aggiungere due colonne inline-edit nella tabella, stesso pattern di `alias_strumento` (righe 96-103 di ParametriMetodoPage.tsx). Estendere:
- interfaccia `Analita`: aggiungere `alias_lims: string | null` e `alias_oqlab: string | null`
- stati `aliasEdit` già genericizzati per id → estendere il tipo
- `handleAliasBlur` già parametrizzato da `field` — rendere esplicito il field name

### 3b. Pulsante "Accredita tutti" / "Rimuovi accreditamento"

Nella toolbar (dopo il pulsante "Rimuovi selezionati"), aggiungere un dropdown o due pulsanti:
- **"Accredita tutti"** → chiama `bulk-set-accreditato({ metodo_id, nomi: 'all', accreditato: 1 })` → aggiorna stato locale
- Opzionalmente **"Rimuovi accreditamento"** come variante destructive

### 3c. Pulsante "Importa alias..."

Apre `AliasImportDialog` (nuovo file, vedi Step 4).

---

## Step 4 — AliasImportDialog (nuovo componente)

File: `src/renderer/pages/metodi/AliasImportDialog.tsx`

### Flusso a step (come ImportDialog.tsx):
```
upload → sheet → mapping → automap → revisione → import
```

**Step upload** — drag-and-drop o file picker (XLSX, CSV). Riusa il pattern di `ImportDialog.tsx:238+` con libreria `xlsx` già installata.

**Step sheet** — se Excel multi-foglio, scegli foglio (stesso pattern ImportDialog).

**Step mapping** — l'utente indica quale colonna del file contiene i "nomi analiti" sorgente, e quali colonne contengono alias_lims / alias_oqlab / alias_strumento (opzionali). Select dropdown per ogni campo.

**Step automap** — algoritmo fuzzy:

```ts
function levenshtein(a: string, b: string): number { ... }  // O(n*m) classico

function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s\-_,./()[\]]/g, '')
}

function similarity(a: string, b: string): number {
  const na = normalize(a), nb = normalize(b)
  const maxLen = Math.max(na.length, nb.length)
  if (maxLen === 0) return 1
  return 1 - levenshtein(na, nb) / maxLen
}

// Per ogni riga del file → cerca il miglior match tra analiti del metodo
function automap(
  fileRows: string[],           // nomi dalla colonna "sorgente" del file
  analiti: string[]             // nomi interni del metodo
): Array<{ source: string; matched: string | null; score: number; status: 'auto'|'suggest'|'unmatched' }> {
  // status: 'auto' se score >= 0.85, 'suggest' se 0.60-0.84, 'unmatched' se < 0.60
}
```

**Step revisione** — tabella a 3 colonne:
- Nome file (immutabile)
- Nome interno → select dropdown pre-popolato con il suggerimento (verde/giallo/rosso)  
- Colonne alias risultanti (read-only preview)

Le righe "auto" (verde, ≥0.85) sono collassate in un accordeon "Mappati automaticamente (N)" espandibile.  
Le righe "suggest" (giallo) e "unmatched" (rosso) sono in cima, espanse, con priorità di revisione.

**Step import** — chiama `metodo-analiti:bulk-update-alias` con le righe confermate (ignora le righe non mappate rimaste rosse).

---

## Step 5 — api.ts: nuovi metodi

```ts
metodoAnalitiApi = {
  ...esistente,
  bulkSetAccreditato: (metodoId, nomi, accreditato) => ipc('metodo-analiti:bulk-set-accreditato', ...),
  bulkUpdateAlias: (updates) => ipc('metodo-analiti:bulk-update-alias', updates),
}
```

---

## Ordine di implementazione

1. **Migrazione DB** (`020-metodo-analiti-alias-extra.sql`) — prerequisito per tutto
2. **IPC + api.ts**: estendere `list`/`update`, aggiungere `bulk-set-accreditato` e `bulk-update-alias`
3. **ParametriMetodoPage**: colonne `alias_lims` + `alias_oqlab` + pulsante "Accredita tutti"
4. **AliasImportDialog**: componente import completo con automap Levenshtein
5. **Collegamento**: pulsante "Importa alias..." in ParametriMetodoPage che apre il dialog

---

## Verifica end-to-end

- `npm run dev` → ParametriMetodoPage apre, mostra le 5 colonne (nome, accreditato, alias_strumento, alias_lims, alias_oqlab)
- Click "Accredita tutti" → tutti i checkbox si spuntano, ricarica conferma da DB
- Carica CSV con colonna nomi analiti (mix di match perfetti, varianti con typo, nomi nuovi) → step automap mostra verde/giallo/rosso correttamente
- Conferma import → gli alias si aggiornano nella tabella
- Regressione: aprire SchemaCalibrazione → nessun impatto visibile
- Regressione: Dashboard Audit CRM → `alias_strumento` ancora presente in query `SELECT id, nome, alias_strumento, ordine`
