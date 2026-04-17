# Resoconto sessione — Versionamento analiti metodo per Audit

**Data:** 2026-04-17
**Tipo:** feat (nuova funzionalità)

## Problema

L'audit CRM cerca gli analiti accreditati del metodo per mostrare work e CRM collegati. Ma gli analiti possono cambiare nel tempo (aggiunti/rimossi/modificati). Quando si fa un audit per una data passata, il sistema usava la lista analiti **attuale** invece di quella attiva alla data dell'audit, producendo risultati errati.

## Soluzione implementata

Sistema di versionamento basato su snapshot JSON: ogni mutazione della lista analiti genera una copia completa dello stato. L'audit usa lo snapshot più recente <= data audit.

## File creati

| File | Descrizione |
|------|-------------|
| `src/main/migrations/026-metodo-analiti-versioni.sql` | Nuova tabella `metodo_analiti_versioni` + seed iniziale per tutti i metodi esistenti |
| `src/main/ipc/metodo-analiti-snapshot.ts` | Helper condiviso `snapshotMetodoAnaliti()` |

## File modificati

| File | Modifica |
|------|----------|
| `src/main/ipc/metodo-analiti.ipc.ts` | Snapshot in 5 handler (`add`, `remove`, `update`, `bulk-set-accreditato`, `bulk-update-alias`) + nuovo handler `metodo-analiti:versioni` |
| `src/main/ipc/metodi.ipc.ts` | Snapshot in `create`, `update`, `merge` |
| `src/main/ipc/dashboard.ipc.ts` | Query audit usa snapshot storico con fallback alla tabella live |
| `src/renderer/lib/api.ts` | Aggiunto `metodoAnalitiApi.versioni()` |
| `src/renderer/pages/metodi/MetodoDrawer.tsx` | Sezione espandibile "Versioni precedenti" con cronologia e dettaglio analiti per versione |

## Schema DB aggiunto

```sql
metodo_analiti_versioni (
  id          INTEGER PK AUTOINCREMENT,
  metodo_id   TEXT FK → metodi(id) ON DELETE CASCADE,
  snapshot    TEXT NOT NULL,  -- JSON array degli analiti
  motivo      TEXT,           -- 'create'|'update'|'add'|'remove'|'bulk-accreditato'|'bulk-alias'|'merge'
  created_at  TEXT DEFAULT datetime('now')
)
```

## Logica chiave

- **Snapshot**: cattura JSON completo `{nome, ordine, accreditato, alias_strumento, alias_lims, alias_oqlab}` dopo ogni mutazione, dentro la stessa transazione
- **Audit**: cerca `WHERE metodo_id = ? AND created_at <= data + 'T23:59:59'` ORDER BY DESC LIMIT 1
- **Seed migrazione**: crea uno snapshot iniziale per ogni metodo esistente, backdatato a `updated_at` del metodo
- **UI**: sezione collapsibile nel MetodoDrawer, lazy-load delle versioni al primo click, ogni versione espandibile per mostrare la lista analiti con badge accreditato/non-accreditato
