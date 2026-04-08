# Piano: Fix frecce SVG non si aggiornano allo scroll delle Work

## Context
Le frecce SVG che collegano i chips CRM alle card Work non seguono lo scroll verticale delle colonne Work. Lo scroll CRM funziona correttamente, quello Work no.

**Root cause:** La funzione `computeConnections` usa `getBoundingClientRect()` per ottenere le coordinate viewport degli elementi, poi compensa con `scrollContainer.scrollLeft/scrollTop` (dove `scrollContainer` = `workspaceRef`, il wrapper principale). 

Il problema è che lo scroll verticale delle work avviene **dentro ogni singola colonna** (`div` con `overflowY: auto`, riga 167 di SchemaCalibrazione.tsx), NON nel `workspaceRef`. Il `workspaceRef` ha solo `overflowX: auto`. Quindi:
- `scrollContainer.scrollTop` è sempre 0 → la compensazione Y delle work è zero
- Le card Work scorrono via dal viewport ma le coordinate SVG non si aggiornano correttamente

Per le CRM funziona perché il loro scroll verticale è in `gridBodyRef`, che viene ascoltato tramite `addEventListener` e ricalcola correttamente (il `getBoundingClientRect()` della sorgente aggiornato riflette già la nuova posizione viewport dopo lo scroll, e la compensazione `scrollContainer.scrollTop` è 0 anche lì — quindi è simmetrica e funziona per caso: la posizione viewport della card CRM cambia con lo scroll, quella della card Work pure, ma il calcolo usa solo lo scroll del workspaceRef che è 0 per Y in entrambi i casi).

**Analisi più precisa:**

`getBoundingClientRect()` restituisce coordinate relative al viewport. Per convertirle in coordinate relative al container SVG (che ha `position: absolute` dentro `workspaceRef`), bisogna sottrarre `containerRect` e aggiungere lo scroll del container SVG stesso.

Poiché il container SVG (il `workspaceRef`) scorre solo su X, la formula attuale è corretta per X. Per Y, lo SVG è posizionato `top: 0` dentro `workspaceRef`, che non scorre verticalmente — quindi `containerRect.top` rimane fisso. Le coordinate Y sono relative al viewport.

**Il vero bug:** quando si scorre una colonna Work, la card Work si sposta nel viewport (il suo `getBoundingClientRect().top` cambia), ma il listener `scroll` sulla colonna interna non esiste — quindi `update()` non viene chiamata e le frecce rimangono statiche.

**Soluzione:** Aggiungere listener `scroll` su tutti i div interni scrollabili delle colonne Work. Il modo più pulito è passare una ref al container delle colonne Work e osservare lo scroll event con **capturing** (così cattura scroll di tutti i discendenti), oppure usare un ref array sulle colonne Work interne.

## File critici
- [src/renderer/pages/metodi/SchemaCalibrazione.tsx](src/renderer/pages/metodi/SchemaCalibrazione.tsx) — `ConnectionsOverlay` (righe 41-109), layout workspace (righe 1159-1194), `ColonneWork` (righe 126-...)
- [src/renderer/pages/metodi/SchemaCalibrazione.logic.ts](src/renderer/pages/metodi/SchemaCalibrazione.logic.ts) — `computeConnections` (righe 555-590)

## Soluzione scelta: event capturing sul wrapper ColonneWork

Aggiungere una `ref` al `div` wrapper di `ColonneWork` (già presente come il div con `display: flex, flexDirection: row`). Passarla a `ConnectionsOverlay` come `workScrollRef`. Nel `useLayoutEffect`, aggiungere `workScrollRef.addEventListener('scroll', update, { passive: true, capture: true })` — il `capture: true` permette di intercettare lo scroll di qualsiasi figlio (inclusi i div interni delle colonne).

Questo è minimale: nessuna nuova struttura dati, nessun ref array, solo un ref in più.

## Modifiche

### 1. `SchemaCalibrazione.tsx` — aggiungere `workColsRef` e passarlo

**In `SchemaCalibrazione` (componente root):**
```tsx
const workColsRef = useRef<HTMLDivElement>(null)
```
Passare a `ColonneWork`:
```tsx
<ColonneWork ref={workColsRef} ... />
```
Passare a `ConnectionsOverlay`:
```tsx
<ConnectionsOverlay workScrollRef={workColsRef} ... />
```

**In `ColonneWork`:** aggiungere `React.forwardRef` e attaccare la ref al div wrapper esterno.

**In `ConnectionsOverlay`:** 
- Accettare prop `workScrollRef?: React.RefObject<HTMLDivElement | null>`
- Nel `useLayoutEffect`, aggiungere listener con capture:
```ts
const workWrap = workScrollRef?.current
if (workWrap) workWrap.addEventListener('scroll', update, { passive: true, capture: true })
// cleanup: removeEventListener con capture: true
```

### 2. Nessuna modifica a `computeConnections` necessaria
La funzione usa `getBoundingClientRect()` che già riflette la posizione viewport aggiornata dopo lo scroll. Il problema era solo che `update()` non veniva chiamata allo scroll interno.

## Verifica
1. Avviare l'app, aprire SchemaCalibrazione
2. Aggiungere più Work di quante ne entrano visualmente in una colonna
3. Scorrere verticalmente la colonna Work → le frecce devono seguire le card
4. Scorrere la sezione CRM → le frecce devono continuare a funzionare
5. Scorrere orizzontalmente il workspace → le frecce devono seguire
