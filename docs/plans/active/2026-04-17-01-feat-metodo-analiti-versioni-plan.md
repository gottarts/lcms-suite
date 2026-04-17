# Piano: Sistema di versionamento analiti metodo per Audit

## Contesto

L'audit CRM cerca gli analiti accreditati di un metodo per trovare work e CRM collegati. Tuttavia, gli analiti di un metodo possono cambiare nel tempo (aggiunti, rimossi, modifiche accreditamento). Quando si fa un audit per una data passata, il sistema usa la lista analiti **attuale** invece di quella **attiva alla data dell'audit**, producendo risultati errati.

**Approccio scelto: snapshot completo.** Ad ogni mutazione della lista analiti, salviamo una copia JSON completa. L'audit poi usa lo snapshot più recente <= data audit. Motivi:
- L'audit necessita della lista completa, non di un diff
- Le liste analiti sono piccole (decine di righe, pochi KB in JSON)
- Le mutazioni sono spesso bulk (DELETE ALL + re-INSERT), rendendo l'event-sourcing scomodo
- Coerente con il pattern `work_ingredienti.lotto_usato` già in uso nel codebase

---

## 1. Migrazione DB — `src/main/migrations/026-metodo-analiti-versioni.sql`

Nuova tabella `metodo_analiti_versioni`:
```sql
CREATE TABLE IF NOT EXISTS metodo_analiti_versioni (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  metodo_id   TEXT    NOT NULL REFERENCES metodi(id) ON DELETE CASCADE,
  snapshot    TEXT    NOT NULL,  -- JSON array: [{nome, ordine, accreditato, alias_strumento, alias_lims, alias_oqlab}]
  motivo      TEXT,              -- 'create'|'update'|'add'|'remove'|'bulk-accreditato'|'bulk-alias'|'merge'
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mav_metodo_data ON metodo_analiti_versioni(metodo_id, created_at);
```

**Seed iniziale** per tutti i metodi esistenti (così l'audit funziona anche per metodi mai modificati dopo la migrazione):
```sql
INSERT INTO metodo_analiti_versioni (metodo_id, snapshot, motivo, created_at)
SELECT ma_agg.metodo_id, ma_agg.snapshot, 'migration-seed',
       COALESCE(m.updated_at, m.created_at, datetime('now'))
FROM (
  SELECT metodo_id,
    '[' || GROUP_CONCAT(json_object('nome', nome, 'ordine', ordine, 'accreditato', accreditato,
      'alias_strumento', alias_strumento, 'alias_lims', alias_lims, 'alias_oqlab', alias_oqlab)) || ']' AS snapshot
  FROM metodo_analiti GROUP BY metodo_id
) ma_agg
JOIN metodi m ON m.id = ma_agg.metodo_id;
```

---

## 2. Helper snapshot — `src/main/ipc/metodo-analiti-snapshot.ts` (NUOVO)

Funzione condivisa chiamata da `metodo-analiti.ipc.ts` e `metodi.ipc.ts`:

```typescript
export function snapshotMetodoAnaliti(db: Database.Database, metodoId: string, motivo: string): void
```

- Legge tutti gli analiti correnti del metodo
- Li serializza in JSON
- INSERT in `metodo_analiti_versioni`
- Da chiamare **dentro la transazione**, **dopo** la mutazione

---

## 3. Punti di integrazione snapshot

### `src/main/ipc/metodo-analiti.ipc.ts`
| Handler | Azione |
|---------|--------|
| `metodo-analiti:add` | Aggiungere `snapshotMetodoAnaliti(db, metodoId, 'add')` in fondo alla transazione |
| `metodo-analiti:remove` | Aggiungere `snapshotMetodoAnaliti(db, metodoId, 'remove')` in fondo alla transazione |
| `metodo-analiti:update` | Recuperare `metodo_id` dalla riga, poi snapshot. Wrappare in transazione |
| `metodo-analiti:bulk-set-accreditato` | Wrappare in transazione + snapshot `'bulk-accreditato'` |
| `metodo-analiti:bulk-update-alias` | Aggiungere snapshot `'bulk-alias'` in fondo alla transazione esistente |

Aggiungere nuovo handler `metodo-analiti:versioni` per il frontend.

### `src/main/ipc/metodi.ipc.ts`
| Handler | Azione |
|---------|--------|
| `metodi:create` | Snapshot `'create'` in fondo alla transazione |
| `metodi:update` | Snapshot `'update'` in fondo alla transazione |
| `metodi:merge` | Snapshot `'merge'` per `destId` in fondo alla transazione |

---

## 4. Modifica query Audit — `src/main/ipc/dashboard.ipc.ts`

Sostituire le righe 146-151 (query `analiti_accreditati`) con logica snapshot-aware:

1. Cercare lo snapshot più recente con `created_at <= data + 'T23:59:59'`
2. Se trovato: parsare JSON, filtrare `accreditato === 1`, usare come `analiti_accreditati`
3. Se non trovato (impossibile dopo seed, ma come fallback): usare la query attuale sulla tabella live

---

## 5. Frontend — Versioni precedenti in MetodoDrawer

**File:** `src/renderer/pages/metodi/MetodoDrawer.tsx`

Aggiungere sotto la sezione "Analiti del metodo" una sezione espandibile (pattern identico a "Storico preparazioni" in WorkPage):

- Bottone "Versioni precedenti" con ChevronUp/Down
- Al click: fetch `metodoAnalitiApi.versioni(metodoId)`
- Lista versioni: data, motivo, conteggio analiti/accreditati
- Ogni versione espandibile per mostrare la lista analiti di quella versione

**File:** `src/renderer/lib/api.ts` — aggiungere `versioni()` a `metodoAnalitiApi`

---

## File da creare/modificare

| File | Azione |
|------|--------|
| `src/main/migrations/026-metodo-analiti-versioni.sql` | **CREARE** — nuova tabella + seed |
| `src/main/ipc/metodo-analiti-snapshot.ts` | **CREARE** — helper condiviso |
| `src/main/ipc/metodo-analiti.ipc.ts` | **MODIFICARE** — import helper, snapshot in 5 handler, nuovo handler `versioni` |
| `src/main/ipc/metodi.ipc.ts` | **MODIFICARE** — import helper, snapshot in create/update/merge |
| `src/main/ipc/dashboard.ipc.ts` | **MODIFICARE** — query audit snapshot-aware (righe 146-151) |
| `src/renderer/lib/api.ts` | **MODIFICARE** — aggiungere `versioni` a `metodoAnalitiApi` |
| `src/renderer/pages/metodi/MetodoDrawer.tsx` | **MODIFICARE** — sezione "Versioni precedenti" |

---

## Verifica

1. **Migrazione**: avviare l'app, verificare che la tabella `metodo_analiti_versioni` esista e contenga seed per tutti i metodi
2. **Snapshot**: modificare analiti di un metodo (aggiungere/rimuovere/cambiare accreditamento), verificare che nuove righe appaiano in `metodo_analiti_versioni`
3. **Audit storico**: fare un audit per una data passata, verificare che usi gli analiti della versione corretta
4. **UI versioni**: aprire MetodoDrawer, espandere "Versioni precedenti", verificare che mostri la cronologia
5. **Fallback**: verificare che metodi senza snapshot (edge case) usino ancora la query live
