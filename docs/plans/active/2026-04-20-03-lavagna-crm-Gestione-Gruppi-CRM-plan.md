# Piano di modifica: Lavagna Schema Calibrazione – Gestione Gruppi CRM

## 1. Panoramica del problema

Attualmente nella vista "Lavagna" (`SchemaCalibrazione.lavagna.tsx`):
- I rettangoli grigi (`CrmGroupNode`) che raggruppano CRM con analiti in comune **si sovrappongono** verticalmente.
- I gruppi **non sono trascinabili**, né da soli né insieme alle card che contengono.
- Il layout iniziale posiziona i nodi clusterizzati consecutivamente senza alcuno spazio extra, causando l’accavallamento dei bounding box.

## 2. Obiettivi delle modifiche

| Obiettivo | Descrizione |
|-----------|-------------|
| **Separazione visiva** | Garantire uno spazio verticale minimo (`GROUP_GAP`) tra un cluster e il successivo, e tra l’ultimo cluster e i nodi singoli. |
| **Trascinamento gruppo** | Rendere i `CrmGroupNode` trascinabili, spostando contemporaneamente tutte le card figlie. |
| **Persistenza posizioni** | Mantenere il salvataggio su `localStorage` delle posizioni assolute delle card anche dopo lo spostamento del gruppo. |
| **Feedback utente** | Mostrare il cursore `grab` sul gruppo e consentire l’interazione senza interferire con le card. |

## 3. Modifiche al codice

### 3.1 Aggiunta della costante `GROUP_GAP`

**File:** `SchemaCalibrazione.lavagna.tsx`  
**Posizione:** dopo la dichiarazione di `LAYOUT`

```tsx
const GROUP_GAP = 120; // spazio verticale extra tra cluster
```

### 3.2 Correzione del layout iniziale (`computeInitialLayout`)

**Modifica:** all'interno del ciclo `for (const [k, arr] of grouped)`, sostituire la logica di stacking verticale con una versione che introduca il gap quando cambia il cluster.

```tsx
let cursorY = LAYOUT.Y_START;
let currentCluster: string | null = null;

for (const n of ordered) {
  const m = modById.get(n.id);
  if (!m) continue;

  const clusterId = nodeClusterMap.get(n.id) || null;

  // Aggiungi gap quando si cambia cluster (o si passa a nodi senza cluster)
  if (currentCluster !== clusterId && cursorY > LAYOUT.Y_START) {
    cursorY += GROUP_GAP;
  }

  positions[n.id] = { x: xOf(k), y: cursorY };
  cursorY += estimatedHeight(m) + LAYOUT.ROW_GAP;
  currentCluster = clusterId;
}
```

### 3.3 Abilitazione del drag sui gruppi

**Modifica:** in `structuralNodes`, quando si creano i `groupNodes`, impostare `draggable: true`.

```tsx
groupNodes.push({
  id: groupId,
  type: 'group',
  position: { x: dims.x, y: dims.y },
  style: { width: dims.width, height: dims.height },
  draggable: true,      // ← abilita il trascinamento
  selectable: false,
  data: { analitiCondivisi: cluster.analitiCondivisi } as CrmGroupNodeData,
  zIndex: -1,
});
```

### 3.4 Rimozione di `pointerEvents: 'none'` dal componente `CrmGroupNode`

**Modifica:** nel JSX di `CrmGroupNode`, rimuovere la proprietà che bloccava gli eventi del mouse e aggiungere un cursore `grab`.

```tsx
return (
  <div style={{
    width: '100%', height: '100%',
    border: `1.5px dashed ${C.page.brd2}`, borderRadius: 10,
    background: 'rgba(245,245,243,0.55)', boxSizing: 'border-box',
    // pointerEvents: 'none',  ← RIMOSSO
    cursor: 'grab',
  }}>
    {/* ... */}
  </div>
);
```

### 3.5 Gestione dello spostamento del gruppo in `handleNodesChange`

**Modifica:** estendere la funzione per riconoscere il trascinamento di un nodo di tipo `group` e aggiornare le posizioni assolute di tutte le card figlie.

