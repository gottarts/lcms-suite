# SchemaCalibrazione — Redesign grafico completo

## Context

Il layout attuale di SchemaCalibrazione ha due problemi:
1. **Clipping**: le card Work in basso vengono tagliate perché il componente è dentro `<main class="flex-1 overflow-auto p-4">` e `height:100%` non crea un vincolo reale di altezza
2. **Estetica datata**: sfondo beige, bordi pesanti, colori saturi — l'utente vuole uno stile pulito, bianco, ispirato a Excalidraw

La logica, lo state, i hook, le interazioni, i modali e il drawer rimangono **tutti invariati**. Cambiano solo gli stili inline e la palette colori.

## File da modificare

| File | Cosa cambia |
|------|-------------|
| `SchemaCalibrazione.types.ts` | Palette `C` |
| `SchemaCalibrazione.tsx` | Layout fix root + stili Header, StepBar, Workspace, ColonneWork, BottomBar, ConnectionsOverlay, DrawerDettaglioWork |
| `SchemaCalibrazione.grid.tsx` | Stili GrigliaAnalitiCrm + ModalCreaWork |

**Nessuna modifica** a MetodiPage.tsx o AppLayout.tsx.

---

## Step 1 — Nuova palette C (`SchemaCalibrazione.types.ts`)

```typescript
export const C = {
  mix:   { bg: '#eef6ff', border: '#6ba3d6', text: '#2b5f8a', chip: '#d4e8fa' },
  sng:   { bg: '#eef8e8', border: '#7db85a', text: '#3a6b24', chip: '#d2edbe' },
  con:   { bg: '#fef0ec', border: '#d4806a', text: '#8c3e2a' },
  work:  { bg: '#fdf6e8', border: '#c49540', text: '#6b4f1a', chip: '#f5e2b8' },
  inter: { bg: '#f2effe', border: '#9b86d6', text: '#5a3fa0', chip: '#d8cff5' },
  ana:   { bg: '#f5f5f3', border: '#b0afaa' },
  page:  { bg: '#ffffff', sur: '#ffffff', brd: '#e5e5e5', brd2: '#d0d0d0',
           t1: '#1e1e1e', t2: '#6b6b6b', th: '#a0a0a0' },
} as const
```

Cambiamenti chiave: sfondo bianco, bordi grigi neutri, colori categoria più pastello/soft.

---

## Step 2 — Layout fix sul root div (`SchemaCalibrazione.tsx` ~riga 749)

```typescript
style={{
  position: 'relative',
  background: C.page.bg,
  display: 'flex', flexDirection: 'column',
  height: 'calc(100vh - 48px - 32px)',  // viewport - topbar(48px) - main padding(2×16px)
  margin: -16,                           // annulla p-4 di <main>
  overflow: 'hidden',
  fontFamily: 'Lato, sans-serif',
}}
```

Questo dà al componente un'altezza fissa in pixel → `flex:1` sul workspace funziona → le colonne Work scrollano internamente → niente clipping.

---

## Step 3 — Stili sezione per sezione (`SchemaCalibrazione.tsx`)

### Header
- Rimuovere `borderBottom`, usare `boxShadow: '0 1px 0 rgba(0,0,0,0.06)'`
- `padding: '12px 24px'`
- Titolo: fontSize 15, fontWeight 600
- Nome metodo: pill con `background: '#f0f0f0', borderRadius: 12, padding: '2px 10px'`
- Legenda: pallini rotondi (borderRadius 50%, 8×8px) invece di quadrati

### StepBar
- Rimuovere `borderBottom`, usare `boxShadow: '0 1px 0 rgba(0,0,0,0.06)'`
- Cerchi step: 20×20px
  - Done: `bg: '#7db85a'`, bianco
  - Active: `bg: '#6ba3d6'`, bianco
  - Pending: `bg: transparent`, `border: 1.5px dashed #d0d0d0`
- Connettori: colore `C.page.brd`

### Workspace
- `gap: 16` (da 12), `padding: '8px 12px'`

### ColonneWork
- Container: `margin: 0`, `borderRadius: 12`, `boxShadow: '0 1px 4px rgba(0,0,0,0.04)'`
- Label "Soluzioni Work": fontWeight 600
- Card Work: `borderRadius: 10`, shadow `'0 1px 2px rgba(0,0,0,0.04)'`
  - Selected work: bg `'#f5e8c8'`, inter: `'#ddd4f5'`, outlineOffset 2
  - Volume table: `borderTop: '1px dashed'`
  - Chip: `borderRadius: 4`, `padding: '2px 6px'`
  - Validity badge: `borderRadius: 10`, `padding: '1px 8px'`
- Placeholder vuoto: `border: '2px dashed'`, `borderRadius: 10`, `background: transparent`
- Bottone "+Intermedia": `border: none`, `borderLeft: '1.5px dashed'`, bg transparent

### BottomBar
- `borderTop: 'none'`, `boxShadow: '0 -1px 0 rgba(0,0,0,0.06)'`
- `padding: '10px 24px'`
- Tutti i bottoni: `borderRadius: 8`
- "Crea Work" primary: `borderRadius: 8`

### ConnectionsOverlay SVG
- `strokeWidth: 1.2` (da 1.5)
- `strokeDasharray: '6 4'` (da '5 3')
- `opacity: 0.4` (da 0.55)
- Arrow markers: usano i nuovi colori soft della palette

### DrawerDettaglioWork
- Search input: `background: '#fafafa'` (invece di C.page.bg che ora è bianco)

---

## Step 4 — Stili GrigliaAnalitiCrm + ModalCreaWork (`SchemaCalibrazione.grid.tsx`)

### GrigliaAnalitiCrm
- Container: `margin: 0`, `borderRadius: 12`, `boxShadow: '0 1px 4px rgba(0,0,0,0.04)'`
- Label: fontWeight 600
- Header: `borderBottom: '1px solid rgba(0,0,0,0.06)'`, fontWeight 600, fontSize 10
- Analita cells: `borderRadius: 8`, `boxShadow: 'none'`
- Mix blocks: `borderRadius: 10`, shadow soft `'0 1px 2px rgba(0,0,0,0.04)'`, selected glow `'0 0 0 2px rgba(107,163,214,0.35)'`
- Singoli cards: `borderRadius: 10`, selected bg `'#c8e8a8'`
- Chip tags: `borderRadius: 4`, `padding: '2px 6px'`

### ModalCreaWork
- Backdrop: `rgba(0,0,0,.3)` (da .45)
- Modal box: `borderRadius: 14`, `padding: 24`, `border: 1px solid C.page.brd`, shadow `'0 12px 40px rgba(0,0,0,.12)'`
- Input fields: `borderRadius: 8`, `background: '#fafafa'`
- Bottoni: `borderRadius: 8`

---

## Step 5 — Verifica

1. Aprire un metodo con SchemaCalibrazione → verificare che il layout riempe lo spazio disponibile senza clipping
2. Scrollare orizzontalmente con molte colonne Work
3. Verificare che le card Work in basso scrollino verticalmente dentro la colonna
4. Click su CRM Mix e Singoli → verificare selezione/deselezione
5. Creare un Work → verificare ModalCreaWork
6. Click dettaglio Work → verificare DrawerDettaglioWork
7. Ricarica e "Ricomincia da zero" → verificare ConfirmDialog
8. Verificare connessioni SVG visibili tra sorgenti e Work
