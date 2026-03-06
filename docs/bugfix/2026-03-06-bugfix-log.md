# Bugfix Log — 2026-03-06

## Fix: CompostoForm — tasto Crea non funzionava

**Problema:** `composti:create` IPC handler lanciava 
`RangeError: Missing named parameter "data_dismissione"`.
Il form non inviava tutti i campi previsti dalla query INSERT.

**Fix:** In `composti.ipc.ts`, costruito oggetto `row` completo 
con tutti i campi della tabella, usando `?? null` come default 
per i campi mancanti.

**File modificati:**
- `src/main/ipc/composti.ipc.ts`