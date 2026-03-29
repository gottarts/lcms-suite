# Piano: Scenari di copertura CRM Mix nello Schema Calibrazione

## Context

Nella colonna CRM Mix dello Schema Calibrazione, alcuni analiti compaiono in più mix con composizioni diverse — il che rende impossibile selezionarli entrambi contemporaneamente (i mix devono essere disgiunti per analiti). La soluzione proposta è un pulsante nell'intestazione della colonna CRM Mix che apre un dialog con scenari di copertura ottimali, generati algoritmicamente. L'utente clicca uno scenario e questo viene applicato subito (aggiorna i mix selezionati), con la possibilità di espandere ogni scenario per vedere quali analiti coprono e quali no.

---

## File da creare / modificare

| File | Tipo |
|------|------|
| `src/renderer/pages/metodi/SchemaCalibrazione.scenari.ts` | **NUOVO** — algoritmo puro |
| `src/renderer/pages/metodi/ScenarDialog.tsx` | **NUOVO** — dialog UI |
| `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts` | **MODIFICA** — esporre `firmaToMixIds` e `mixNomiMap` |
| `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx` | **MODIFICA** — pulsante header + nuovi props |
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | **MODIFICA** — wiring state + dialog |

---

## Step 1 — `SchemaCalibrazione.scenari.ts` (nuovo)

Modulo puro TypeScript, no React.

```typescript
export interface MixComposizione {
  firma: string          // chiave composizione (nomi componenti ordinati, join ',')
  mixIds: string[]       // tutti i lotti con questa composizione
  analiti: Set<string>   // analiti della schema coperti da questa composizione
  nomeDisplay: string    // nome commerciale (da primo mix_id)
}

export interface Scenario {
  composizioni: MixComposizione[]   // mix selezionati nello scenario
  copertura: number                 // 0..1
  analitiCoperti: string[]          // in ordine, raggruppati per mix
  analitiNonCoperti: string[]       // analiti non coperti
}
```

### `buildMixComposizioni(analiti, crmItems, firmaToMixIds, mixNomiMap)`
- Per ogni firma in `firmaToMixIds`, calcola l'intersezione dei componenti con `analiti.map(a => a.nome)`
- Scarta firme con `analiti.size === 0`
- Ritorna `MixComposizione[]`

### `generaScenari(analiti, composizioni)`
Implementazione dell'algoritmo da `scenari_idea.txt`:

```
mix_non_ancora_usati = tutte le composizioni
scenari = []

// Scenario 1
best = trovaScenarioMigliore(composizioni, mandatory=null)
scenari.push(best)
mix_non_ancora_usati -= composizioni di best

// Scenari successivi
while mix_non_ancora_usati non vuoto:
    best_coverage = -1
    for Mx in mix_non_ancora_usati:
        s = trovaScenarioMigliore(composizioni, mandatory=Mx)
        if s.copertura > best_coverage → aggiorna best
    if best_coverage === 0 → break
    scenari.push(best_scenario)
    mix_non_ancora_usati.remove(mix_scelto)
```

### `trovaScenarioMigliore(composizioni, mandatory?)`
- Se `|composizioni| ≤ 15`: backtracking esatto con pruning (ordinare per `|analiti|` desc)
- Se `|composizioni| > 15`: greedy (aggiunge iterativamente il mix con più analiti non ancora coperti)
- Ritorna `{ firme: string[], copertura: number }`

---

## Step 2 — `SchemaCalibrazione.logic.ts` (modifica minima)

`firmaToMixIds` e `mixNomiMap` sono già computati dentro `load()` ma non restituiti. Aggiungere:
- Due `useState` nel hook: `firmaToMixIds` e `mixNomiMap`
- Chiamate `setFirmaToMixIds(...)` e `setMixNomiMap(...)` dentro `load()` prima di `setAnaliti`
- Aggiungere entrambi all'oggetto di ritorno del hook

---

## Step 3 — `ScenarDialog.tsx` (nuovo)

**Props:**
```typescript
interface ScenarDialogProps {
  open: boolean
  analiti: AnalitoItem[]
  crmItems: CrmItem[]
  firmaToMixIds: Map<string, string[]>
  mixNomiMap: Map<string, Set<string>>
  removedMix: Set<string>
  onClose: () => void
  onApply: (mixIds: string[]) => void
}
```

