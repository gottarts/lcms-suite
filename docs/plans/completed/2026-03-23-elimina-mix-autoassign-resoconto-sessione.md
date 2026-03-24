# Resoconto sessione — 2026-03-23 — Elimina mix + Auto-assign mix_id

## Obiettivo della sessione

Implementare due feature per il DB Composti:
1. **Elimina da drawer con scelta mix**: quando si elimina un composto che fa parte di una mix, il dialog deve chiedere se eliminare solo quel composto o l'intera mix.
2. **Auto-assign mix_id per lotto**: aggiungendo composti con forma=Mix e lotto di una mix già esistente, il sistema assegna automaticamente il mix_id esistente.

## Lavoro svolto

### Feature 1: Elimina singolo — "Solo questo" vs "Tutto il mix"

- **composti.ipc.ts**: `composti:count-by-lotto` ora restituisce anche `mix_id` nel risultato
- **CompostiPage.tsx**:
  - `handleDelete` usa `delete-by-mix-id` invece di `delete-by-lotto` (più preciso)
  - Nuovo callback `handleDeleteSingle` per eliminare solo il singolo composto
  - ConfirmDialog con `secondaryAction`: 3 opzioni (Annulla / Solo questo composto / Tutto il mix)
  - Tipo state `deleteMixInfo` esteso con campo `mix_id`

### Feature 2: Auto-assign mix_id per lotto esistente

- **composti.ipc.ts**:
  - Nuovo handler `composti:find-mix-id-by-lotto` — cerca mix_id esistente per un dato lotto
  - `composti:create`: auto-assign mix_id quando forma=Mix, lotto presente e mix_id non fornito
  - `composti:create-mix`: riusa mix_id esistente se il lotto corrisponde a una mix nel DB
- **ImportDialog.tsx**: nel post-processing dell'import CSV, sostituisce mix_id generati con quelli esistenti nel DB

## File modificati

| File | Tipo modifica |
|------|---------------|
| `src/main/ipc/composti.ipc.ts` | 4 modifiche: return mix_id, nuovo handler, auto-assign in create, riuso in create-mix |
| `src/renderer/pages/composti/CompostiPage.tsx` | Stato, callbacks, ConfirmDialog con secondaryAction |
| `src/renderer/pages/composti/ImportDialog.tsx` | Check DB per mix_id esistenti nel batch import |

## Stato

Implementazione completata. Da testare manualmente:
1. Elimina da drawer un composto mix → verificare dialog a 3 opzioni
2. Import CSV con lotto di mix esistente → verificare auto-assign mix_id
3. Creazione mix da MixPesticidiForm con lotto esistente → verificare riuso mix_id
