# Piano: Feature "Preparazione Work" con stato laboratorio

## Context

Attualmente i Work vengono mostrati come blocchi con badge di tipo e tracciabilità, ma non esiste
il concetto di **preparazione fisica in laboratorio**. L'utente vuole poter registrare quando una
work viene preparata (con data), e che ogni blocco mostri visivamente se la soluzione è:
- **Attiva** (in laboratorio, non scaduta)
- **In scadenza** (es. ultimi 20% della validità)
- **Scaduta** (oltre la data di scadenza)
- **Non preparata** (nessuna preparazione registrata)

---

## Proposta A — Preparazione singola (semplice)

Una sola preparazione attiva per volta per ogni Work. Un pulsante nel drawer attiva la
preparazione impostando la data corrente. Si può resettare/rinnovare.

**Vantaggio:** semplice, immediato.
**Svantaggio:** nessuna storia storica delle preparazioni.

---

## Proposta B — Storico preparazioni (consigliata)

Ogni Work può avere N preparazioni storiche. Si registra ogni volta che si prepara fisicamente
la soluzione. L'ultima preparazione attiva determina lo stato del blocco.

**Struttura DB proposta:**

```sql
CREATE TABLE work_preparazioni (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id    INTEGER NOT NULL REFERENCES work(id) ON DELETE CASCADE,
  data_prep  TEXT NOT NULL,   -- ISO date YYYY-MM-DD
  note       TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_work_preparazioni_work ON work_preparazioni(work_id);
```

**Logica di stato** (basata su `validita_mesi` della Work):
- Se nessuna preparazione → badge grigio "Non preparata"
- Se ultima prep + validita_mesi > oggi → **Attiva** (verde)
- Se scadenza entro il 20% della validità → **In scadenza** (ambra)
- Se scaduta → **Scaduta** (rosso)
- Se `validita_mesi` è NULL → nessuno stato di scadenza (solo "Preparata il gg/mm/yyyy")

---

## Implementazione consigliata (Proposta B)

### File da modificare / creare

| File | Operazione |
|------|-----------|
| `src/main/migrations/014-work-preparazioni.sql` | NUOVO — tabella `work_preparazioni` |
| `src/shared/types.ts` | Aggiungere `WorkPreparazione` interface + campo `ultima_preparazione?` e `stato_lab?` in `Work` |
| `src/main/ipc/work.ipc.ts` | Aggiungere handlers: `work:prepara`, `work:preparazioni-list`, query per join con ultima preparazione in `work:list` e `work:get` |
| `src/renderer/lib/api.ts` | Aggiungere `workApi.prepara()`, `workApi.preparazioniList()` |
| `src/renderer/pages/work/WorkDrawer.tsx` | Sezione "Preparazione" con pulsante "Registra preparazione", data ultima prep, storico collassabile |
| `src/renderer/pages/work/WorkPage.tsx` (WorkCard) | Badge stato laboratorio colorato in base allo stato |

### Dettaglio implementazione

#### 1. Migration (014-work-preparazioni.sql)
- Crea tabella `work_preparazioni` come sopra

#### 2. Types (types.ts)
```typescript
export interface WorkPreparazione {
  id: number
  work_id: number
  data_prep: string   // YYYY-MM-DD
  note: string | null
  created_at: string
}

// In Work, aggiungere:
ultima_preparazione?: WorkPreparazione | null
stato_lab?: 'attiva' | 'in_scadenza' | 'scaduta' | 'non_preparata'
```

#### 3. IPC handlers (work.ipc.ts)
- `work:prepara` — INSERT in work_preparazioni, riceve `{ work_id, data_prep, note? }`
- `work:preparazioni-list` — SELECT * FROM work_preparazioni WHERE work_id = ? ORDER BY data_prep DESC
- In `work:list` e `work:get` — LEFT JOIN con ultima preparazione (subquery MAX(data_prep))
- Lo stato `stato_lab` viene calcolato lato main (confronto date) e restituito

#### 4. WorkCard — nuovo badge stato lab
Aggiungere sotto ai badge esistenti un badge colorato:
- Verde: "Attiva · scade il gg/mm/yyyy"
- Ambra: "In scadenza · gg/mm/yyyy"
- Rosso: "Scaduta · il gg/mm/yyyy"
- Grigio chiaro: "Non preparata" (solo se validita_mesi presente — le "al momento" non mostrano questo badge)

#### 5. WorkDrawer — sezione Preparazione
Aggiungere sezione dopo i badge:
- Se non preparata: pulsante "Registra preparazione" (con datepicker default oggi)
- Se preparata: mostra data, stato, pulsante "Rinnova preparazione"
- Link/toggle per vedere lo storico delle preparazioni passate (lista compatta)
- Campo note opzionale alla registrazione

---

## Scelte UX confermate

1. **Le work "al momento" (validita_mesi NULL)** — **nessun badge** preparazione: non partecipano
   alla feature (non ha senso senza validità).

2. **Il datepicker** nel drawer: default = oggi, modificabile (l'utente può antidatare).

3. **Storico completo**: tutte le preparazioni vengono salvate, visibili come lista collassabile
   nel drawer.

4. **Soglia "in scadenza"**: fissa al 20% del periodo di validità (es. 6 mesi → ultimi ~36 gg).

---

## Verifica (testing manuale)
1. Aprire un Work con `validita_mesi` impostato → drawer → registrare preparazione → verificare
   badge verde su WorkCard
2. Impostare data prep di N mesi fa (oltre validità) → verificare badge rosso "Scaduta"
3. Impostare data prep vicina alla scadenza → verificare badge ambra "In scadenza"
4. Work "al momento" (validita_mesi NULL) → registrare preparazione → nessun badge scadenza
5. Verificare che lo storico preparazioni sia visibile nel drawer
