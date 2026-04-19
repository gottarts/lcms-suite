# Piano: Fix Lavagna — Analiti come nodo RF, card adattive, frecce bezier, routing anti-overlap

## Context

L'utente ha segnalato 4 problemi visivi nella Lavagna (SchemaCalibrazione.lavagna.tsx):

1. **Colonna analiti fuori dal canvas** — la `SidebarAnaliti` è un elemento DOM fisso laterale (flex sibling di ReactFlow). Deve diventare un nodo React Flow draggabile sulla lavagna, con frecce verso i CRM.
2. **Card troncate** — le card dei nodi hanno `width` fissa (340/260/360px) ma alcune risultano tagliate. L'altezza deve adattarsi al contenuto (già parzialmente calcolata in `estimatedHeight`, ma `overflow: hidden` in CardBase taglia il contenuto).
3. **Sovrapposizioni frecce/card** — gli edge `smoothstep` passano sopra card facilmente evitabili.
4. **Frecce ad angoli retti** — `smoothstep` produce spezzate ortogonali. L'utente vuole curve Bezier morbide (tipo `default` di React Flow = bezier).

---

## File critico

- `src/renderer/pages/metodi/SchemaCalibrazione.lavagna.tsx`

---

## Implementazione

### Fix 1 — Analiti come nodo React Flow

**Problema**: `SidebarAnaliti` è fuori dal canvas ReactFlow (flex sibling), con larghezza fissa 240px.

**Soluzione**:
- Rimuovere `<SidebarAnaliti>` dal layout flex esterno.
- Creare un nuovo tipo nodo `analiti` (custom node `AnalitiNode`) che renderizza lo stesso contenuto dell'attuale sidebar (filtri + lista analiti con chip IS/M/S).
- Aggiungere il nodo `analiti` a `nodeTypes`.
- Posizionarlo di default a sinistra dei mix (es. `x: -280, y: 40`) con la stessa logica di persistenza posizione degli altri nodi.
- Creare edges da `analiti` verso ciascun modulo Mix/Sng che copre l'analita (frecce visive, non interactive, colore neutro o per tipo).
- Il nodo analiti deve avere solo `Handle type="source" position=Right` (nessun target).
- **Dimensione**: larghezza fissa 240px, altezza adattiva al numero di analiti.

### Fix 2 — Card a dimensione adattata al contenuto

**Problema**: `CardBase` ha `overflow: 'hidden'` che taglia il contenuto quando supera l'altezza minima. Le width sono fisse ma le card sembrano troncate.

**Soluzione**:
- Rimuovere `overflow: 'hidden'` da `CardBase` (riga ~526).
- Le width fisse restano (340/260/360px), ma l'altezza diventa automatica (`height: auto`, non impostata).
- Aggiornare `estimatedHeight()` per calcoli di layout più precisi se necessario (non critico per la visualizzazione, ma utile per il dagre).

### Fix 3 — Frecce bezier invece di smoothstep

**Problema**: `type: 'smoothstep'` produce angoli retti. L'utente vuole curve morbide come in origine.

**Soluzione**:
- Cambiare `type: 'smoothstep'` → `type: 'default'` (bezier) in `computeEdges()` alla riga 224.
- Cambiare `defaultEdgeOptions={{ type: 'smoothstep' }}` → `defaultEdgeOptions={{ type: 'default' }}` in ReactFlow props (riga 908).

### Fix 4 — Ridurre sovrapposizioni frecce/card

**Problema**: con bezier le frecce possono ancora passare sopra card intermedie.

**Soluzione**:
- Aumentare `ranksep` in dagre da 180 → 280 per aumentare la distanza orizzontale tra colonne.
- Aumentare `ROW_GAP` da 60 → 80 per più spazio verticale tra card.
- Le bezier con più spazio orizzontale trovano percorsi naturali che evitano card intermedie.
- Nessuna custom edge routing necessaria per ora.

---

## Ordine di esecuzione

1. Fix 3 (tipo frecce: 2 righe) — immediato, bassa invasività
2. Fix 2 (overflow hidden: 1 riga) — immediato
3. Fix 4 (ranksep/ROW_GAP) — 2 costanti
4. Fix 1 (AnalitiNode) — il più esteso: nuovo nodo + rimozione sidebar + edges analiti→CRM

---

## Verifica

- Avviare il dev server (`npm run dev` o equivalente)
- Aprire un metodo con almeno 3 analiti, mix e work
- Verificare: analiti draggabili sulla lavagna con frecce verso i CRM
- Verificare: card non troncate (altezza si adatta)
- Verificare: frecce curve (bezier)
- Verificare: nessuna sovrapposizione evidente frecce/card
- Verificare: hover su analita nel nodo ancora funzionante (highlightedIds)
