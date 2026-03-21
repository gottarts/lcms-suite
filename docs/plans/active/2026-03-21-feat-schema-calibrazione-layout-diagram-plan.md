# Piano — Restyling SchemaCalibrazione: layout diagram-like con frecce e sezioni

**Data:** 2026-03-21
**Stato:** aperto — non ancora implementato
**Oggetto:** Avvicinare il layout di SchemaCalibrazione al design Excalidraw (Schema-work.excalidraw): sezioni trattegiate, frecce SVG curva, card stilizzate

---

## Contesto

Lo SchemaCalibrazione attuale ha un layout a griglia piatta (colonne Analiti | Mix CRM | Singoli | Work) senza connessioni visive tra gli elementi. Il riferimento visivo (Schema-work.excalidraw) mostra un diagramma a nodi e frecce con:

- Frecce curve che collegano i CRM sorgente ai blocchi Work
- Contenitori tratteggiati per raggruppare le sezioni (Analiti, CRM, Work)
- Più spazio tra le sezioni, aspetto "diagram-like"

L'obiettivo è avvicinare la grafica a quel look **mantenendo la struttura attuale dei 4 file e tutte le funzionalità esistenti**.

---

## Approccio — 7 step

### Step 1 — Tipi e interfacce (`SchemaCalibrazione.types.ts`)

- Aggiungere interfaccia `ConnectionLine` (`sourceId`, `targetId`, `sourceType`, `color`)
- Aggiungere tipo per il callback `registerCardRef: (id: string, el: HTMLDivElement | null) => void` nelle props di `GrigliaAnalitiCrm` e `ColonneWork`

### Step 2 — Ref registry + SVG overlay (`SchemaCalibrazione.tsx`)

- `useRef<Map<string, HTMLDivElement>>()` nel componente root per registrare tutti i nodi (Mix, Sng, Work)
- Passare `registerCardRef` come prop a `GrigliaAnalitiCrm` e `ColonneWork`
- `workspaceRef` per il container scrollabile
- Componente interno `ConnectionsOverlay`:
  - SVG `position: absolute`, `pointer-events: none`, dentro il container scrollabile
  - Dimensioni pari a `scrollWidth × scrollHeight` del container
  - Per ogni Work in `workCols`, per ogni `src` in `work.srcs`: path cubico bezier dal bordo destro della card sorgente al bordo sinistro della card Work
  - Colore linea: `src.tipo` → mix: `C.mix.border`, sng: `C.sng.border`, work: `C.work.border`
  - Stile: `stroke-width: 1.5`, `stroke-dasharray: 5 3`, `opacity: 0.55`; arrowhead marker in `<defs>`
  - Ricalcolo con `useLayoutEffect` su `[workCols]` + `ResizeObserver` sul container

### Step 3 — Annotare i ref sulle card (`SchemaCalibrazione.grid.tsx`)

- Card Mix: `ref={el => registerCardRef(mixId, el)}`
- Card Singolo: `ref={el => registerCardRef(sngId, el)}`
- Card Work: `ref={el => registerCardRef(work.id, el)}`

### Step 4 — `computeConnections` (`SchemaCalibrazione.logic.ts`)

```typescript
computeConnections(workCols, cardRefs, scrollContainer) → Array<{x1, y1, x2, y2, color}>
```

- Per ogni Work, per ogni src: `getBoundingClientRect()` di entrambi
- Coordinate relative al `scrollContainer` (sottrarre rect container, aggiungere `scrollLeft`/`scrollTop`)
- Anchor: bordo destro centro (sorgente) → bordo sinistro centro (target)

### Step 5 — Contenitori sezione tratteggiati

- **Analiti:** wrapper `border: 1.5px dashed C.page.brd2`, `border-radius: 10px`, label "Analiti" in alto
- **CRM (Mix + Singoli):** stesso stile, label "CRM"
- **Work:** stesso stile, label "Soluzioni Work"
- Rimuovere i `borderRight` rigidi tra le sezioni, sostituiti dai container + gap

### Step 6 — Stile card migliorato

- `border-radius: 8px` uniforme su tutte le card
- `box-shadow: 0 1px 3px rgba(0,0,0,0.08)` su tutte le card
- `padding: 8px 12px` uniforme
- `borderLeft: 3px solid ${col.border}` come punto di ancoraggio visivo per le frecce
- Selezione: ring animato via `transition` su `box-shadow` (già parzialmente presente)

### Step 7 — Spaziatura layout

- `gap: 20px` nel container workspace tra le sezioni
- ROW: `42px → 48px`
- Colonne Work: `255px → 270px`
- Mix absolute: `left: 8, right: 8`
- `padding: 12px` sul workspace container

---

## File da modificare

| File | Modifiche |
|------|-----------|
| `src/renderer/pages/metodi/SchemaCalibrazione.types.ts` | `+ConnectionLine`, `+registerCardRef` nelle props |
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | `+ref registry`, `+ConnectionsOverlay`, `+section containers Work`, `+spacing` |
| `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx` | `+ref callbacks` su card, `+section containers Analiti/CRM`, `+card styling`, ROW → 48 |
| `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts` | `+computeConnections()` |

---

## Verifica

1. Aprire un metodo con CRM associati → schema mostra 3 sezioni con bordi tratteggiati
2. Le card hanno ombra sottile e `border-left` colorato
3. Creare una Work → appaiono frecce curve dai CRM sorgente alla card Work
4. Scroll orizzontale → le frecce restano allineate
5. Aggiungere una colonna intermedia → frecce si aggiornano correttamente
6. Eliminare una Work → frecce scompaiono
7. Aprire il drawer dettaglio → continua a funzionare normalmente
8. Tutte le interazioni esistenti (selezione, rimozione CRM, conflitti) funzionano come prima
