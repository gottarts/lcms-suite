# Resoconto sessione — Fix Lavagna: nodo analiti, drag fluido, selezione, frecce bezier

**Data:** 2026-04-19
**Oggetto:** Serie di fix e miglioramenti alla vista Lavagna dello Schema di Calibrazione

---

## Cosa è stato fatto

Sessione di fix iterativi sulla vista Lavagna (`SchemaCalibrazione.lavagna.tsx`):

1. Colonna Analiti spostata dalla sidebar DOM al canvas React Flow come nodo draggabile
2. Card a dimensione adattiva (rimosso `overflow: hidden`)
3. Frecce cambiate da `smoothstep` (angoli retti) a `default` (bezier curve)
4. Spaziature aumentate (ROW_GAP 60→80, ranksep 180→280) per ridurre sovrapposizioni
5. Drag fluido con `useNodesState` invece di ricostruire i nodi da positions ad ogni render
6. MiniMap rimossa
7. Selezione interattiva: click su card o freccia evidenzia i nodi/edge connessi
8. Fix sfarfallio hover analiti: aggiornamento `highlighted` chirurgico separato dalla struttura nodi
9. Fix frecce griglia che scomparivano dopo il passaggio lavagna→griglia

---

## Bug risolti / Feature aggiunte

### Analiti come nodo React Flow
**Motivazione:** La sidebar fissa DOM era fuori dal canvas, non draggabile e senza frecce verso i CRM.
**Fix:** Rimosso `SidebarAnaliti` dal layout esterno. Creato `AnalitiNode` (custom node RF) con stesso contenuto. Aggiunto `computeAnalitiEdges()` che genera frecce dal nodo analiti verso i moduli Mix/Sng corrispondenti. Posizione persistita in localStorage come gli altri nodi.

### Frecce bezier
**Motivazione:** `smoothstep` produce spezzate ortogonali, l'utente voleva curve morbide come in origine.
**Fix:** `type: 'smoothstep'` → `type: 'default'` in `computeEdges()` e `defaultEdgeOptions`.

### Card adattive
**Motivazione:** `overflow: hidden` in `CardBase` tagliava il contenuto delle card lunghe.
**Fix:** Rimosso `overflow: hidden`. L'altezza ora è automatica.

### Drag fluido + card visibile durante spostamento
**Motivazione:** Il pattern precedente ricostruiva tutti i nodi da `positions` ad ogni change, causando jank e invisibilità della card durante il drag.
**Fix:** Usato `useNodesState` di React Flow. RF gestisce le posizioni internamente; la persistenza in localStorage avviene solo al `mouseup` (quando `ch.dragging === false`).

### Selezione nodi e frecce
**Motivazione:** Richiesta UX: click su card o freccia per evidenziare i collegamenti.
**Fix:** `selectedId` state + `onNodeClick`/`onEdgeClick`/`onPaneClick`. Gli edge connessi al nodo selezionato diventano animati e spessi (2.5px), gli altri sbiadiscono al 15% opacità. I nodi connessi ricevono `highlighted: true`. L'outline nativo di RF soppressa via CSS globale.

### Fix sfarfallio hover analiti
**Root cause:** `highlightedIds` era nelle dipendenze di `initialNodes`, che triggerava `setRfNodes(initialNodes)` ad ogni hover — sostituendo tutti i nodi incluse le posizioni.
**Fix:** Separati due `useEffect` distinti:
- Strutturale: aggiorna posizioni/meta senza toccare `highlighted`
- Highlight: aggiorna solo il flag `highlighted` chirurgicamente con `setRfNodes(prev => prev.map(...))`

### Fix frecce griglia scomparse dopo passaggio lavagna→griglia
**Root cause:** Il `ConnectionsOverlay` veniva smontato quando `vista === 'lavagna'`. Al ritorno, veniva rimontato ma `useLayoutEffect` trovava `cardRefs` vuoto, produceva `lines = []`, e `if (lines.length === 0 && size.w === 0) return null` lo smontava di nuovo prima che le card si registrassero.
**Fix:** La griglia non viene più smontata — usa `display: vista === 'griglia' ? 'flex' : 'none'`. Il container, l'overlay e tutti i ref rimangono vivi in memoria. La lavagna viene montata/smontata separatamente con un `{vista === 'lavagna' && <SchemaLavagna>}`.

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/metodi/SchemaCalibrazione.lavagna.tsx` | Nodo AnalitiNode, computeAnalitiEdges, useNodesState, selezione nodi/edge, fix sfarfallio hover, bezier, spaziature, rimossa MiniMap |
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | Fix frecce griglia: display:none invece di smontare, ConnectionsOverlay con updateRef |
| `src/renderer/styles/globals.css` | Soppressione outline selezione nativo React Flow |

---

## Note per sessioni future

- Il nodo `ANALITI` ha posizione default calcolata a sinistra dei mix (`COL_X.mix - ANALITI_NODE_W - 80`). Se l'utente fa "Riallinea", il nodo analiti viene riposizionato tramite `useLavagnaPositions` che include `ANALITI_NODE_ID` nelle posizioni persistite.
- Gli edge analiti→CRM hanno opacità 0.5 e strokeWidth 1.2 per distinguerli dagli edge strutturali (opacità 0.9, strokeWidth 1.6).
- `SidebarAnaliti` è rimasta nel file come dead code — può essere rimossa in una sessione futura.
- Il pattern "due useEffect separati per struttura e highlight" è fragile: se in futuro si aggiungono altri dati dinamici ai nodi, occorre aggiungere un terzo effect chirurgico per non innescare rebuild strutturale.
- `display: none` sulla griglia significa che GrigliaAnalitiCrm e ColonneWork sono sempre montati — controllare impatto performance se i dati diventano molto grandi.
