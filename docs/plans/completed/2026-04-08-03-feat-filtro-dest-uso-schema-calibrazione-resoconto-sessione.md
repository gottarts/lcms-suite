# Resoconto sessione — Filtro destinazione d'uso nello Schema di Calibrazione

**Data:** 2026-04-08
**Oggetto:** Aggiunta del selettore Taratura / QC / IS per filtrare i CRM visibili nella griglia dello schema di calibrazione in base al campo `destinazione_uso`

---

## Cosa è stato fatto

Implementato un sistema di filtro per la griglia CRM dello SchemaCalibrazione. Un nuovo ButtonGroup nella bottom bar permette di scegliere tra tre modalità:
- **Taratura**: mostra CRM con `destinazione_uso` = "Taratura" o "Taratura+Controllo qualità", più CRM senza dest. classificata
- **QC**: mostra CRM con `destinazione_uso` = "Controllo qualità" o "Taratura+Controllo qualità", più CRM senza dest. classificata
- **IS**: mostra solo CRM con `destinazione_uso` = "Standard Interno" (surrogati marcati isotopici)

Le Work (colonne destra) restano sempre tutte visibili. Il filtro agisce solo sui lotti CRM selezionabili.

---

## Bug risolti / Feature aggiunte

### Feature: Selettore Taratura / QC / IS
**Motivazione:** Nella griglia, analiti target e IS erano mescolati. I lotti di diversa destinazione (es. lotto Taratura vs lotto QC dello stesso mix) erano indistinguibili.
**Implementazione:**
- `DestUso` type + `destinazione_uso` su `CrmItem` in `types.ts`
- `matchesFiltroDestUso` + parametro opzionale `filtroDestUso` a `buildAnalitiData` in `logic.ts`
- State `filtroDestUso` + `useMemo` per `crmItemsPerDestUso`/`analitiAllFiltrati` in `SchemaCalibrazione.tsx`
- ButtonGroup Taratura/QC/IS nella bottom bar con colori palette esistente

### Bug: Lotto QC sbarrato (barrato/disabilitato) quando si seleziona filtro QC
**Root cause:** Il lotto QC aveva `mix_id` diverso dal lotto Taratura (stessa composizione, lotti diversi). Lo scenario aveva scelto il lotto Taratura → il lotto QC finiva in `removedMix`. Passando al filtro QC, `crmItemsPerDestUso` conteneva solo il lotto QC, ma `removedMixEffettivo` (che ora viene passato alla griglia) non rimuoveva il flag — la card appariva sbarrata.
**Fix:** Introdotto `removedMixEffettivo`: calcola un `removedMix` derivato che esclude i `mix_id` che sono l'unico lotto disponibile per la loro firma nel filtro corrente. Passato alla griglia al posto di `removedMix` raw.

### Bug: Logica QC includeva lotti "Taratura" puri
**Root cause:** La condizione QC era `d.includes('controllo') || d.includes('taratura')` — includeva i lotti Taratura puri perché "Taratura" matcha `d.includes('taratura')`.
**Fix:** Cambiato in `d.includes('controllo')` — cattura "Controllo qualità" e "Taratura+Controllo qualità" senza includere "Taratura" puro.

### Comportamento CRM senza `destinazione_uso`
**Decisione:** CRM con `destinazione_uso = null` sono visibili in Taratura e QC (non in IS). Logica: `if (!dest) return filtro !== 'is'`. Questo preserva la visibilità dei lotti storici non classificati.

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/metodi/SchemaCalibrazione.types.ts` | Aggiunto tipo `DestUso`, campo `destinazione_uso: string \| null` a `CrmItem` |
| `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts` | Aggiunto `matchesFiltroDestUso`, parametro `filtroDestUso` a `buildAnalitiData`, campo `destinazione_uso` nel mapping CrmItem |
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | State `filtroDestUso`, `useMemo` per filtraggio CRM, `removedMixEffettivo`, ButtonGroup nella bottom bar |

---

## Note per sessioni future

- Il piano è in `docs/plans/active/2026-04-08-03-feat-filtro-dest-uso-schema-calibrazione-plan.md`
- `removedMixEffettivo` è solo per la visualizzazione griglia — `removedMix` raw continua ad essere usato per la logica di scenario e il salvataggio schema. Non confonderli.
- Il filtro NON viene salvato in `schema_json` — è una vista locale, default `'taratura'` ad ogni apertura.
- I CRM con `dest = null` compaiono in Taratura e QC: se in futuro si vuole classificarli, basta aggiornare il campo nel DB Composti.
- La selezione automatica (AutoSelectDialog) e gli scenari (ScenarDialog) usano ancora `analitiAll` / `crmItems` non filtrati — corretto perché la scelta scenario deve avvenire sul set completo.
