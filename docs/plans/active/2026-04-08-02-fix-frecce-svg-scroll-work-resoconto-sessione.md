# Resoconto sessione — Fix frecce SVG non seguono scroll colonne Work

**Data:** 2026-04-08
**Oggetto:** Le frecce SVG che collegano i chips CRM alle card Work non si aggiornano quando si scorre verticalmente la lista Work

---

## Cosa è stato fatto

Identificata e corretta la root cause per cui le frecce di connessione SVG in SchemaCalibrazione si aggiornano correttamente allo scroll della sezione CRM ma rimangono statiche allo scroll delle colonne Work.

---

## Bug risolti

### Frecce SVG statiche allo scroll Work

**Root cause:**  
`computeConnections` usa `getBoundingClientRect()` per ottenere le coordinate viewport di ogni card. Queste coordinate cambiano quando una card viene scrollata fuori dal viewport — ma solo se il listener `scroll` viene triggerato per ricalcolare le frecce.

Il listener `scroll` era attaccato a `workspaceRef` (il wrapper principale con `overflowX: auto`) e a `gridBodyRef` (lo scroll verticale della sezione CRM). Lo scroll verticale delle Work però avviene nei `div` interni a ogni colonna (ciascuno con `overflowY: auto`), che non erano ascoltati. Risultato: scrollando le Work, le card si spostavano nel viewport ma `update()` non veniva mai chiamata e le frecce rimanevano puntate alla posizione vecchia.

**Fix:**  
Usata la tecnica dell'event capturing. `ColonneWork` è stata convertita a `React.forwardRef` e la ref punta al suo div wrapper esterno. `ConnectionsOverlay` riceve questa ref come `workScrollRef` e vi aggiunge un listener `scroll` con `{ capture: true }`, che intercetta lo scroll di qualsiasi div figlio (incluse le colonne interne) senza bisogno di una ref per ciascuna.

Nessuna modifica a `computeConnections`: la funzione usa già `getBoundingClientRect()` che restituisce coordinate aggiornate dopo lo scroll — mancava solo il trigger.

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | `import React` aggiunto; `ConnectionsOverlay` accetta `workScrollRef` con listener capture; `ColonneWork` convertita a `forwardRef`; `workColsRef` aggiunto al root e passato ai due componenti |

---

## Note per sessioni future

- La soluzione è minimale e non richiede ref per ogni colonna — il capturing cattura tutto.
- `removeEventListener` con `{ capture: true }` deve usare la stessa opzione dell'`addEventListener`, altrimenti il listener non viene rimosso.
- Piano della sessione: `docs/plans/active/2026-04-08-02-fix-frecce-svg-scroll-work-plan.md`
