# Piano: Fix frecce SVG statiche su scroll verticale griglia

## Context
Le frecce SVG (ConnectionsOverlay) non si aggiornano quando l'utente scrolla verticalmente dentro la griglia CRM/Analiti. Il listener scroll è registrato sul `workspaceRef` (scroll orizzontale, `overflowX:auto`), ma lo scroll verticale avviene nel corpo interno di `GrigliaAnalitiCrm` (`overflowY:auto`), che è un elemento DOM distinto. I scroll events **non bubblano**, quindi il listener sul wrapper non intercetta lo scroll figlio. `computeConnections` usa `getBoundingClientRect()` (viewport-relative) che cambia quando la griglia scrolla, ma non viene ricalcolato.

## Approccio
Esporre un ref al corpo scrollabile di `GrigliaAnalitiCrm` verso il parent, passarlo a `ConnectionsOverlay`, e aggiungere un secondo scroll listener su quel elemento.

Nessuna modifica a `computeConnections` — il calcolo coordinate è già corretto.

## File critici
- `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx` — GrigliaAnalitiCrm
- `src/renderer/pages/metodi/SchemaCalibrazione.tsx` — ConnectionsOverlay + componente principale

## Passi

### 1. `SchemaCalibrazione.grid.tsx`
- Aggiungere `gridBodyRef?: React.RefObject<HTMLDivElement | null>` a `GrigliaProps`
- In `GrigliaAnalitiCrm`, passare `ref={gridBodyRef}` al div del corpo scrollabile (riga 175): `<div style={{ flex:1, overflowY:'auto', ... }}>`

### 2. `SchemaCalibrazione.tsx` — ConnectionsOverlay
- Aggiungere prop `gridScrollRef?: React.RefObject<HTMLDivElement | null>` al tipo inline di `ConnectionsOverlay`
- Nel `useLayoutEffect` (righe 46-60), dopo aver registrato il listener su `el`, aggiungere:
  ```ts
  const grid = gridScrollRef?.current
  if (grid) grid.addEventListener('scroll', update, { passive: true })
  return () => {
    ro.disconnect()
    el.removeEventListener('scroll', update)
    if (grid) grid.removeEventListener('scroll', update)
  }
  ```

### 3. `SchemaCalibrazione.tsx` — componente principale
- Creare `const gridBodyRef = useRef<HTMLDivElement>(null)` vicino agli altri ref (riga ~578)
- Passare `gridBodyRef={gridBodyRef}` a `<GrigliaAnalitiCrm>` (riga 836)
- Passare `gridScrollRef={gridBodyRef}` a `<ConnectionsOverlay>` (riga 831)

## Verifica
1. Aprire SchemaCalibrazione con un metodo che ha molti analiti (abbastanza da causare scroll verticale)
2. Aggiungere almeno una Work con sorgenti selezionate → le frecce appaiono
3. Scorrere verticalmente la griglia → le frecce si spostano in tempo reale seguendo le card
4. Scorrere orizzontalmente il workspace → le frecce continuano ad aggiornarsi (regressione check)
