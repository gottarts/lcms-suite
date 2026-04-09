# Resoconto sessione — Fix reset schema, selezione automatica e filtro destUso

**Data:** 2026-04-09
**Oggetto:** Tre bug corretti: sgancio work dal metodo al reset schema, Neat senza prep selezionata nell'autoselect, filtro destUso ignorato dalla selezione automatica

---

## Cosa è stato fatto

Sessione interamente dedicata a bugfix. Nessuna nuova feature.

1. Fix del bug per cui "Ricomincia da zero" sullo SchemaCalibrazione sganciava le work dal metodo e dal collegamento in WorkPage.
2. Fix del bug per cui la selezione automatica CRM selezionava una Neat priva di preparazioni come singolo (comportamento errato).
3. Fix del bug per cui la selezione automatica ignorava il filtro Taratura/QC/IS attivo nella griglia (mix e analiti di altre destUso entravano nella selezione).
4. Fix del crash (schermata bianca) causato da destructuring incompleto del `useMemo` introdotto al punto 3.

---

## Bug risolti

### 1. "Ricomincia da zero" sgancia le work dal metodo

**Root cause:** In `schemaCalibrazione.ipc.ts`, sia `schema-cal:save` che `schema-cal:get` contenevano una logica di sincronizzazione `work_metodi` che usava i `dbId` presenti nel JSON come source of truth. Quando il JSON veniva azzerato (`workCols: [[]]`), zero `dbId` → eseguiva `DELETE FROM work_metodi WHERE metodo_id = ?`, eliminando tutti i link work↔metodo per quel metodo. Le work esistevano ancora nel DB ma diventavano orfane: `metodi_ids = []`, `primo_metodo_id = NULL`. In WorkPage sparivano badge metodo e pulsante "Schema ↗".

**Fix:** Rimossi entrambi i blocchi `DELETE FROM work_metodi`. Il `schema-cal:save` ora fa solo `INSERT OR IGNORE` per aggiungere link nuovi, senza mai rimuovere quelli esistenti. I link orfani (work davvero eliminate) sono già gestiti dall'`ON DELETE CASCADE` sulla FK `work_metodi.work_id → work(id)`. Il `schema-cal:get` è ora un semplice GET senza side effect.

**Principio:** le work già create sono "congelate" — il reset riguarda solo la struttura futura dello schema, non lo storico.

---

### 2. Selezione automatica: Neat senza preparazioni selezionata come singolo

**Root cause:** In `handleAutoSelect` (SchemaCalibrazione.tsx), la logica per i singoli era:
```
if (isNeat && preps.length > 0) → seleziona prep con progressivo maggiore
else → seleziona come singolo (m.set sngId)
```
Il branch `else` catturava anche le Neat senza preparazioni, selezionandole come `tipo: 'sng'` — comportamento errato poiché una Neat va usata solo tramite prep stock.

**Fix:** Cambiato `else` in `else if (!isNeat)`. Le Neat senza preparazioni non vengono aggiunte a `selSrcs` (skip silenzioso).

---

### 3. Selezione automatica ignora il filtro Taratura/QC/IS

**Root cause:** L'`AutoSelectDialog` riceveva `analiti={analitiAll}` e `crmItems={crmItems}` — entrambi non filtrati per `filtroDestUso`. Inoltre `firmaToMixIds` e `mixNomiMap` passati al dialog erano le mappe globali calcolate su tutti i CRM in `useSchemaData`, quindi `buildMixComposizioni` internamente raggruppava mix di tutte le destUso, portando mix non visibili nella griglia nel risultato della selezione automatica.

**Fix in due passi:**

1. Passato all'`AutoSelectDialog` `analiti={analitiAllFiltrati}` e `crmItems={crmItemsPerDestUso}` (già calcolati e filtrati per destUso).
2. Modificato il `useMemo` che calcola `crmItemsPerDestUso` per estrarre anche `firmaToMixIds` e `mixNomiMap` filtrate (`firmaToMixIdsFiltrati`, `mixNomiMapFiltrati`) da `buildAnalitiData`, e passarle all'`AutoSelectDialog` al posto delle mappe globali.

---

### 4. Schermata bianca al click su "Selezione automatica"

**Root cause:** Il destructuring del `useMemo` che calcola `crmItemsPerDestUso` era rimasto `const { crmItemsPerDestUso, analitiAllFiltrati } = useMemo(...)` ma il corpo del memo ora restituiva anche `firmaToMixIdsFiltrati` e `mixNomiMapFiltrati`. Le due variabili erano quindi `undefined` a runtime, causando un crash React nel render dell'`AutoSelectDialog` (schermata bianca).

**Fix:** Aggiunto il destructuring completo: `const { crmItemsPerDestUso, analitiAllFiltrati, firmaToMixIdsFiltrati, mixNomiMapFiltrati } = useMemo(...)`.

---

## File modificati

| File | Modifica |
|------|----------|
| `src/main/ipc/schemaCalibrazione.ipc.ts` | Rimossi tutti i `DELETE FROM work_metodi`; `schema-cal:get` ora è puro GET; `schema-cal:save` solo `INSERT OR IGNORE` |
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | Fix Neat senza prep; fix destUso in AutoSelectDialog (analiti, crmItems, firmaToMixIds, mixNomiMap filtrati); fix destructuring useMemo |

---

## Note per sessioni future

- Il piano di questa sessione è in `~/.claude/plans/jolly-drifting-feather.md` (solo il primo bug, gli altri sono emersi durante la sessione).
- Il `schema-cal:get` era un posto inaspettato per side effect: attenzione in futuro se si aggiungono altre logiche di cleanup passive simili altrove.
- Il `useMemo` per `crmItemsPerDestUso` ora restituisce 4 campi — se si aggiungono altre derivazioni filtrate, aggiornare il destructuring in testa.
- La logica Neat/prep nell'autoselect è ora coerente con quella manuale (`togglePrepStock`): sempre e solo via prep stock se Neat.
