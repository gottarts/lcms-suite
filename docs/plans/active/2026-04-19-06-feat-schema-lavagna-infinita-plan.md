# Piano — Componente `SchemaLavagna` (vista "lavagna infinita" dello Schema di Calibrazione)

## Context

Lo **SchemaCalibrazione** attuale ([src/renderer/pages/metodi/SchemaCalibrazione.tsx](src/renderer/pages/metodi/SchemaCalibrazione.tsx)) è una griglia editoriale: analiti in colonna, mix/singoli affiancati, colonne Work a destra. È ottima per **modificare** lo schema (selezionare sorgenti, creare work), ma poco leggibile per chi vuole semplicemente **consultarlo** — scadenze, lotti, produttori, rivalidazioni sono sparsi o invisibili.

L'utente vuole una seconda vista che diventi la modalità **normale** di lettura: una lavagna bianca con pan/zoom, moduli draggabili (stile Excalidraw ma raffinato), collegamenti dinamici che seguono lo stesso flusso visivo della griglia ma con più informazioni per modulo. La griglia attuale resta la modalità **edit**.

Obiettivi:
- Affiancare (non sostituire) la griglia, con toggle dentro `SchemaCalibrazione.tsx`.
- **Zero modifiche** a `SchemaCalibrazione.grid.tsx`, `.logic.ts`, `.types.ts`, `.scenari.ts`.
- Flusso visivo L→R: **Mix | Singoli/Neat | Work** (Work sempre più a destra, intermedie ancora più a destra).
- Nessuna nuova dipendenza (pan/zoom nativo), nessun Tailwind, niente font custom: stile coerente con la palette `C` già esportata.

## Scelte già validate con l'utente

| # | Decisione | Scelta |
|---|-----------|--------|
| 1 | Scope moduli | **C · Ibrido**: analiti in lista ancorata, Mix/Sng/Work moduli draggabili |
| 2 | Ancoraggio analiti | **A · Sidebar sinistra fissa** (fuori dal pan/zoom) |
| 3 | Estetica | **Technical Paper** ma realizzato con palette `C` del progetto (ink/paper solo ispirazione; codice usa `C.mix/C.sng/C.work/C.inter/C.ana/C.page`) |
| 4 | Strategia frecce | **A · Solo stream attivi** — disegno solo archi tra sorgenti usate e Work che le consumano |
| 5 | Direzione flusso | **L→R obbligatoria** (Mix → Sng → Work → Intermedie) |
| 6 | Ruolo vista | **Normale/lettura** (completa di scadenze/lotti/produttori). Griglia = **edit** |
| 7 | Posizione montaggio | Toggle **dentro** `SchemaCalibrazione.tsx` (modifica chirurgica) |
| 8 | Pan/zoom | **Nativo** (CSS transform + wheel/drag), nessuna libreria |
| 9 | Persistenza posizioni | **localStorage** per `metodoId` (no DB) |

## Architettura

### File NUOVO (unico punto di implementazione)

- **[src/renderer/pages/metodi/SchemaCalibrazione.lavagna.tsx](src/renderer/pages/metodi/SchemaCalibrazione.lavagna.tsx)** — contiene:
  - `SchemaLavagna` (export nominato, root)
  - `PanZoomViewport` (transform + wheel/drag nativi)
  - `SidebarAnaliti` (fuori dal viewport)
  - `ModuloMix`, `ModuloSng`, `ModuloWork` (card draggabili)
  - `ConnectionsOverlayLavagna` (SVG dentro il world)
  - `useLavagnaPositions(metodoId, moduleIds)` (hook localStorage + auto-layout)
  - `computeConnectionsLavagna(workCols, positions, sizes)` (calcolo archi in coord world)

### File MODIFICATO (solo [SchemaCalibrazione.tsx](src/renderer/pages/metodi/SchemaCalibrazione.tsx), modifica chirurgica in 4 punti)

