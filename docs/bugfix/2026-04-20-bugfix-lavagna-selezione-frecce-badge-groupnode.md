# Bugfix — Lavagna: selezione frecce, badge CRM scaduti su Work, GroupNode dimensioni

---

## Problema

1. Click su card mix/sng non evidenziava più le frecce collegate.
2. Mancava il pulsante/stato di selezione Work come sorgente intermedia.
3. GroupNode troppo grande perché i nodi del cluster erano sparsi nel layout iniziale.
4. Badge CRM scaduti mancanti sulle card Work; badge scadenza Mix/Sng erano solo nel body (non nell'header).

---

## Root cause

1. `handleNodeClick` era stato modificato per chiamare `onToggleMix`/`onToggleSng` senza impostare `selectedId`, che è la variabile da cui dipende l'evidenziazione degli edge.
2. Click su nodo Work non chiamava `onToggleWork`, quindi le Work non entravano in `selSrcs`.
3. `computeInitialLayout` non conosceva i cluster, quindi non raggruppava i nodi dello stesso cluster consecutivamente prima di calcolare il bounding box del GroupNode.
4. `WorkNodeData` non aveva campo `alertBadge`; nessuno calcolava la scadenza delle sorgenti di una Work.

---

## Fix

**File:** `src/renderer/pages/metodi/SchemaCalibrazione.lavagna.tsx`

**Fix 1 — frecce:** `handleNodeClick` ora imposta sempre `setSelectedId` (toggle) per tutti i nodi, poi chiama in aggiunta il toggle selSrcs appropriato.

**Fix 2 — Work come sorgente:** aggiunto branch `m.kind === 'work' && onToggleWork` in `handleNodeClick`; `highlightedIdsWithSel` include ora anche Work presenti in `selSrcs`.

**Fix 3 — GroupNode:** `computeInitialLayout` accetta ora `clusters` opzionale; i nodi dello stesso cluster vengono ordinati consecutivamente nella colonna prima di assegnare le Y, minimizzando il bounding box. `useLavagnaPositions` e il suo call site aggiornati di conseguenza.

**Fix 4 — badge Work:** aggiunta funzione `workAlertBadge(work, crmById)` che itera `work.srcs` e calcola il badge peggiore (rosso `CRM SCAD` / arancio `CRM~` per mix/sng scaduti; `NEAT SCAD` / `NEAT~` per prep scadute). Badge aggiunto nell'header della card Work. Badge alert colorati aggiunti anche nell'header di Mix e Sng (erano presenti solo come testo nel body).

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/metodi/SchemaCalibrazione.lavagna.tsx` | handleNodeClick, highlightedIdsWithSel, computeInitialLayout, workAlertBadge, WorkNodeData, ModuloWorkNode, ModuloMixNode, ModuloSngNode |
