# Piano: Bugfix apertura automatica ScenarDialog

## Context

Quando si apre lo schema di un metodo i cui analiti non hanno miscele (CRM mix), il selettore scenario si apre automaticamente ma non è chiudibile perché non ci sono scenari da scegliere. Questo blocca l'utente che deve riavviare l'app.

**Causa**: il `useEffect` in SchemaCalibrazione.tsx (riga ~823) chiama `setScenarOpen(true)` basandosi solo sul flag `scenarioScelto` (mai impostato → apri dialog), senza verificare se esistono effettivamente scenari CRM mix da mostrare.

**Fix**: prima di aprire automaticamente il dialog, verificare che ci siano composizioni CRM mix rilevanti. Se `firmaToMixIds` è vuota o genera 0 composizioni utili, non aprire il dialog (e segnare `scenarioScelto = true` implicitamente tramite salvataggio o semplicemente non aprendo).

---

## Approccio

### Dove intervenire

File: `src/renderer/pages/metodi/SchemaCalibrazione.tsx`, useEffect riga ~816-826.

### Logica da aggiungere

Nel `useEffect` che auto-apre il dialog, prima di `setScenarOpen(true)`, calcolare le composizioni disponibili usando `buildMixComposizioni` (già esportata da `SchemaCalibrazione.scenari.ts`) e i dati già disponibili in quel momento (`analitiAll`, `crmItems`, `firmaToMixIds`, `mixNomiMap`, `removedMix`).

Condizioni per **non** aprire il dialog automaticamente:
1. **Nessuna composizione** (nessun CRM mix): `composizioni.length === 0`
2. **Un solo scenario possibile** (scelta banale): `generaScenari(analitiAll, composizioni).length <= 1`

In questi casi il dialog non serve: saltare `setScenarOpen(true)` e impostare `setScenarioScelto(true)` così non si riapre ai reload successivi.

### Codice target

```typescript
// SchemaCalibrazione.tsx ~riga 816-826 (PRIMA)
useEffect(() => {
  if (loading || schemaLoaded) return
  schemaCalApi.get(metodoId).then(saved => {
    if (saved?.workCols) setWorkCols(saved.workCols)
    if (saved?.removedMix) setRemovedMix(new Set(saved.removedMix))
    const giàScelto = !!saved?.scenarioScelto
    setScenarioScelto(giàScelto)
    if (!giàScelto) setScenarOpen(true)
    setSchemaLoaded(true)
  }).catch(() => { setScenarOpen(true); setSchemaLoaded(true) })
}, [loading, metodoId, schemaLoaded])
```

```typescript
// DOPO
useEffect(() => {
  if (loading || schemaLoaded) return
  schemaCalApi.get(metodoId).then(saved => {
    if (saved?.workCols) setWorkCols(saved.workCols)
    const savedRemovedMix = new Set<string>(saved?.removedMix ?? [])
    if (saved?.removedMix) setRemovedMix(savedRemovedMix)
    const giàScelto = !!saved?.scenarioScelto
    setScenarioScelto(giàScelto)
    if (!giàScelto) {
      // Apri dialog solo se ci sono ≥2 scenari CRM mix tra cui scegliere
      const comps = buildMixComposizioni(analitiAll, crmItems, firmaToMixIds, mixNomiMap)
        .filter(c => c.mixIds.some(mid => !savedRemovedMix.has(mid)))
      const scenari = generaScenari(analitiAll, comps)
      if (scenari.length > 1) {
        setScenarOpen(true)
      } else {
        setScenarioScelto(true)
      }
    }
    setSchemaLoaded(true)
  }).catch(() => { setScenarOpen(true); setSchemaLoaded(true) })
}, [loading, metodoId, schemaLoaded])
```

### Import da aggiungere

`buildMixComposizioni` e `generaScenari` sono già in `SchemaCalibrazione.scenari.ts` — verificare se sono già importate in SchemaCalibrazione.tsx o se vanno aggiunte all'import esistente.

---

## File critici

- `src/renderer/pages/metodi/SchemaCalibrazione.tsx` — useEffect riga ~816-826, import riga ~top
- `src/renderer/pages/metodi/SchemaCalibrazione.scenari.ts` — `buildMixComposizioni`, `generaScenari` (sola lettura)

---

## Verifica

1. Aprire schema di un metodo **senza** CRM mix → dialog NON si apre, schema si carica normalmente
2. Aprire schema con **un solo** CRM mix (1 scenario) → dialog NON si apre
3. Aprire schema con **più** CRM mix con composizioni diverse (≥2 scenari) → dialog si apre normalmente
4. Aprire schema già salvato con `scenarioScelto = true` → dialog non si apre (comportamento invariato)
