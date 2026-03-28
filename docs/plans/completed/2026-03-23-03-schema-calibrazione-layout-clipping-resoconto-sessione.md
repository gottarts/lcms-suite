# Resoconto sessione — 2026-03-23

## Obiettivo

Fix del layout di SchemaCalibrazione: le card Work in basso vengono tagliate e il layout risulta spostato/sbagliato.

## Stato: FALLITO — rollback completo

Tutti i file sono stati ripristinati allo stato originale. Nessuna modifica residua.

## Cosa è stato tentato

### Tentativo 1: `minHeight:0` sui container flex

- Aggiunto `minHeight:0` a GrigliaAnalitiCrm (grid.tsx:114), ColonneWork (tsx:117), e singola colonna Work (tsx:136)
- Ipotesi: il default `min-height: auto` dei flex items impediva ai container di comprimersi e attivare lo scroll interno
- Risultato: nessun miglioramento visibile

### Tentativo 2: Wrapper con margin negativo e altezza calcolata

- Wrappato SchemaCalibrazione in MetodiPage con `margin:-16px` (per negare il `p-4` di `main`) e `height: calc(100vh - 48px)`
- Ipotesi: il `height:'100%'` di SchemaCalibrazione non funzionava correttamente dentro `main.overflow-auto.p-4`
- Risultato: layout completamente rotto

## Analisi del problema (non risolto)

### Struttura layout
```
AppLayout
  div.flex.h-screen.overflow-hidden
    Sidebar
    div.flex-1.flex-col.overflow-hidden
      Topbar (h-12 = 48px)
      main.flex-1.overflow-auto.p-4      ← scroll container con padding
        MetodiPage → SchemaCalibrazione   ← height:100%, flex-col
          Header + StepBar (flexShrink:0)
          Workspace (flex:1, flex-row, overflowX:auto, overflowY:hidden, minHeight:0)
            GrigliaAnalitiCrm (flex-col, flexShrink:0, margin:8)
              Header (flexShrink:0)
              Corpo (flex:1, overflowY:auto) → altezza determinata dal contenuto analiti
            ColonneWork (flex-row, flexShrink:0, margin:8)
              Colonne (width:270, flex-col, overflow:hidden)
                Header (flexShrink:0)
                Corpo (flex:1, overflowY:auto) → card Work qui vengono tagliate
          BottomBar (flexShrink:0)
```

### Ipotesi non verificate

1. **Il problema potrebbe essere nel workspace `overflowY:'hidden'`** — forse dovrebbe essere `'auto'` o rimosso, permettendo al workspace di scrollare verticalmente quando il contenuto eccede
2. **La GrigliaAnalitiCrm potrebbe forzare un'altezza minima troppo grande** a causa dei mix posizionati in assoluto (`totalMixHeight`) e delle righe con altezza fissa (ROW=48px * N analiti)
3. **Il `height:'100%'` di SchemaCalibrazione potrebbe non risolvere correttamente** dentro `main.overflow-auto` — potrebbe servire un approccio completamente diverso (es. rendere `main` un flex container, o usare position fixed/absolute per SchemaCalibrazione)
4. **Potrebbe essere necessario ispezionare con DevTools** l'altezza effettiva calcolata di ogni elemento nella catena per capire dove si rompe

### File coinvolti
- `src/renderer/pages/metodi/SchemaCalibrazione.tsx` — layout principale, workspace, ColonneWork
- `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx` — GrigliaAnalitiCrm
- `src/renderer/pages/metodi/MetodiPage.tsx` — punto di mount di SchemaCalibrazione
- `src/renderer/components/layout/AppLayout.tsx` — layout padre con `main.overflow-auto.p-4`

### Suggerimento per prossima sessione
Ispezionare con Chrome DevTools (in Electron: Ctrl+Shift+I) l'altezza calcolata di ogni container nella catena, dall'alto verso il basso, per identificare il punto esatto dove il vincolo di altezza si perde. Cercare il primo elemento che ha un'altezza calcolata maggiore dello spazio disponibile.
