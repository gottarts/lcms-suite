# Piano: Riorganizzazione Dashboard

**Data:** 2026-04-10  
**Contesto:** La dashboard attuale è disorganizzata: le scadenze mescolano CRM, preparati e work senza separazione visiva; AuditCRM e TracciabilitaCard sono troppo in basso; i pulsanti KPI non filtrano; non ci sono link diretti a DB Composti con filtri pertinenti.

---

## Obiettivi

1. **Scadenze separate per tipo** — tre sotto-sezioni distinte (CRM, Preparati con link al CRM di origine, Work) invece di una lista mista
2. **Audit trail e Tracciabilità più in alto** — subito dopo i KPI, prima delle scadenze
3. **KPI cards con navigazione filtrata** — ogni card porta a `/composti` con i filtri appropriati
4. **Pulsanti resoconto per CRM e Work** — due bottoni separati nella sezione scadenze che navigano alla tabella scadenze stessa (anchor scroll) o con filtro kind
5. **Pulsanti attivi/dismessi** — navigano a `/composti` con `location.state` corretto (`mostraDismessi: true/false`)

---

## Nuovo ordine layout DashboardPage

```
1. KpiCards             (già esiste — da migliorare con navigazione filtrata)
2. TracciabilitaCard    (spostare su, era riga 3)
3. AuditCrmSection      (spostare su, era riga 4)
4. ScadenzeTimeline     (spostare giù, separata per tipo)
```

---

## Modifiche per sezione

### 1. `KpiCards.tsx` — navigazione filtrata verso CompostiPage

Ogni card passa `location.state` per attivare il filtro giusto:

| Card | State passato |
|------|---------------|
| CRM scaduti | `{ filtroStati: ['scaduto','rivalidato_scaduto'] }` |
| CRM in scadenza | `{ filtroStati: ['in_scadenza','rivalidato_in_scadenza'] }` |
| CRM attivi | `{ filtroStati: ['attivo','rivalidato_attivo'] }` |
| CRM da aprire | `{ filtroStati: ['da_aprire'] }` |
| CRM dismessi | `{ filtroStati: ['dismesso'], mostraDismessi: true }` |

**Richiede:** `CompostiPage.tsx` deve leggere `location.state.filtroStati` e inizializzare `filtroStati` da lì (aggiunta minimale alle righe 344-364).

### 2. `DashboardPage.tsx` — riordino sezioni

```tsx
<KpiCards />
<TracciabilitaCard />
<AuditCrmSection />
<ScadenzeTimeline />
```

### 3. `ScadenzeTimeline.tsx` — separazione per tipo

**Struttura nuova:**  
Tre pannelli collassabili (o semplici sezioni con header) dentro la Card:

- **CRM** — mostra `kind === 'composto'`; click → `/composti` con `{ searchFilter: item.nome }`
- **Preparati** — mostra `kind === 'preparazione'`; mostra il nome composto con link visivo "(vai al CRM)" che naviga a `/composti` con `{ searchFilter: item.composto_nome }`
- **Work** — mostra `kind === 'work'`; click → `/work`

Ogni sezione ha:
- Header con badge count e tone color
- Bucket temporali (scadute / urgenti / prossime / future) propri per quel tipo

**Header della Card:** aggiungere due pulsanti "Resoconto CRM" e "Resoconto Work" — ma dato che la sezione scadenze è ora divisa per tipo, i pulsanti KPI coprono già quel ruolo. Invece aggiungere nella CardHeader due link-button per navigare al DB Composti:
- "Attivi" → `/composti` con `{ filtroStati: ['attivo','rivalidato_attivo','in_scadenza','rivalidato_in_scadenza'] }`
- "Dismessi" → `/composti` con `{ mostraDismessi: true }`

### 4. `CompostiPage.tsx` — accettare `filtroStati` da `location.state`

Aggiunta minimale (riga ~361):
```tsx
const [filtroStati, setFiltroStati] = useState<string[]>(
  (location.state as any)?.filtroStati ?? []
)
```

Questo abilita la pre-selezione del filtro stati quando si naviga dalla dashboard.

---

## File modificati

| File | Modifica |
|------|---------|
| `src/renderer/pages/dashboard/DashboardPage.tsx` | Riordino sezioni |
| `src/renderer/pages/dashboard/sections/KpiCards.tsx` | Navigazione con state filtrato |
| `src/renderer/pages/dashboard/sections/ScadenzeTimeline.tsx` | Separazione per tipo (CRM / Prep / Work), link CRM di origine per prep, pulsanti attivi/dismessi |
| `src/renderer/pages/composti/CompostiPage.tsx` | Lettura `filtroStati` da `location.state` (solo riga ~361) |

---

## Verifica

1. Cliccare "CRM scaduti" → apre DB Composti filtrato solo per stati scaduti
2. Cliccare "CRM dismessi" → apre DB Composti con dismessi visibili e filtrati
3. Dashboard mostra Tracciabilità e Audit sopra le scadenze
4. Sezione scadenze: CRM, Preparati e Work in pannelli separati
5. Preparato in scadenza mostra "(→ CRM: NomeCRM)" e click naviga al CRM
6. Pulsanti "Attivi" e "Dismessi" nella card scadenze navigano correttamente a CompostiPage
