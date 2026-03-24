# Resoconto sessione — Fix frecce SVG statiche su scroll verticale griglia

**Data:** 2026-03-24
**Oggetto:** Le frecce di connessione SVG (ConnectionsOverlay) non si aggiornano quando si scrolla verticalmente la griglia CRM/Analiti in SchemaCalibrazione.

---

## Cosa è stato fatto

Risolto il bug per cui le frecce SVG che collegano le card sorgente (Mix/Singoli) alle card Work rimanevano ferme quando l'utente scrollava verticalmente dentro la griglia CRM/Analiti, puntando a posizioni sbagliate.

---

## Bug risolti

### Frecce SVG statiche rispetto allo scroll verticale della griglia

**Root cause:** I scroll events DOM non bubblano. Il listener `scroll` era registrato su `workspaceRef` (il div con `overflowX:auto`), ma lo scroll verticale avviene dentro il corpo di `GrigliaAnalitiCrm` (`<div overflowY:auto>`), un elemento DOM separato. Quando la griglia scrollava, `getBoundingClientRect()` delle card cambiava, ma `update()` (che ricalcola le connessioni) non veniva mai chiamata.

**Fix:** Esposto un `gridBodyRef` dal corpo scrollabile di `GrigliaAnalitiCrm` verso il parent. `ConnectionsOverlay` ora registra un secondo listener `scroll` su `gridBodyRef.current`, in aggiunta a quello già esistente su `workspaceRef`. Nessuna modifica a `computeConnections`: il calcolo con `getBoundingClientRect()` era già corretto, mancava solo il trigger.

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx` | Aggiunta prop `gridBodyRef?: React.RefObject<HTMLDivElement \| null>` a `GrigliaProps`; aggiunto `ref={gridBodyRef}` al div corpo scrollabile (riga ~175); aggiunto `import React` |
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | Aggiunta prop `gridScrollRef` a `ConnectionsOverlay`; secondo `addEventListener('scroll', update)` nel `useLayoutEffect` con cleanup; aggiunto `const gridBodyRef = useRef<HTMLDivElement>(null)` nel componente principale; passato ai due componenti |

---

## Note per sessioni future

- Il bug era già documentato nel resoconto precedente (`docs/plans/completed/2026-03-24-schema-fix-chip-layout-resoconto-sessione.md`, sezione "Bug ancora aperti").
- Il fix è puramente di wiring DOM (ref + listener) — nessun cambiamento alla logica di calcolo coordinate.
- Se in futuro si aggiungono altri container scrollabili interni allo schema (es. ColonneWork con scroll proprio), andrà applicato lo stesso pattern: esporre il ref e aggiungerlo al `useLayoutEffect` di `ConnectionsOverlay`.
