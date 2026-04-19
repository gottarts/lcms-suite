# Fix bug lavagna schema + porting a React Flow

## Context

La feature "lavagna infinita" introdotta dal commit `72408f8` ha 4 bug aperti documentati in [docs/plans/active/new draft.md](docs/plans/active/new%20draft.md#L7-L29):

1. **Frecce buggy** — non sempre appaiono, non seguono le card durante il drag, si sovrappongono tra loro e alle card, non collegano tutto.
2. **Pan rotto** — cliccare sullo sfondo blocca proprio l'app (bug critico): il world div intercetta il click e il check `e.target !== e.currentTarget` fallisce.
3. **Zoom troppo repentino** — fattore `1.1` percepito come scatto brusco.
4. **Card sovrapposte / aspetto generale buggato** — le card con "rivette" lunghe escono dai bordi, layout troppo stretto, le frecce di una card si sovrappongono a quelle di un'altra.

Il canvas è implementato **a mano** (pan/zoom custom, SVG bezier, drag imperativo, layout a colonne hardcoded). L'utente ha indicato che, non riuscendo a sistemare tutto, è consentito passare ad una libreria mantenendo lo schema. **Scelta confermata**: porting a **React Flow (`@xyflow/react`)** con **dagre** per ordinamento verticale mantenendo le colonne L→R fisse. Posizioni salvate su localStorage **resettate** (fresh start).

Obiettivo: mappa espansa, card con altezza dinamica, frecce che seguono live il drag, pan/zoom/drag gestiti dalla libreria, niente più blocchi.

---

## Scope

**File principale da riscrivere**: [src/renderer/pages/metodi/SchemaCalibrazione.lavagna.tsx](src/renderer/pages/metodi/SchemaCalibrazione.lavagna.tsx) (1081 righe).

**File non toccati** (scope isolato come da CLAUDE.md):
- `SchemaCalibrazione.tsx` (orchestratore griglia/lavagna)
- `SchemaCalibrazione.types.ts` (tipi condivisi, palette `C`)
- `SchemaCalibrazione.logic.ts` (costruzione `w.srcs` e CRUD schema)
- Tutto il resto del progetto

---

## Approccio

### 1. Dipendenze

Aggiungere a `package.json`:
- `@xyflow/react` (ex react-flow v12) — canvas, edges, pan/zoom, drag
- `dagre` + `@types/dagre` — ordinamento verticale dei nodi

Import del CSS di react-flow una volta sola dentro `SchemaLavagna` (`import '@xyflow/react/dist/style.css'`).

### 2. Struttura nuova (stesso file, stessa `export function SchemaLavagna`)

```
SchemaLavagna
├── SidebarAnaliti (riusa identico — 240px fixed left)
└── <ReactFlow> (flex=1)
    ├── nodes = moduli → { id, type: 'mix'|'sng'|'work', position, data }
    ├── edges = archi (da computeArchi adattato)
    ├── nodeTypes = { mix: ModuloMixNode, sng: ModuloSngNode, work: ModuloWorkNode }
    ├── <Background gap={22} variant="dots" />
    ├── <Controls /> (zoom in/out/fit)
    └── <MiniMap /> (opzionale, basso-dx)
```

I tre componenti `ModuloMix`, `ModuloSng`, `ModuloWork` diventano `NodeProps`-compatibili. Mantengono look/colori/chips/highlight **identici** a oggi (stesso `C` palette, stessa resa grafica).

### 3. Fix bug per bug

**Pan rotto (bug critico)**
- ReactFlow gestisce pan nativamente. Default: click-drag sullo sfondo → pan. Drag su nodo → move nodo. Fix automatico del bug.
- `panOnDrag={true}`, `selectionOnDrag={false}`.

**Zoom repentino**
- `zoomOnScroll={true}`, `minZoom={0.25}`, `maxZoom={2}` (stessi limiti di ora).
- Passare `zoomActivationKeyCode={null}` e regolare velocità via `panOnScroll={false}`.
- Per lo step di zoom usare i default di react-flow (molto più graduali di 1.1) oppure custom handler se serve.

**Frecce che seguono il drag (live)**
- Gli edges di react-flow si aggiornano automaticamente durante il drag dei nodes (la libreria sposta i nodi in stato interno e ricalcola gli attacchi di default). Fix gratis.
- Edge type: `'smoothstep'` o `'default'` (bezier) per restare vicini all'estetica attuale.

**Frecce non appaiono / non collegano tutto**
- Porta la logica di `computeArchi()` a produrre **edges** react-flow con shape:
  ```ts
  { id, source, target, sourceHandle?, targetHandle?, type, animated: false, style: { stroke, strokeDasharray }, markerEnd }
  ```
- **Fix mapping mix lotti alternati**: ogni `ModuloMeta` di tipo `mix` ora espone **tutti** i `mix_id` associati (attivo + alternativi) in `meta.mixIds: string[]`. `mixMod` diventa `Map<string, ModuloMeta>` con una entry per **ogni** mix_id (non solo quello attivo). Così `w.srcs[i].id` risolve sempre.
- Per le sorgenti `prep` idem: `prepInSng` popolato esattamente come oggi.
- `sourceHandle`: attacco lato destro centrato della card sorgente; `targetHandle`: attacco lato sinistro centrato della card target. React Flow usa `<Handle>` inside node per questo.

**Card sovrapposte + aspetto buggato**
- **Altezza dinamica**: ogni nodo calcola la sua altezza reale dal contenuto (numero preps, numero chips). Niente più `LAYOUT.MODULE_H` fisso. React Flow accetta dimensioni variabili per nodo.
- **Spaziatura L→R più generosa**: nuove costanti `LAYOUT_V2`:
  - `COL_X: [60, 560, 1160]`, `COL_WORK_GAP: 560` (era 440/440/900 + 440)
  - `ROW_GAP: 60` (era 20)
- **Ordinamento verticale con dagre**: mantenendo la colonna per `kind`/`colSrc`, dagre ordina solo i Y dei nodi di ogni colonna minimizzando gli incroci delle frecce. Helper `layoutConDagre(nodes, edges)` chiamato una volta al mount e su `Riallinea`.
- **Frecce sotto le card** (z-index): react-flow gestisce nativamente layer edges < layer nodes. Le frecce di una card non si sovrappongono al contenuto di un'altra perché edges sono un layer dedicato dietro ai nodes.

**Sovrapposizioni residue di archi**
- `edges.type = 'smoothstep'` con `pathOptions.offset` o edge-routing nativo di react-flow riduce gli incroci tra archi paralleli. Per archi multipli dallo stesso source allo stesso target uso `sourceHandle` diversi (top/bottom del bordo destro) per sfalsarli.

### 4. Porting posizioni

- **Fresh start**: al primo load della nuova versione cancello il key `lcms:lavagna:positions:<metodoId>` (o cambio il key in `lcms:lavagna:positions:v2:<metodoId>` così la migrazione è non distruttiva ma ignora le vecchie). Preferisco la v2 per non perdere eventuali dati se si fa rollback.
- `useLavagnaPositions` rimane con la stessa API (`positions`, `setPosition`, `resetLayout`) ma legge/scrive `v2` key.
- React Flow chiama `onNodesChange` → quando type è `'position'` e `dragging: false` (drag finito) → `setPosition(id, x, y)`.

### 5. Sidebar + highlight

- `SidebarAnaliti` resta identica.
- Highlight (`highlightedIds`) passato al custom node come data flag → bordo evidenziato (stesso effetto attuale).

### 6. Cleanup

- Rimuovere: `handleWheel`, `handleViewportMouseDown`, `handleViewportDoubleClick`, `zoomBy`, `ArchiSVG`, `ModuloBaseWrapper` (il drag è ora gestito da RF), costanti `ZOOM_MIN`/`ZOOM_MAX` (passate come prop a RF), `computeWorldSize` (RF calcola extent).
- `computeArchi` → adatta a produrre `Edge[]` di react-flow (stessa logica, stessa estetica).
- `deriveModuli` → invariato lato dati; si aggiunge solo `meta.mixIds: string[]` nel tipo `ModuloMeta` (kind `mix`).

---

## File critici

| File | Tipo modifica |
|------|---|
| [src/renderer/pages/metodi/SchemaCalibrazione.lavagna.tsx](src/renderer/pages/metodi/SchemaCalibrazione.lavagna.tsx) | Riscrittura interna, export `SchemaLavagna` e props invariati |
| [package.json](package.json) | +`@xyflow/react`, +`dagre`, +`@types/dagre` |
| [src/renderer/pages/metodi/SchemaCalibrazione.types.ts](src/renderer/pages/metodi/SchemaCalibrazione.types.ts) | Aggiunta `mixIds?: string[]` al tipo `ModuloMeta` variante `mix` (non breaking) |

**NON toccare:**
- [SchemaCalibrazione.tsx](src/renderer/pages/metodi/SchemaCalibrazione.tsx) — il toggle griglia/lavagna e la fullscreen envelope restano com'è (rispetta la regola di CLAUDE.md su margini negativi)
- [SchemaCalibrazione.logic.ts](src/renderer/pages/metodi/SchemaCalibrazione.logic.ts) — costruzione `w.srcs` invariata

---

## Funzioni/utility riutilizzate

- `deriveModuli()` — invariata, solo arricchita con `mixIds`
- `computeArchi()` — mantiene la stessa logica di matching sorgenti, cambia solo l'output (Edge[] invece di Arco[])
- Palette `C` da [SchemaCalibrazione.types.ts](src/renderer/pages/metodi/SchemaCalibrazione.types.ts) — riusata identica nei nuovi node renderer
- `SidebarAnaliti` — invariato
- `useLavagnaPositions` — API invariata, bump key a `v2`

---

## Verifica end-to-end

1. `npm install` per installare `@xyflow/react`, `dagre`, `@types/dagre`
2. `npm run typecheck` (o `tsc --noEmit`) → nessun errore
3. `npm run dev` → apri un metodo con schema calibrazione esistente, entra in vista "Lavagna":
   - **Pan**: click-drag sullo sfondo muove la vista, nessun blocco
   - **Zoom**: wheel zooma gradualmente (non scatta), pinch-to-zoom su trackpad OK
   - **Drag card**: trascina un Mix, le frecce seguono live ogni pixel
   - **Frecce**: verifica in uno schema con Work + Mix che tutti gli archi sorgente→target siano disegnati, anche con lotti alternativi (creare scenario con `mixLottoSel` ≠ lotto attivo)
   - **Sovrapposizioni**: apri uno schema con prep lunghi (Neat con molti preps) e intermediate — card non si sovrappongono, le frecce passano dietro alle card
   - **Riallinea**: tasto "Riallinea" riesegue dagre e sistema tutto
   - **Persistenza**: sposta una card, ricarica la pagina, la card resta dove l'hai messa (nuovo key `v2`)
4. Verifica che la vista "Griglia" e tutto il resto del progetto non siano toccati
5. Commit: `feat(lavagna): porting a React Flow + fix frecce/pan/zoom/overlap`

---

## Note

- Niente refactor fuori scope (regola CLAUDE.md). Non tocco `CompostiTable`, `StoriaDialog`, `CompostiPage`, routing, altri moduli.
- Mantengo look&feel identico dei 3 tipi di card (colori, chips, badge "+N lotti", highlight hover sidebar).
- Se durante l'implementazione dagre produce risultati peggiori dell'auto-layout attuale su qualche schema reale, fallback a layout a colonne con `ROW_GAP: 60` senza dagre (decisione a runtime, non a design-time).
