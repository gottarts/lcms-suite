# Piano: Fix CRM Mix card + Work card schema + WorkPage buttons

## Context
Tre problemi distinti identificati dallo schema calibrazione e dalla pagina work:
1. La card CRM Mix nello schema cancella visivamente i nomi dei composti (strikethrough/opacity) quando si rimuove un concomitante — comportamento non voluto, il mix deve solo essere riportato senza formattazioni.
2. Nella card work dello schema calibrazione compare il campo "Operatore" che non serve in quel contesto.
3. Nella WorkCard della WorkPage mancano due pulsanti: "Prepara work" e "Collegamento allo schema work".

---

## Fix 1 — CRM Mix card: rimuovere formattazioni sui chip dei composti

**File**: `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx`

Rimossi `opacity` e `textDecoration` condizionali dai chip dei nomi composti nel mix. I nomi vengono sempre mostrati senza formattazioni visive quando si rimuove un concomitante.

---

## Fix 2 — Rimuovere campo "Operatore" dalla card work nello schema calibrazione

- `src/renderer/pages/metodi/SchemaCalibrazione.tsx`: rimosso display `Op: {w.op}` dalla card work
- `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx`: rimossi state `op`/`setOp`, input nel modal e campo nel save handler

---

## Fix 3 — Aggiungere pulsanti "Prepara work" e "Schema" nella WorkCard

- `src/main/ipc/work.ipc.ts`: aggiunto `primo_metodo_id` nella query `work:list`
- `src/renderer/pages/work/WorkPage.tsx`: aggiunti pulsanti Prepara/Rinnova e Schema ↗ nella WorkCard
- `src/renderer/pages/metodi/MetodiPage.tsx`: legge `schemaMetodoId` dallo state di navigazione react-router
