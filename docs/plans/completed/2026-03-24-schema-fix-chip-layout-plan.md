# Piano: Fix layout clipping + frecce SVG statiche in SchemaCalibrazione

## Context

Dal resoconto 2026-03-24, due bug restano aperti dopo il redesign grafico:
1. **Layout clipping**: Le card Work in fondo vengono tagliate — 4 tentativi falliti
2. **Frecce SVG statiche**: Le frecce non si aggiornano con lo scroll orizzontale

---

## Analisi

### Bug 1 — Catena flex attuale

```
<div class="flex h-screen overflow-hidden">            ← altezza vincolata
  <div class="flex-1 flex flex-col overflow-hidden">   ← altezza vincolata
    <Topbar />                                          ← ~48px, flexShrink:0
    <main class="flex-1 overflow-auto p-4">            ← overflow-AUTO (espandibile!)
      <div root SchemaCalibrazione>                    ← height: calc(100vh-80px), margin:-16
        Header (flexShrink:0)
        StepBar (flexShrink:0)
        workspace (flex:1, overflowX:auto, overflowY:hidden, minHeight:0)
          ColonneWork container (display:flex row, NO height vincolata)
            colonna (display:flex column, overflow:hidden)
              corpo (flex:1, overflowY:auto)
```

**Causa root**: `<main>` ha `overflow-auto` — il browser lo lascia espandere oltre la quota `flex:1`. Il root div usa `height: calc(100vh-80px)` ma vive dentro un container che NON lo vincola. Quindi il root div può eccedere la viewport e non triggera l'overflow interno.

**Fix**: Aggiungere `position: relative` a `<main>`, poi il root div usa `position: absolute; inset: -16px` per uscire dal padding p-4 e occupare l'intera area main.

Con `position: absolute` il root div è rimosso dal flusso normale → il main non si espande per lui → il main resta alla sua quota `flex:1` → l'altezza disponibile è quella giusta.

### Bug 2 — SVG frecce

`computeConnections` (logic.ts:291-325) calcola già correttamente le coordinate sommando `scrollLeft`/`scrollTop` al containerRect. L'SVG ha `position: absolute, top:0, left:0` dentro il workspace con `position: relative` — corretto per un canvas scrollabile.

Il listener `scroll` è registrato su `containerRef` e triggera `update()` che chiama `setLines` → re-render React. Il problema è il **ritardo asincrono**: React schedula il re-render, quindi per un frame le frecce mostrano le coordinate vecchie mentre il contenuto è già scrollato.

**Fix**: Sostituire `setLines` con una ref + aggiornamento diretto via `requestAnimationFrame` per eliminare il ritardo. In alternativa, più semplice: usare `useRef` per le linee e fare `forceUpdate` con `useReducer`.

**Soluzione più semplice**: aggiungere `key={scrollOffset}` all'SVG per forzare il remount... no, troppo costoso.

**Soluzione corretta**: Nel listener scroll, usare `requestAnimationFrame` per sincronizzare l'update con il frame del browser, evitando il flash.

---

## Modifiche

### 1. `AppLayout.tsx` — linea 28

```jsx
// Prima
<main className="flex-1 overflow-auto p-4">
// Dopo
<main className="flex-1 overflow-auto p-4 relative">
```

Aggiungere `relative` è sicuro: non cambia nulla per le altre pagine (nessuna usa `position: absolute` rispetto al main).

### 2. `SchemaCalibrazione.tsx` — linee 750-755 (root div)

```jsx
// Prima
<div style={{
  position:'relative', background:C.page.bg,
  display:'flex', flexDirection:'column',
  height:'calc(100vh - 48px - 32px)', margin:-16, overflow:'hidden',
  fontFamily:'Lato, sans-serif',
}}>

// Dopo
<div style={{
  position:'absolute',
  top: -16, left: -16, right: -16, bottom: -16,
  background: C.page.bg,
  display: 'flex', flexDirection: 'column',
  overflow: 'hidden',
  fontFamily: 'Lato, sans-serif',
}}>
```

`top/left/right/bottom: -16` esce dal `p-4` (16px) del main su tutti e 4 i lati.

### 3. `SchemaCalibrazione.tsx` — linee 46-60 (ConnectionsOverlay useLayoutEffect)

```jsx
// Prima
el.addEventListener('scroll', update, { passive: true })

// Dopo — wrappare update in rAF per sincronizzare con il frame browser
let rafId: number
const onScroll = () => {
  cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(update)
}
el.addEventListener('scroll', onScroll, { passive: true })
return () => {
  ro.disconnect()
  el.removeEventListener('scroll', onScroll)
  cancelAnimationFrame(rafId)
}
```

---

## File da modificare

| File | Riga | Modifica |
|------|------|----------|
| `src/renderer/components/layout/AppLayout.tsx` | 28 | `<main>` aggiungere classe `relative` |
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | 750-755 | Root div: `position:absolute`, `top/left/right/bottom:-16`, rimuovere `height` e `margin` |
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | 46-60 | Listener scroll con `requestAnimationFrame` |

---

## Verifica

1. Aprire SchemaCalibrazione — verificare che il componente occupi l'intera area senza tagli
2. Aggiungere molte card Work — verificare che il corpo colonna scorra verticalmente
3. Scrollare orizzontalmente il workspace — verificare che le frecce seguano senza flash
4. Navigare ad altra pagina (es. Composti) — verificare nessuna regressione di layout