**Logica interna:**
- `useMemo`: `buildMixComposizioni(...)` → filtra firme con mix_ids tutti in `removedMix`
- `useMemo`: `generaScenari(analiti, composizioni)`
- `useState<number | null>(expandedIdx)` — quale scenario è espanso

**UI (stile inline, palette `C` da types.ts, IBM Plex Mono):**

```
┌─────────────────────────────────────────┐
│  Scenari di copertura CRM Mix       [×] │
├─────────────────────────────────────────┤
│  1) ██████████████░░░░  19/20 (95%)     │
│     M1, M2, M3, M4, M5, M6, M7  [↗]   │
│     (espanso: analiti per mix + non cop)│
│                                         │
│  2) ████████░░░░░░░░░░  14/20 (70%)     │
│     M8, M4, M5, M6, M7           [↗]   │
└─────────────────────────────────────────┘
```

- Ogni riga scenario: barra di copertura + "N/tot (X%)" + nomi mix (chips)
- Icona `↗` / freccia per espandere/collassare dettaglio
- **Click sulla riga → applica subito + chiude**: chiama `onApply(mixIds)` dove `mixIds` = primo lot per ogni firma dello scenario (`firmaToMixIds.get(firma)![0]`)
- Dettaglio espanso (toggle separato dal click-applica, es. click sull'icona `↗`):
  - Analiti coperti raggruppati per mix (nome mix + lista analiti)
  - Analiti non coperti in grigio

**Nota implementativa**: distinguere click su riga (applica) da click sull'icona espansione (toggle dettaglio senza applicare).

---

## Step 4 — `SchemaCalibrazione.grid.tsx` (modifica)

**A. Aggiungere a `GrigliaProps`:**
```typescript
firmaToMixIds: Map<string, string[]>
mixNomiMap: Map<string, Set<string>>
onOpenScenar: () => void
```

**B. Header CRM Mix (linee 209–225):** special-case `i === 1` per aggiungere il pulsante sotto il sub-label:
```jsx
{i === 1 && (
  <button onClick={onOpenScenar} title="Scenari di copertura" style={{...}}>
    ◎ Scenari
  </button>
)}
```

---

## Step 5 — `SchemaCalibrazione.tsx` (modifica)

**A.** Destrutturare `firmaToMixIds` e `mixNomiMap` da `useSchemaData`.

**B.** Aggiungere `const [scenarOpen, setScenarOpen] = useState(false)`.

**C.** Callback `handleApplyScenario(mixIds: string[])`:
- Rimuove tutte le entries `tipo === 'mix'` da `selSrcs`
- Aggiunge le nuove entries per i `mixIds` ricevuti
- Rimuove i `mixIds` da `removedMix`
- Chiama `setScenarOpen(false)`

**D.** Passare `firmaToMixIds`, `mixNomiMap`, `onOpenScenar` a `GrigliaAnalitiCrm`.

**E.** Renderizzare `<ScenarDialog>` quando `scenarOpen === true`.

---

## Edge cases

- Nessun mix disponibile: dialog mostra "Nessun CRM Mix disponibile"
- Tutti i mix si sovrappongono: ogni scenario ha un solo mix
- Mix con zero analiti del metodo: esclusi da `buildMixComposizioni`
- Dialog non apribile durante caricamento: pulsante disabilitato se `analiti.length === 0`
- `removedMix`: filtrati prima di passare a `buildMixComposizioni`

---

## Verifica

1. Aprire uno Schema Calibrazione con analiti che hanno mix sovrapposti
2. Verificare che il pulsante "◎ Scenari" compaia nell'intestazione CRM Mix
3. Aprire il dialog: verificare che la lista scenari sia nell'ordine corretto (coverage desc per scenario 1, poi uno per mix non ancora usato)
4. Espandere uno scenario: verificare analiti coperti/non coperti
5. Cliccare uno scenario: verificare che la colonna CRM Mix si aggiorni con i mix dello scenario selezionato
6. Verificare che `removedMix` venga svuotato per i mix riapplicati
