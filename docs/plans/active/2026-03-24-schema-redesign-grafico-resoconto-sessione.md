# Resoconto sessione — 2026-03-24 (sessione 2)

## Obiettivo

Redesign grafico completo di SchemaCalibrazione: nuovo look pulito/bianco ispirato a Excalidraw, mantenendo logica e funzionalità invariate. Risolvere anche il problema di clipping delle card Work in basso.

## Risultato

- **Redesign grafico: COMPLETATO** — nuova palette colori, stile pulito, sfondo bianco
- **Fix layout clipping: PARZIALE / FALLITO** — applicato `height: calc(100vh - 48px - 32px)` + `margin: -16` sul root div, ma il problema persiste (card Work in basso ancora tagliate)

---

## Cosa è stato fatto

### File modificati

1. **SchemaCalibrazione.types.ts** — nuova palette `C`:
   - `page.bg` da beige `#f2f0eb` a bianco `#ffffff`
   - Bordi da warm beige-gray a neutri (`#e5e5e5`, `#d0d0d0`)
   - Colori categoria ~30% meno saturi (es. mix border da `#185FA5` a `#6ba3d6`)

2. **SchemaCalibrazione.tsx** — stili aggiornati:
   - Root div: `height: calc(100vh - 48px - 32px)`, `margin: -16`, `overflow: hidden`
   - Header: `boxShadow` invece di `borderBottom`, padding più generoso, titolo metodo in pill, legenda con pallini rotondi
   - StepBar: cerchi dashed per step pending, colori soft, connettori dashed
   - Workspace: `gap: 16`, `padding: '8px 12px'`
   - ColonneWork: `margin: 0`, `borderRadius: 12`, shadow soft, card con `borderRadius: 10`
   - BottomBar: `boxShadow` invece di `borderTop`, `borderRadius: 8` sui bottoni
   - ConnectionsOverlay SVG: `strokeWidth: 1.2`, `strokeDasharray: '6 4'`, `opacity: 0.4`
   - DrawerDettaglioWork: search input con `background: '#fafafa'`

3. **SchemaCalibrazione.grid.tsx** — stili aggiornati:
   - GrigliaAnalitiCrm: `margin: 0`, `borderRadius: 12`, shadow soft, header più leggero
   - Card singoli: `borderRadius: 10`, shadow soft, selected bg `#c8e8a8`
   - Blocchi Mix: `borderRadius: 10`, shadow soft, selected glow più leggero
   - Bottoni azione (↗, ×): bordi neutrali `C.page.brd` invece di colore categoria
   - Chip: `borderRadius: 4`, `padding: '2px 6px'`
   - ModalCreaWork: backdrop più trasparente (`.3`), modal `borderRadius: 14`, input `borderRadius: 8`, bg `#fafafa`

---

## Bug ancora aperti

### 1. Layout clipping (card Work tagliate in basso)

Il tentativo `height: calc(100vh - 48px - 32px)` + `margin: -16` non ha risolto il problema.

**Cronologia completa dei tentativi falliti:**

| # | Tentativo | Ipotesi | Risultato |
|---|-----------|---------|-----------|
| 1 | `minHeight:0` su griglia, colonne, singola colonna | Default `min-height:auto` impedisce compressione flex items | Nessun miglioramento |
| 2 | Wrapper con `margin:-16px` + `height:calc(100vh - 48px)` | Il `height:100%` non funziona dentro `main.overflow-auto.p-4` | Layout completamente rotto |
| 3 | `height:'calc(100vh - 48px - 32px)'` sul root div senza wrapper | Dare altezza assoluta calcolata al root | Fallito |
| 4 | `height:'calc(100vh - 48px - 32px)'` + `margin:-16` + `overflow:hidden` | Annullare padding di main e dare altezza fissa | **Parzialmente fallito** — il root sembra avere altezza corretta ma le colonne Work interne non scrollano |

**Analisi per prossima sessione:**
Il problema potrebbe non essere solo nell'altezza del root. Anche se il root ha un'altezza fissa, la catena flex interna (workspace → ColonneWork container → singola colonna → corpo colonna) potrebbe non propagare il vincolo correttamente. Verificare:
- Se il container `ColonneWork` (flex-row, dashed border) ha un'altezza vincolata
- Se il corpo colonna (`flex:1, overflowY:auto`) riceve effettivamente un vincolo di altezza
- Potrebbe servire `minHeight:0` o `overflow:hidden` su ogni livello intermedio della catena flex

### 2. Frecce SVG statiche rispetto allo scroll

Le frecce di connessione (ConnectionsOverlay SVG) sono **statiche**: non si aggiornano quando si scrolla orizzontalmente il workspace. Le frecce restano nella posizione iniziale mentre le card si spostano con lo scroll.

**Causa probabile:** Il SVG è posizionato `position:absolute` nel workspace container e usa `scrollWidth`/`scrollHeight` per dimensionarsi, ma i calcoli delle coordinate delle card (`getBoundingClientRect()` in `computeConnections`) probabilmente non tengono conto dello scroll offset del container. Verificare `computeConnections` in `SchemaCalibrazione.logic.ts`.

---

## File coinvolti (riferimento rapido)

- `src/renderer/pages/metodi/SchemaCalibrazione.tsx` — root + workspace + ColonneWork + DrawerDettaglioWork
- `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx` — GrigliaAnalitiCrm + ModalCreaWork
- `src/renderer/pages/metodi/SchemaCalibrazione.types.ts` — palette C
- `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts` — `computeConnections` (per bug frecce)
- `src/renderer/pages/metodi/MetodiPage.tsx` — mount point
- `src/renderer/components/layout/AppLayout.tsx` — `<main>` scroll container
