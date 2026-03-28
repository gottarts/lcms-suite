# Piano: Semplificazione meccanismo ambiguità Work + segnalazione CRM scaduti

## Context

Il sistema attuale blocca una work per due motivi distinti:
1. **`dismesso`**: un CRM usato nella work è stato dismesso → blocco legittimo
2. **`ambiguo`**: il CRM usato NON è dismesso, ma esistono altri CRM attivi con lo stesso nome → blocco NON necessario

Il motivo per cui il caso 2 è superfluo: la work memorizza già il riferimento preciso al CRM scelto dall'operatore tramite `source_id` in `work_ingredienti`. Avere un secondo lotto attivo dello stesso analita non crea ambiguità — la work sa esattamente quale CRM sta usando. L'operatore aveva scelto volutamente quel CRM al momento della creazione.

Inoltre, la funzione "Ricarica lotti" crea già una NUOVA work (archivando la vecchia), quindi il flusso corretto esiste per i casi di CRM dismesso.

L'unica ambiguità sensata e non gestita: un CRM usato in una work esistente **diventa scaduto** dopo la creazione della work (senza essere dismesso). Questo non viene segnalato.

## Modifiche da fare

### 1. Rimuovere blocco `ambiguo` da work.ipc.ts

**File**: `src/main/ipc/work.ipc.ts`

**Cambio**:
- Rimuovere il conteggio `n_ingredienti_ambigui` dalla query
- La work è `bloccata` solo se `n_ingredienti_bloccati > 0` (CRM dismessi)
- `motivo_blocco` = solo `'dismesso'` o `null`

### 2. Aggiungere rilevazione CRM scaduti in works esistenti

**File**: `src/main/ipc/work.ipc.ts`

**Cambio**: aggiungere conteggio `n_ingredienti_scaduti` — CRM non dismessi con `scadenza_prodotto < oggi` e nessuna rivalidazione valida. Vale sia per singoli che per componenti di mix.

**Non blocca la work**, aggiunge solo `ha_crm_scaduti: boolean`.

### 3. Mostrare warning CRM scaduti nell'UI

- `WorkDrawer.tsx`: banner giallo sotto il banner blocco
- `WorkPage.tsx`: badge giallo "CRM scaduti" sulla card

### 4. Aggiornare tipo Work in types.ts

- Aggiunto `ha_crm_scaduti?: boolean`
- Rimosso `'ambiguo'` dall'union type di `motivo_blocco`

---

## File critici

| File | Scopo |
|------|-------|
| `src/main/ipc/work.ipc.ts` | Query SQL ambiguità + logica bloccata |
| `src/shared/types.ts` | Tipo Work |
| `src/renderer/pages/work/WorkDrawer.tsx` | Banner warning CRM scaduti |
| `src/renderer/pages/work/WorkPage.tsx` | Badge su WorkCard |

## NON toccare
- `src/renderer/pages/work/RicaricaDialog.tsx` — il flusso ricarica resta invariato
- `src/renderer/pages/metodi/SchemaCalibrazione.tsx` — filtro CRM a creazione è corretto
- Logica di ricarica in work.ipc.ts — invariata

## Verifica

1. Work con CRM attivo + secondo lotto stesso analita → work NON più bloccata
2. Work con CRM scaduto (scadenza passata, nessuna rivalidazione) → badge giallo + banner giallo
3. La preparazione resta possibile anche con CRM scaduto