```tsx
const handleNodesChange = useCallback((changes: NodeChange[]) => {
  onNodesChange(changes);
  let dragging = false;

  for (const ch of changes) {
    if (ch.type === 'position') {
      if (ch.dragging) {
        dragging = true;
      } else if (ch.position) {
        const node = rfNodes.find(n => n.id === ch.id);
        if (!node) continue;

        if (node.type === 'group') {
          // Spostamento di un gruppo → aggiorna posizioni assolute di tutte le card figlie
          const groupId = ch.id;
          const newGroupPos = ch.position;
          const oldGroupNode = rfNodes.find(n => n.id === groupId);
          if (!oldGroupNode) continue;

          const dx = newGroupPos.x - oldGroupNode.position.x;
          const dy = newGroupPos.y - oldGroupNode.position.y;

          const childNodes = rfNodes.filter(n => n.parentId === groupId);
          for (const child of childNodes) {
            const oldChildAbs = {
              x: oldGroupNode.position.x + child.position.x,
              y: oldGroupNode.position.y + child.position.y,
            };
            setPosition(child.id, oldChildAbs.x + dx, oldChildAbs.y + dy);
          }
        } else {
          // Card normale (già gestita)
          const clusterId = nodeToCluster.get(ch.id);
          const groupNode = clusterId ? rfNodes.find(n => n.id === clusterId) : undefined;
          const absX = groupNode ? ch.position.x + groupNode.position.x : ch.position.x;
          const absY = groupNode ? ch.position.y + groupNode.position.y : ch.position.y;
          setPosition(ch.id, absX, absY);
        }
      }
    }
  }
  isDraggingRef.current = dragging;
}, [onNodesChange, setPosition, nodeToCluster, rfNodes]);
```

## 4. Istruzioni di test

1. **Pulire il localStorage**  
   Aprire gli strumenti sviluppatore (F12) → scheda *Application* → *Local Storage* → eliminare la chiave che inizia con `lcms:lavagna:positions:v2:`.

2. **Caricare la lavagna**  
   Verificare che:
   - I rettangoli grigi siano **separati verticalmente** (nessuna sovrapposizione).
   - I nodi non appartenenti a cluster appaiano **dopo** tutti i gruppi.

3. **Trascinare un gruppo**  
   - Cliccare su un'area vuota del rettangolo grigio (bordo o spazio tra i badge analiti).
   - Trascinare: il gruppo e tutte le card contenute devono spostarsi insieme.
   - Al rilascio, le nuove posizioni devono essere salvate (ricaricando la pagina il gruppo rimane dove lasciato).

4. **Trascinare una card interna**  
   - Le card possono ancora essere spostate singolarmente (la loro posizione relativa al gruppo viene aggiornata correttamente).

5. **Riallinea layout**  
   - Cliccare sul pulsante *Riallinea* per ripristinare il layout iniziale con i gap.

## 5. Note aggiuntive

- Il valore `GROUP_GAP = 120` può essere regolato a piacere per ottenere maggiore o minore separazione.
- Le card spostate al di fuori del bounding box del gruppo rimangono associate logicamente al cluster ma non più visivamente contenute (comportamento accettabile per questa iterazione).
- La modifica non impatta altre funzionalità (frecce, selezione, badge di scadenza, ecc.).

## 6. Riepilogo delle modifiche per file

| File | Linee modificate | Descrizione |
|------|------------------|-------------|
| `SchemaCalibrazione.lavagna.tsx` | Aggiunta costante `GROUP_GAP` | Nuova variabile per il gap tra gruppi |
| `SchemaCalibrazione.lavagna.tsx` | Modifica `computeInitialLayout` | Inserimento del gap durante lo stacking |
| `SchemaCalibrazione.lavagna.tsx` | Modifica `structuralNodes` | Impostazione `draggable: true` per i gruppi |
| `SchemaCalibrazione.lavagna.tsx` | Modifica `CrmGroupNode` | Rimozione `pointerEvents: 'none'` e aggiunta cursore `grab` |
| `SchemaCalibrazione.lavagna.tsx` | Modifica `handleNodesChange` | Gestione spostamento gruppo e aggiornamento figli |

---

**Fine del piano.**