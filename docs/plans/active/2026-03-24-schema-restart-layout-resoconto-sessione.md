# Resoconto sessione — 2026-03-24

## Obiettivo

1. Fix layout clipping in SchemaCalibrazione (card Work tagliate in basso)
2. Aggiungere funzionalita di restart/ricarica dello schema

## Risultato

- **Restart schema: SUCCESSO** — funzionalita implementata e funzionante
- **Fix layout clipping: FALLITO** — rollback effettuato, `height:'100%'` ripristinato

---

## Cosa funziona: Restart schema

Aggiunto in `SchemaCalibrazione.tsx`:
- Pulsante **"Ricarica"** nella bottom bar: ricarica CRM dal DB + ripristina ultimo auto-save
- Pulsante **"Ricomincia da zero"**: cancella tutti i Work e rimozioni CRM, salva schema vuoto nel DB, ricarica CRM
- `ConfirmDialog` con conferma prima di entrambe le azioni
- Destructured `reload` dal hook `useSchemaData` (era gia esposto ma non usato)

## Cosa non funziona: Layout clipping

### Tentativo di questa sessione

Cambiato `height:'100%'` in `height:'calc(100vh - 48px - 32px)'` sul root div di SchemaCalibrazione.
Ipotesi: dare un'altezza assoluta calcolata (viewport - topbar 48px - padding main 32px) per bypassare la catena `overflow-auto` del parent.
Risultato: **fallito** — il layout non si e corretto.

### Cronologia completa dei tentativi falliti (sessioni 2026-03-23 + 2026-03-24)

| # | Tentativo | Ipotesi | Risultato |
|---|-----------|---------|-----------|
| 1 | `minHeight:0` su GrigliaAnalitiCrm, ColonneWork, singola colonna Work | Il default `min-height:auto` impedisce la compressione dei flex items | Nessun miglioramento |
| 2 | Wrapper con `margin:-16px` + `height:calc(100vh - 48px)` | Il `height:100%` non funziona dentro `main.overflow-auto.p-4` | Layout completamente rotto |
| 3 | `height:'calc(100vh - 48px - 32px)'` sul root div (senza wrapper) | Dare altezza assoluta calcolata al root | Fallito |

### Stato attuale del layout (analisi per prossima sessione)

```
AppLayout (AppLayout.tsx)
  div.flex.h-screen.overflow-hidden
    Sidebar
    div.flex-1.flex-col.overflow-hidden
      Topbar (h-12 = 48px fissi)
      main.flex-1.overflow-auto.p-4          <-- SCROLL CONTAINER con padding 16px
        MetodiPage (MetodiPage.tsx:72-79)
          SchemaCalibrazione (height:'100%', flex-col, minHeight:0)
            Header (flexShrink:0, ~40px)
            StepBar (flexShrink:0, ~40px)
            Workspace (flex:1, flex-row, overflowX:auto, overflowY:hidden, minHeight:0)
              ConnectionsOverlay (SVG, position:absolute, pointer-events:none)
              GrigliaAnalitiCrm (flex-col, flexShrink:0, margin:8)
                Header (flexShrink:0)
                Corpo (flex:1, overflowY:auto)        <-- scroll interno
                  Colonna Analiti (width:190, flexShrink:0)
                  Colonna Mix placeholder (width:270)
                  Mix overlay (position:absolute, height:totalMixHeight)
                  Colonna Singoli (width:260, flexShrink:0)
              ColonneWork (flex-row, flexShrink:0, margin:8)
                Per ogni colonna (width:270, flex-col, overflow:hidden):
                  Header (flexShrink:0)
                  Corpo (flex:1, overflowY:auto)      <-- scroll interno, MA NON FUNZIONA
                    Card Work...                      <-- QUESTE VENGONO TAGLIATE
            BottomBar (flexShrink:0, ~40px)
```

### Il problema fondamentale

Il `<main>` e un **scroll container** (`overflow-auto`). Il `height:100%` su SchemaCalibrazione si risolve rispetto alla **content height** di main, non alla sua altezza vincolata. Questo fa si che:

1. SchemaCalibrazione non riceve un vincolo reale di altezza
2. Il workspace (`flex:1`) si espande al contenuto naturale dei figli
3. GrigliaAnalitiCrm e ColonneWork determinano la loro altezza dal contenuto (righe analiti, card work)
4. L'`overflowY:auto` nelle colonne Work non attiva mai lo scroll perche il container non e vincolato
5. Le card Work in basso eccedono lo spazio visibile e vengono tagliate dal viewport

### Ipotesi per la prossima sessione

1. **Rendere `<main>` un flex container** invece di scroll container quando SchemaCalibrazione e attivo — richiede modificare AppLayout o wrappare SchemaCalibrazione in modo che ignori il `<main>` scroll
2. **Position fixed/absolute** per SchemaCalibrazione — uscire completamente dal flusso di `<main>`, posizionarlo full-viewport con top/left/right/bottom fissi
3. **Usare `100dvh`** o un ResizeObserver per misurare l'altezza reale disponibile e impostarla come `maxHeight` esplicita in pixel
4. **Rifattorizzare il mount** — invece di renderizzare SchemaCalibrazione dentro `<main>`, renderizzarlo come overlay/portal a livello di AppLayout

### File coinvolti

- `src/renderer/pages/metodi/SchemaCalibrazione.tsx` — layout root + workspace
- `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx` — GrigliaAnalitiCrm (altezza determinata da analiti)
- `src/renderer/pages/metodi/MetodiPage.tsx` — mount point (riga 72-79)
- `src/renderer/components/layout/AppLayout.tsx` — `<main>` scroll container

### Stili inline attuali (riferimento rapido)

Root div (SchemaCalibrazione.tsx:748):
```
position:'relative', background:C.page.bg,
display:'flex', flexDirection:'column', height:'100%', minHeight:0
```

Workspace (SchemaCalibrazione.tsx:823):
```
flex:1, display:'flex', flexDirection:'row',
overflowX:'auto', overflowY:'hidden', minHeight:0, position:'relative'
```

GrigliaAnalitiCrm outer (grid.tsx:114):
```
display:'flex', flexDirection:'column', flexShrink:0, margin:8
```

GrigliaAnalitiCrm body (grid.tsx:144):
```
flex:1, overflowY:'auto', overflowX:'hidden', display:'flex', position:'relative'
```

ColonneWork outer (SchemaCalibrazione.tsx:117):
```
display:'flex', flexDirection:'row', flexShrink:0, margin:8
```

Singola colonna Work (SchemaCalibrazione.tsx:137):
```
width:270, flexShrink:0, display:'flex', flexDirection:'column', overflow:'hidden'
```

Corpo colonna Work (SchemaCalibrazione.tsx:151):
```
flex:1, overflowY:'auto', padding:8, display:'flex', flexDirection:'column', gap:7
```
