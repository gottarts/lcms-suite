# Piano: Tre Feature/Fix — Operatore Anagrafiche, Bug Standard Interno, Pulsante Schemi

## Context

Tre interventi distinti richiesti dall'utente via selezione nel draft:

1. **Operatore in work_preparazioni da Anagrafiche** — il campo operatore nel form di registrazione preparazione (WorkDrawer) è un input libero; deve diventare un autocomplete che legge i valori dall'anagrafica `'operatori'`.
2. **Bug: CRM Standard Interno non mostra metodi in AggiungiASchemaDialog** — `metodi:list-for-work` filtra i metodi che hanno analiti corrispondenti agli ingredienti CRM della work. Un CRM con `destinazione_uso = 'Standard Interno'` viene trattato come IS e probabilmente non è in `metodo_analiti`, quindi la work non trova metodi a cui associarsi. (Questo funziona per CRM Taratura perché quei nomi sono in `metodo_analiti`.)
3. **Pulsante "Schemi" in WorkDrawer** — aggiungere un pulsante nella sezione azioni del drawer che naviga allo schema (riutilizzando `onVaiASchema`). Se la work è in 1 metodo: pulsante singolo. Se >1: DropdownMenu (come pattern CRM scaduti già esistente).

---

## Task 1: Operatore da Anagrafiche in WorkDrawer

**File da modificare:** `src/renderer/pages/work/WorkDrawer.tsx`

**Cosa fare:**

1. Aggiungere state `suggestOperatore: string[]` (già pattern in PreparazioniTab.tsx:70).
2. Aggiungere `useEffect` che, all'apertura del drawer (quando `workId` cambia da null a valore), invoca `window.electronAPI.invoke('anagrafiche:list')` ed estrae le voci dell'anagrafica `'operatori'` → `setSuggestOperatore`.
3. Importare `AutocompleteInput` da `@/components/shared/AutocompleteInput`.
4. Sostituire l'`<input type="text">` manuale per operatore (riga ~673-679) con `<AutocompleteInput value={prepOp} onChange={setPrepOp} suggestions={suggestOperatore} placeholder="es. V.G." className="..." />`.

**Pattern di riferimento:** `src/renderer/pages/composti/PreparazioniTab.tsx` righe 70-87 per il caricamento, e qualsiasi uso di `AutocompleteInput` in CompostoForm.tsx per il rendering.

---

## Task 2: Fix Bug work con ingrediente Neat (source_type='prep') in AggiungiASchemaDialog

**Causa root del bug:** `metodi:list-for-work` (in `src/main/ipc/metodi.ipc.ts` riga 15-26) fa un JOIN su `work_ingredienti` filtrando solo `source_type = 'crm'`. Una work che usa un CRM come preparazione Neat (`source_type = 'prep'`) non ha ingredienti con `source_type = 'crm'` → il JOIN non trova match → il metodo non appare nel dropdown → dialog vuota senza metodi selezionabili.

Il bug si manifesta con CRM Standard Interno (usati tipicamente come Neat), ma la stessa logica difettosa si applica a qualsiasi work con ingredienti Neat (`source_type='prep'`), indipendentemente dalla destinazione d'uso.

**Fix:** Estendere la query per includere anche gli ingredienti `source_type='prep'`, risalendo al composto padre via `preparazioni JOIN composti`. La logica deve essere: "trova metodi che hanno in `metodo_analiti` almeno un analita corrispondente a un ingrediente CRM **o** Neat della work".

**Modifica in `src/main/ipc/metodi.ipc.ts` righe 15-26:**

