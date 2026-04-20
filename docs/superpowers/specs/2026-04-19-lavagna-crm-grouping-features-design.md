# Design: Lavagna CRM — Raggruppamento, Fix Analiti, Feature Griglia

**Data:** 2026-04-19  
**Scope:** `SchemaCalibrazione.lavagna.tsx` e nodi correlati

---

## Contesto

La lavagna (SchemaCalibrazione in modalità React Flow) è attualmente una visualizzazione read-only del schema di calibrazione. Mancano diverse feature presenti nella griglia:
- I CRM con analiti in comune non sono raggruppati visivamente
- Il blocco analiti non rispetta correttamente il filtro dest. uso e i badge IS
- Le card CRM non mostrano tutti gli analiti (troncati)
- Non è possibile selezionare CRM per creare Work dalla lavagna
- Mancano: WorkDrawer su click Work, Ricarica, Cancella card, badge scadenza

---

## 1. Raggruppamento CRM con analiti in comune

### Logica di clustering
Prima della costruzione dei nodi, calcolare i cluster: due CRM appartengono allo stesso gruppo se condividono almeno un analita. Implementare con union-find semplice su `crmItems` + `analiti`.

- Cluster con 2+ CRM → nodo `type: 'group'` React Flow padre
- Cluster con 1 solo CRM → nessun wrapper (evitare GroupNode inutili)

### GroupNode
- `parentId` e `extent: 'parent'` sui nodi figli
- Dimensioni del GroupNode generose: padding abbondante attorno alle card figlie (il bordo del gruppo è significativamente più grande della somma delle dimensioni delle card), così le card possono essere riposizionate liberamente all'interno senza uscire
- Sfondo semi-trasparente neutro, bordo leggero (non interferisce con colori verde/azzurro card)
- Header con analiti condivisi del cluster (max 4 nomi, poi "+N")

### Layout Dagre
- I gruppi vengono layoutati come nodi compositi: figli posizionati internamente, poi il gruppo posizionato nel grafo globale
- Mantiene ordine Left→Right esistente (Mix | Singoli | Work)
- Persistenza posizioni in localStorage include le posizioni dei GroupNode

---

## 2. Blocco Analiti — fix filtro e badge IS

### Regola
Riusare **esattamente** la stessa logica della griglia (`SchemaCalibrazione.grid.tsx`) per:
- Calcolo analiti coperti/scoperti con filtro `filtroDestUso`
- Analiti IS: sempre visibili e considerati coperti indipendentemente dal filtro dest. uso (i CRM IS non vengono mai esclusi dal calcolo copertura, anche con filtro "taratura" o "qc")
- Badge IS: lo stile attuale della lavagna (chip nella sidebar) va bene — non modificare il look, solo correggere la logica di copertura

Non reinventare — estrarre/condividere la funzione di derivazione se necessario.

---

## 3. Card CRM — analiti completi con toggle

**ModuloMixNode e ModuloSngNode:**
- Tutti gli analiti visibili (nessun troncamento fisso)
- Default: collassati (max 4 chip visibili)
- Pulsante "▼ N analiti" espande inline — stato expand in `useState` locale al nodo
- Badge scadenza CRM e badge prep NEAT scaduta: riuso esatto della logica e markup dalla griglia

---

## 4. Selezione CRM e Crea Work

**Principio: zero nuova logica, zero nuovi pulsanti.**

- Click su card CRM (mix o singolo) → aggiorna `selSrcs: Map<string, SorgenteSel>` già condiviso con il resto del componente
- Il pulsante "Crea Work" esistente nell'header della pagina e la selezione automatica esistente reagiscono automaticamente a `selSrcs` senza modifiche
- `ModalCreaWork` riusata identica — nessuna modifica

---

## 5. Feature contestuali sui nodi Work

Tutte le funzioni esistenti, chiamate dai nodi della lavagna con gli stessi parametri:

| Feature | Implementazione |
|---------|----------------|
| **Apri WorkDrawer** | Click card Work → chiama la stessa funzione di apertura WorkDrawer della griglia |
| **Ricarica** | Pulsante nella card Work → stessa logica di ricarica esistente |
| **Cancella card CRM** | Pulsante × su card CRM → aggiunge a `removedMix` (mix) o equivalente singoli, identico alla griglia |

---

## File critici

| File | Ruolo |
|------|-------|
| `src/renderer/pages/metodi/SchemaCalibrazione.lavagna.tsx` | Componente principale lavagna — modifiche principali |
| `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx` | Sorgente delle logiche da riusare (non modificare) |
| `src/renderer/pages/metodi/SchemaCalibrazione.types.ts` | Tipi CrmItem, AnalitoItem, SorgenteSel |
| `src/renderer/pages/metodi/nodes/ModuloMixNode.tsx` | Card mix — fix analiti + toggle + badge |
| `src/renderer/pages/metodi/nodes/ModuloSngNode.tsx` | Card singoli — fix analiti + toggle + badge |
| `src/renderer/pages/metodi/nodes/ModuloWorkNode.tsx` | Card work — WorkDrawer + Ricarica |

---

## Verifica

1. Con filtro dest. uso su "Taratura": analiti IS appaiono coperti (non scoperti)
2. Card mix con molti analiti: chip collassate di default, espandibili con toggle
3. Due CRM che coprono gli stessi analiti: appaiono in un GroupNode con header analiti condivisi
4. Click su card CRM: `selSrcs` si aggiorna, pulsante "Crea Work" nell'header si attiva
5. Click su card Work: WorkDrawer si apre correttamente
6. Pulsante × su card CRM: il CRM viene rimosso dalla lavagna (removedMix aggiornato)
7. Badge scadenza visibili su card scadute, identici alla griglia
