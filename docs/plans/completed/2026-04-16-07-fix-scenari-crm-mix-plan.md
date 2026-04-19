# Piano: Fix bug Scenari CRM Mix

## Context

Il dialog Scenari mostra sempre "Nessun CRM Mix disponibile" per tutti gli schemi, anche con mix presenti. Ci sono tre bug distinti:

**Bug 1 (principale) — case mismatch nei nomi analiti**
`metodo-analiti:list` restituisce i nomi con il case originale del DB (es. `"PARATHION-ETHYL"`).
`composti:list-for-schema` carica i `CrmItem` con i nomi dei componenti come salvati (es. `"Parathion-ethyl"`).
In `buildMixComposizioni` (scenari.ts:40–59) il confronto è case-sensitive:
```ts
const analitiNomi = new Set(analiti.map(a => a.nome))  // "PARATHION-ETHYL"
if (analitiNomi.has(n)) ...                             // cerca "Parathion-ethyl" → MISS
```
Risultato: `analitiCoperti.size === 0` per tutte le composizioni → tutte scartate → scenari vuoti.

**Bug 2 — 1 solo scenario viene saltato silenziosamente**
In `SchemaCalibrazione.tsx:512`, il dialog si apre solo se `scenari.length > 1`. Con una sola mix disponibile, viene auto-applicato `setScenarioScelto(true)` senza chiamare `handleApplyScenario`, quindi `removedMix` non viene mai impostato.

**Bug 3 — con 0 mix "Ricomincia da zero" blocca l'app**
`handleFullReset` apre il dialog incondizionatamente (`setDialogs scenar: true`) con `obbligatorio=true`. Se non ci sono mix, il dialog mostra "Nessun CRM Mix disponibile" e non è chiudibile → app bloccata.

---

## File da modificare

- `src/renderer/pages/metodi/SchemaCalibrazione.scenari.ts` — fix case mismatch
- `src/renderer/pages/metodi/SchemaCalibrazione.tsx` — fix soglia apertura dialog + fix reset

---

## Modifiche

### Fix 1 — `SchemaCalibrazione.scenari.ts`, funzione `buildMixComposizioni` (righe 40–70)

Normalizzare tutto in lowercase nel confronto. Il `Set` degli analiti del metodo viene costruito in lowercase, e i nomi dei componenti della mix vengono confrontati in lowercase. I nomi salvati in `analitiCoperti` restano in lowercase (coerente con il resto della pipeline).

```ts
// Attuale (riga 40)
const analitiNomi = new Set(analiti.map(a => a.nome))

// Nuovo
const analitiNomi = new Set(analiti.map(a => a.nome.toLowerCase()))
```

```ts
// Attuale (righe 57–60)
const analitiCoperti = new Set<string>()
for (const n of nomiComp) {
  if (analitiNomi.has(n)) analitiCoperti.add(n)
}

// Nuovo
const analitiCoperti = new Set<string>()
for (const n of nomiComp) {
  const nl = n.toLowerCase()
  if (analitiNomi.has(nl)) analitiCoperti.add(nl)
}
```

Anche in `_buildScenario` (riga 328) il confronto `comp.analiti.has(n)` usa i nomi di `analitiNomi` (riga 229) — questi devono essere lowercased allo stesso modo:

```ts
// Attuale (riga 229)
const analitiNomi = analiti.map(a => a.nome)

// Nuovo
const analitiNomi = analiti.map(a => a.nome.toLowerCase())
```

### Fix 2 — `SchemaCalibrazione.tsx`, useEffect caricamento schema (riga 512)

Cambiare la soglia da `> 1` a `>= 1` così il dialog si apre anche con un solo scenario. Il caso `else` (0 scenari = nessuna mix) setta `scenarioScelto(true)` senza aprire nulla — corretto.

```ts
// Attuale
if (scenari.length > 1) {
  setDialogs(d => ({ ...d, scenar: true }))
} else {
  setScenarioScelto(true)
}

// Nuovo
if (scenari.length >= 1) {
  setDialogs(d => ({ ...d, scenar: true }))
} else {
  // Nessuna mix disponibile: non aprire il dialog
  setScenarioScelto(true)
}
```

### Fix 3 — `SchemaCalibrazione.tsx`, `handleFullReset` (righe 555–564)

Rimuovere l'apertura esplicita del dialog e usare `setSchemaLoaded(false)` invece di `true`, così il `useEffect` di caricamento si ri-attiva dopo `reload()` e gestisce l'apertura del dialog solo se ci sono mix.

```ts
// Attuale
const handleFullReset = useCallback(async () => {
  await schemaCalApi.save(metodoId, [[]], [], [], false)
  setWorkCols([[]])
  setRemovedMix(new Set())
  setSelSrcs(new Map())
  setScenarioScelto(false)
  setDialogs(d => ({ ...d, scenar: true }))
  setSchemaLoaded(true)
  await reload()
}, [metodoId, reload])

// Nuovo
const handleFullReset = useCallback(async () => {
  await schemaCalApi.save(metodoId, [[]], [], [], false)
  setWorkCols([[]])
  setRemovedMix(new Set())
  setSelSrcs(new Map())
  setScenarioScelto(false)
  setSchemaLoaded(false) // il useEffect si ri-attiva dopo reload e apre dialog solo se ci sono mix
  await reload()
}, [metodoId, reload])
```

---

## Verifica

1. Aprire uno schema con mix disponibili → il dialog Scenari deve mostrare gli scenari (non più "Nessun CRM Mix disponibile")
2. Aprire uno schema con una sola mix → il dialog si apre con 1 scenario selezionabile
3. Aprire uno schema senza mix → nessun dialog, schema usabile normalmente
4. Cliccare "Ricomincia da zero" con mix disponibili → il dialog si apre dopo il reload
5. Cliccare "Ricomincia da zero" senza mix → nessun dialog bloccante