```sql
-- Attuale (solo crm):
SELECT DISTINCT m.*, s.codice AS strumento_codice
FROM metodi m
LEFT JOIN strumenti s ON s.id = m.strumento_id
JOIN metodo_analiti ma ON ma.metodo_id = m.id
JOIN work_ingredienti wi
  ON wi.work_id = ?
  AND wi.source_type = 'crm'
  AND LOWER((SELECT nome FROM composti WHERE id = wi.source_id)) = LOWER(ma.nome)
ORDER BY m.nome

-- Fix (crm + prep, risale al composto padre per le prep):
SELECT DISTINCT m.*, s.codice AS strumento_codice
FROM metodi m
LEFT JOIN strumenti s ON s.id = m.strumento_id
JOIN metodo_analiti ma ON ma.metodo_id = m.id
JOIN work_ingredienti wi ON wi.work_id = ?
WHERE (
  (wi.source_type = 'crm'
   AND LOWER((SELECT nome FROM composti WHERE id = wi.source_id)) = LOWER(ma.nome))
  OR
  (wi.source_type = 'prep'
   AND LOWER((SELECT c.nome FROM preparazioni p JOIN composti c ON c.id = p.composto_id WHERE p.id = COALESCE(wi.prep_id, wi.source_id))) = LOWER(ma.nome))
)
ORDER BY m.nome
```

**File da modificare:** `src/main/ipc/metodi.ipc.ts` righe 15-27.

---

## Task 3: Pulsante "Schemi" in WorkDrawer

**File da modificare:** `src/renderer/pages/work/WorkDrawer.tsx`

**Posizione:** nella sezione `{/* Azioni */}` (riga ~426-438), aggiungere dopo i pulsanti Modifica/Elimina/Archivia.

**Logica:**
- Se `onVaiASchema` non è definito → non mostrare nulla.
- Se `work.metodi_ids?.length === 0` → pulsante disabilitato.
- Se `work.metodi_ids?.length === 1` → `<Button>` con `onClick={() => onVaiASchema(work.metodi_ids[0])}`.
- Se `work.metodi_ids?.length > 1` → `<DropdownMenu>` (già importato) con lista metodi.

**Icona:** `ExternalLink` (già importata in WorkDrawer.tsx riga 7).

**Pattern di riferimento:** righe 512-530 del WorkDrawer (banner CRM scaduti con DropdownMenu → "Vai a schema").

**JSX da aggiungere** (dentro la div `flex gap-2 flex-wrap` delle azioni):

```tsx
{onVaiASchema && work.metodi_ids && (
  work.metodi_ids.length === 1 ? (
    <Button size="sm" variant="outline" onClick={() => onVaiASchema(work.metodi_ids[0])}>
      <ExternalLink className="h-3.5 w-3.5 mr-1" /> Schemi
    </Button>
  ) : work.metodi_ids.length > 1 ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline">
          <ExternalLink className="h-3.5 w-3.5 mr-1" /> Schemi
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {work.metodi_ids.map((mid: string) => (
          <DropdownMenuItem key={mid} onClick={() => onVaiASchema(mid)}>
            {metodiNomi?.[mid] ?? mid}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : (
    <Button size="sm" variant="outline" disabled>
      <ExternalLink className="h-3.5 w-3.5 mr-1" /> Schemi
    </Button>
  )
)}
```

---

## File critici da modificare

| File | Task | Modifica |
|------|------|----------|
| `src/renderer/pages/work/WorkDrawer.tsx` | 1, 3 | Autocomplete operatore + pulsante Schemi |
| `src/main/ipc/metodi.ipc.ts` | 2 | Fix query `metodi:list-for-work` |

## Verifica

1. **Task 1**: aprire drawer di una work, sezione "Nuova preparazione" → campo Operatore mostra autocomplete con i valori dell'anagrafica operatori.
2. **Task 2**: creare una work con un CRM Standard Interno come ingrediente → aprire AggiungiASchemaDialog → il dropdown metodi mostra i metodi disponibili (non è vuoto).
3. **Task 3**: aprire drawer di una work associata a 1 metodo → pulsante "Schemi" naviga allo schema. Work con >1 metodo → DropdownMenu con lista metodi.
