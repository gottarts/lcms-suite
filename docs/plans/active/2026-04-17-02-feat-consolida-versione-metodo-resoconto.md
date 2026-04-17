# Resoconto sessione: Consolida Versione Metodo Analiti
**Data:** 2026-04-17  
**Commit:** feat: consolida versione metodo analiti

## Obiettivo

Aggiungere alla funzionalità di versionamento analiti (introdotta nella sessione 0195707) un'operazione di consolidamento che elimina le versioni intermedie e crea un unico snapshot auditabile. Necessario perché ogni singola modifica in fase di messa a punto generava una versione separata, rendendo la lista versioni caotica.

## Cosa è stato fatto

### Backend
- Aggiunto handler IPC `metodo-analiti:consolida` in `src/main/ipc/metodo-analiti.ipc.ts`
- In transazione: DELETE di tutte le versioni con `motivo NOT IN ('consolida', 'migration-seed')`, poi `snapshotMetodoAnaliti(db, metodoId, 'consolida')`
- Nessuna migrazione: il campo `motivo` esisteva già, `'consolida'` è un nuovo valore nello stesso campo

### Frontend API
- Aggiunto `consolida(metodoId)` a `metodoAnalitiApi` in `src/renderer/lib/api.ts`

### Frontend UI (`MetodoDrawer.tsx`)
- Pulsante "Consolida versione" (icona `PackageCheck`, testo arancione) accanto al toggle "Versioni precedenti"
- Il pulsante appare solo se esistono versioni intermedie (`versioni.some(...)`)
- `ConfirmDialog` variant `danger` con avviso esplicito: le versioni intermedie non saranno più auditabili
- Nella lista versioni, le voci consolidate/seed hanno bordo verde e badge "consolidata"
- Dopo conferma: chiama `consolida()`, poi ricarica la lista versioni

## Impatto audit

L'audit CRM (`dashboard:audit-crm`) cerca `created_at <= data_audit ORDER BY created_at DESC LIMIT 1`. Dopo il consolidamento, per date intermedie trova il consolidamento precedente o il seed — coerente con la scelta di rendere non-auditabili le versioni intermedie tra consolidamenti.

## File modificati

- `src/main/ipc/metodo-analiti.ipc.ts` (+15 righe)
- `src/renderer/lib/api.ts` (+2 righe)
- `src/renderer/pages/metodi/MetodoDrawer.tsx` (+46 righe nette)
- `docs/plans/active/2026-04-17-02-feat-consolida-versione-metodo-plan.md` (nuovo)
