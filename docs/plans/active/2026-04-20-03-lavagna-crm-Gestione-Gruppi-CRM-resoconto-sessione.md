

**Data:** 2026-04-20  
**Oggetto:** Miglioramento layout e interazione gruppi CRM nella lavagna dello schema di calibrazione

---

## Cosa è stato fatto

Implementazione di migliorie all'interfaccia della lavagna React Flow:

1. **Spazio verticale extra tra cluster CRM**
   - Aggiunta costante `GROUP_GAP = 120` per separare visivamente gruppi di CRM che condividono analiti.
   - Modifica della funzione `computeInitialLayout` per inserire il gap aggiuntivo quando, all'interno della stessa colonna (Mix o Singoli), si passa da un cluster all'altro o a un nodo senza cluster.

2. **Gruppi CRM trascinabili**
   - Il componente `CrmGroupNode` è stato reso interattivo: rimosso `pointerEvents: 'none'` dal contenitore principale e aggiunto `cursor: 'grab'`.
   - I badge interni al gruppo mantengono `pointerEvents: 'none'` per non interferire con il drag del gruppo stesso.
   - I nodi di tipo `group` ora hanno `draggable: true` nella generazione dei nodi strutturali (`structuralNodes`).

3. **Aggiornamento posizioni figli durante il drag del gruppo**
   - Estesa la logica di `handleNodesChange` per riconoscere quando viene spostato un nodo di tipo `group`.
   - Durante il drag del gruppo, viene calcolato lo spostamento (`dx`, `dy`) e tutte le card figlie (Mix/Singoli) vengono aggiornate mantenendo le loro coordinate assolute corrette.
   - Le nuove posizioni assolute dei figli vengono salvate in localStorage tramite `setPosition`.

---

## Bug risolti / Feature aggiunte

### Spazio insufficiente tra cluster di CRM condivisi
**Root cause / Motivazione:**  
Nel layout iniziale, i nodi appartenenti a cluster diversi venivano impilati con il solo `ROW_GAP`, rendendo difficile distinguere visivamente i confini tra gruppi di CRM che condividono analiti.

**Fix / Implementazione:**  
- Introdotto `GROUP_GAP = 120` in `LAYOUT`.
- In `computeInitialLayout`, durante il ciclo di posizionamento verticale per colonna, viene tenuta traccia del cluster corrente. Quando si passa a un cluster diverso (o a un nodo senza cluster) e il cursore Y non è all'inizio, viene aggiunto `GROUP_GAP`.
- Il risultato è un layout iniziale più leggibile e arioso tra cluster.

### Impossibilità di trascinare i gruppi CRM
**Root cause / Motivazione:**  
I gruppi CRM erano elementi puramente visivi, non trascinabili. Per riorganizzare manualmente lo schema, l'utente doveva spostare singolarmente ogni card CRM, operazione lenta e soggetta a errori.

**Fix / Implementazione:**  
- Abilitato `draggable: true` per i nodi di tipo `group` in `structuralNodes`.
- Modificato `CrmGroupNode` rimuovendo `pointerEvents: 'none'` dal div contenitore e aggiungendo `cursor: 'grab'` per indicare l'interattività.
- Mantenuto `pointerEvents: 'none'` solo sul div interno dei badge per evitare che questi blocchino il drag.

### Posizioni figlie non aggiornate al trascinamento del gruppo
**Root cause / Motivazione:**  
Precedentemente `handleNodesChange` non gestiva il caso di spostamento di un gruppo. Di conseguenza, le coordinate assolute delle card figlie non venivano ricalcolate e il salvataggio in localStorage non rifletteva la nuova disposizione.

**Fix / Implementazione:**  
- Estesa `handleNodesChange` per intercettare i cambi di posizione su nodi di tipo `group`.
- Calcolato il delta di spostamento rispetto alla posizione precedente del gruppo.
- Per ogni nodo figlio (identificato da `parentId`), ricalcolata la posizione assoluta (vecchia assoluta + delta) e chiamato `setPosition`.
- Per i nodi non di gruppo, mantenuta la logica esistente di conversione relativo→assoluto.
- Le nuove posizioni vengono correttamente salvate in localStorage tramite l'hook `useLavagnaPositions`.

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/components/SchemaCalibrazione/SchemaCalibrazione.lavagna.tsx` | Aggiunta costante `GROUP_GAP`. Modificata `computeInitialLayout` per gap tra cluster. Modificato `CrmGroupNode` (rimosso pointerEvents su wrapper, aggiunto cursor: grab). Modificato `structuralNodes` (draggable: true per gruppi). Esteso `handleNodesChange` per gestire spostamento gruppi e aggiornamento figli. |

---

## Note per sessioni future

- **Interazione gruppo già testata manualmente**: Il trascinamento del gruppo sposta correttamente tutte le card figlie e aggiorna le coordinate salvate. Il comportamento è fluido e coerente con React Flow.

- **Riallineamento automatico**: Il pulsante "Riallinea" chiama `resetLayout`, che rigenera le posizioni usando `computeInitialLayout`. Poiché questa funzione ora include il `GROUP_GAP`, il riallineamento produrrà lo stesso layout arioso tra cluster.

- **Compatibilità localStorage**: La chiave di persistenza (`LS_KEY_PREFIX`) è rimasta invariata. Le posizioni salvate in precedenza continueranno a funzionare; il nuovo `GROUP_GAP` verrà applicato solo durante il primo calcolo del layout per nodi mancanti o dopo un reset esplicito.

- **Possibili miglioramenti futuri**:
  - Rendere configurabile il `GROUP_GAP` dall'esterno (es. tramite prop o costante globale).
  - Aggiungere una leggera ombreggiatura di sfondo ai gruppi durante il drag per migliorare il feedback visivo.
  - Considerare l'aggiunta di un'animazione di snap quando si rilascia un gruppo vicino ad altri cluster.