1. **Import** nuovo componente (top del file).
2. **State** `const [vista, setVista] = useState<'griglia' | 'lavagna'>('griglia')` subito dopo [SchemaCalibrazione.tsx:409](src/renderer/pages/metodi/SchemaCalibrazione.tsx#L409).
3. **Toggle UI** nella bottom-bar (inserito come **primo** gruppo prima del selector destinazione d'uso intorno a [SchemaCalibrazione.tsx:857](src/renderer/pages/metodi/SchemaCalibrazione.tsx#L857)), stile coerente con i toggle DestUso esistenti ([SchemaCalibrazione.tsx:860-877](src/renderer/pages/metodi/SchemaCalibrazione.tsx#L860-L877)).
4. **Branch render** attorno al workspace (~[SchemaCalibrazione.tsx:811](src/renderer/pages/metodi/SchemaCalibrazione.tsx#L811)): ternario `vista === 'griglia' ? <blocco attuale> : <SchemaLavagna .../>`. Lo stato `selSrcs/workCols/removedMix/mixLottoSel` resta sul padre → switch Griglia↔Lavagna non perde nulla.

Nessun altro file esistente viene toccato.

## Strategia pan/zoom nativa

Struttura DOM:

```
<root flex>
  <SidebarAnaliti fixed 230px />                        ← fuori dal pan/zoom
  <viewport overflow:hidden onWheel onMouseDown>
    <world transform:translate(tx,ty) scale(scale)>     ← unico nodo trasformato
      <svg class="connections" />                       ← dentro il world (scala automaticamente)
      <ModuloMix × N />
      <ModuloSng × N />
      <ModuloWork × N />
    </world>
  </viewport>
</root>
```

- **Wheel → zoom-to-cursor**: `worldX = (mx - tx)/scale`; dopo zoom `tx' = mx - worldX * newScale`. Clamp `[0.25, 2]`.
- **Drag sfondo → pan**: `onMouseDown` su viewport (solo se `e.target === viewport`), listener su `document` per move/up. Cursor `grabbing`.
- **Drag modulo**: `onMouseDown` con `stopPropagation()` per non innescare il pan; delta in pixel diviso per `scale` → delta in coord world.
- **Reset viewport**: doppio click su sfondo. Opzionale: 3 bottoncini `− □ +` in basso a destra.

## Auto-layout L→R (quando localStorage vuoto)

Costanti world (px):

```
COL_X       = [40, 440, 840]   // Mix, Sng/Neat, Work (prima colonna)
COL_WORK_GAP = 420              // intermedie successive: COL_X[2] + ci*gap
MODULE_W    = { mix: 340, sng: 260, work: 360 }
MODULE_H    ≈ { mix: 110+18·⌈nComps/3⌉, sng: 90, work: 160 }
ROW_GAP = 16, Y_START = 40
```

Step:
1. **Mix**: lista univoca di `mixIdAttivo` (prendendo `mixLottoSel[mixId] ?? mixId`) nell'ordine di `analiti`. Impilati in `COL_X[0]`.
2. **Sng/Prep**: ID univoci da `analiti.sngIds` + `crm.prepStock`. Impilati in `COL_X[1]`.
3. **Work**: per ogni colonna `ci` e work `wi` → `x = COL_X[2] + ci*COL_WORK_GAP`, `y = Y_START + wi*(MODULE_H.work + ROW_GAP)`.
4. `worldSize.w = COL_X[2] + (workCols.length-1)*COL_WORK_GAP + MODULE_W.work + 80`.

Moduli aggiunti dopo (nuova Work creata in Griglia → torno a Lavagna) entrano in auto-layout incrementale (prima cella libera della colonna corrispondente).

## Collegamenti (strategia A · solo stream attivi)

**Non** riuso di `computeConnections` (usa `getBoundingClientRect` — fragile con CSS transform). Nuova funzione **`computeConnectionsLavagna(workCols, positions, moduleSizes)`** che lavora in **coord world pure**:

- Per ogni `w` in `workCols[colIdx]`, per ogni `s` in `w.srcs`:
  - `from = { x: posSrc.x + w.src, y: posSrc.y + h.src/2 }` (ancora destra del modulo sorgente)
  - `to   = { x: posWork.x, y: posWork.y + h.work/2 }` (ancora sinistra del work)
  - Path cubic Bezier: `M from.x from.y C (from.x+cp) from.y, (to.x-cp) to.y, to.x to.y` con `cp = max(40, (to.x-from.x)/2)`
  - Colore: `C.mix.border / C.sng.border / C.work.border` in base a `s.tipo`
- Stesso filtering semantico della `computeConnections` esistente (`strategia A`).

SVG dentro il `world` (nodo figlio del div trasformato): si scala/trasla automaticamente, `strokeWidth` costante a 1.2px (accettabile che assottigli leggermente in zoom-in). Marker arrow in `<defs>`.

## Persistenza

Hook `useLavagnaPositions(metodoId, moduleIds)`:

- **Key**: `lcms:lavagna:positions:${metodoId}` (confermato: `metodoId` è l'unico id autorevole).
- **Shape**: `{ version: 1, updatedAt: ISOString, positions: { [id]: {x,y} } }`.
- **Load** su mount (try/catch su JSON corrotto).
- **Save** debounced 200ms in `useEffect`.
- **Auto-layout** per moduli senza posizione salvata (merge).
- **resetLayout()** rimuove la chiave.
- **Nessuna pulizia** di moduli orfani (se una Work viene eliminata, la sua pos resta in LS — ritorna utile se reimportata).

## Sidebar analiti (fissa)

- Header: "Analiti (n)" small-caps 10px.
- Toggle filtro: `Tutti | Coperti | Scoperti` (stile identico a toggle DestUso esistenti).
- Riga analita (fontSize:11, Lato):
  - Pallino colorato + nome
  - Badge compatti: `M` se ha mix, `S` se ha sng, `IS` se isIS (con i colori `C.mix.chip/C.sng.chip/C.inter.chip`)
  - Se scoperto → testo grigio `C.page.th`
- **Hover**: evidenzia i moduli Mix/Sng che coprono quell'analita con outline `boxShadow: 0 0 0 3px rgba(155,134,214,.25)`.
- **Click**: no-op in v1 (niente scope creep).

## Contenuto dei moduli

Tipografia coerente: titoli `Lato`, dati tecnici `IBM Plex Mono` (come nella griglia). Palette `C`. Badge scadenza uniforme:

```ts
scadenzaBadge(scadenza):
  null      → nessuno
  < oggi    → color '#dc2626', label 'scad. <data> ⚠ SCADUTA'
  < +120gg  → color '#d97706', label 'scad. <data> ⚠ in scadenza'
  altro     → color C.page.th,  label 'scad. <data>'
```

- **ModuloMix** (bg `C.mix.bg`, borderLeft 3px `C.mix.border`): titolo = `crm.mix ?? mix_id` · produttore · lotto · scadenza · rivalidazione (se presente) · conc (fissa o "variabile") · chip componenti (max 6 + "+N") · badge `(+N lotti)` se `lottiAlternativi > 1`.
- **ModuloSng** (bg `C.sng.bg`): titolo = `crm.nome` · `<cv> mg/L · <forma>` · lotto · scadenza · rivalidazione · se `forma === 'Neat'` → box interno con prep (concReale, prep #N, scadenza) — stesso pattern di [SchemaCalibrazione.grid.tsx:456-488](src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx#L456-L488).
- **ModuloWork** (bg `C.work.bg` se lv0, `C.inter.bg` se lv>0): badge `WORK`/`INTERMEDIA N` · titolo `w.nome` · conc/vol/solvente · validità · operatore · chip sorgenti · tabella mini ingredienti (riga `nome → µL`), pattern da [SchemaCalibrazione.grid.tsx:312-341](src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx#L312-L341).

## Toggle UI in SchemaCalibrazione

Inserimento come **primo** gruppo della bottom-bar (~[SchemaCalibrazione.tsx:857](src/renderer/pages/metodi/SchemaCalibrazione.tsx#L857)):

```tsx
<div style={{ display:'flex', alignItems:'center', gap:4, marginRight:8,
              borderRight:`1px solid ${C.page.brd}`, paddingRight:12 }}>
  {(['griglia','lavagna'] as const).map(v => {
    const active = vista === v
    const labels = { griglia: 'Griglia (edit)', lavagna: 'Lavagna' }
    return (
      <button key={v} onClick={() => setVista(v)} style={{
        padding:'4px 10px', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer',
        border:`1px solid ${C.page.brd2}`,
        background: active ? C.page.t1 : C.page.sur,
        color: active ? '#fff' : C.page.t2,
      }}>{labels[v]}</button>
    )
  })}
</div>
```

## Props di `SchemaLavagna`

```ts
interface SchemaLavagnaProps {
  metodoId: string
  metodoNome: string
  analiti: AnalitoItem[]
  crmItems: CrmItem[]            // crmItemsFiltrati (già filtrato per destUso/scenario)
  selSrcs: Map<string, SorgenteSel>
  removedMix: Set<string>        // removedMixEffettivo
  mixLottoSel: Map<string, string>
  workCols: WorkInSchema[][]
  filtroDestUso: DestUso
  onSelectModulo?: (id: string) => void   // opzionale, per future integrazioni
}
```

Tutti questi valori sono **già calcolati** in `SchemaCalibrazione.tsx` (sezione useMemo di filtering) → passaggio diretto, nessuna duplicazione logica.

## Critical files

- [src/renderer/pages/metodi/SchemaCalibrazione.lavagna.tsx](src/renderer/pages/metodi/SchemaCalibrazione.lavagna.tsx) — NUOVO, tutta la feature
- [src/renderer/pages/metodi/SchemaCalibrazione.tsx](src/renderer/pages/metodi/SchemaCalibrazione.tsx) — modifica chirurgica (import + state + toggle + branch render)
- [src/renderer/pages/metodi/SchemaCalibrazione.types.ts](src/renderer/pages/metodi/SchemaCalibrazione.types.ts) — sola lettura (palette `C`, tipi)
- [src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx](src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx) — sola lettura (pattern visuale card)
- [src/renderer/pages/metodi/SchemaCalibrazione.logic.ts](src/renderer/pages/metodi/SchemaCalibrazione.logic.ts) — sola lettura (riferimento stile `computeConnections`)

## Verifica end-to-end

1. `npm run dev` → Electron.
2. Metodi → apri un metodo con ≥3 mix, ≥2 singoli (uno Neat con prep), ≥2 work (una intermedia).
3. **Griglia** (default): nessuna regressione rispetto a prima del patch.
4. Click toggle **"Lavagna"** in bottom-bar:
   - Auto-layout L→R senza sovrapposizioni.
   - Sidebar analiti mostra tutti con badge M/S/IS; filtri Coperti/Scoperti funzionano.
   - Hover su analita → outline viola sui moduli Mix/Sng che lo coprono.
   - Frecce solo per sorgenti effettivamente usate nelle Work.
5. **Pan**: drag sullo sfondo muove la scena.
6. **Zoom**: wheel su un modulo → zoom centrato sul cursore; limiti `0.25x-2x`.
7. **Drag modulo**: posizione conservata dopo F5 (localStorage).
8. **Switch Lavagna↔Griglia**: `selSrcs`/`workCols`/`mixLottoSel` preservati.
9. **Cambio filtroDestUso** con Lavagna attiva: moduli non pertinenti spariscono, archi si ridisegnano, badge scadenze coerenti.
10. **Crea Work in Griglia → torna in Lavagna**: nuova Work in prima cella libera della colonna Work, con archi verso le sue sorgenti.
11. **Metodo diverso**: posizioni indipendenti (chiave `lcms:lavagna:positions:<metodoId>` distinta).
12. DevTools console: nessun warning su ref/unmount al toggle.
