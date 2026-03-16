# Bugfix Report — post fix(bulk) commit

---

## Bug 1 — Mix-scope dialog: conteggio errato "cancella 16 invece di 14" (Medium)

**File:** `src/renderer/pages/composti/CompostiPage.tsx`, `src/main/ipc/composti.ipc.ts`

**Sintomo:** nel dialog mix-scope per la cancellazione, il bottone "Tutto il mix" mostrava un numero più alto del previsto. Con un mix da 14 componenti e 2 selezionati, mostrava 16 invece di 14.

**Causa:** `handleBulkDelete` usava `composti:delete-by-lotto` (`DELETE WHERE lotto = ?`) per eliminare tutto il mix. Se lo stesso numero di lotto era condiviso con composti singoli fuori dal mix, questi venivano conteggiati e poi eliminati insieme. Il `totalCount` mostrato nel dialog (da `count-by-mix`, `COUNT WHERE mix_id = ?`) era corretto (14), ma l'operazione effettiva agiva su più record (14 + 2 = 16).

**Fix:**
- Backend: aggiunto handler `composti:delete-by-mix-id` che fa `DELETE WHERE mix_id = ?` — elimina esattamente e solo i componenti del mix.
- Frontend: `handleBulkDelete` ora usa `delete-by-mix-id` invece di `delete-by-lotto` per l'opzione "tutto il mix" nel bulk. Il delete singolo dal pannello laterale continua a usare `delete-by-lotto` (comportamento invariato).
- Messaggio dialog migliorato: da *"2 componenti del mix (14 totali)"* a *"2 di 14 componenti del mix"* — elimina ambiguità visiva che portava l'utente a sommare i due numeri.

---

## Bug 2 — MixPesticidiForm: componenti importati senza mix_id, forma=Mix e badge (Critical)

**File:** `src/renderer/pages/composti/MixPesticidiForm.tsx`

**Sintomo:** dopo aver importato un file con più lotti dal `TextImportDialog`, selezionato un lotto dal picker e premuto "Crea Mix", i composti venivano creati senza `mix_id`, senza `forma = 'Mix'` e senza badge MIX nella tabella.

**Causa:** tre problemi concatenati.

**Causa 1 — picker non aggiornava `importedFields`:** il click inline nel picker (`selezioneLottiOpen`) impostava `componentiImportati` e `nomi`, ma non aggiornava `importedFields`. In particolare non aggiungeva `'nomi'` al set. Senza il flag `'nomi'` in `importedFields`, `handleSave` entrava nel **CASO B** (nomi da file .txt semplice) invece del **CASO A** (componenti con dati per riga). Il CASO B chiama `createMix` con `nomi: string[]` anziché `componenti: ComponenteImportato[]`, producendo composti senza `mix_id`.

**Causa 2 — `canSave` bloccava il salvataggio:** `canSave` richiedeva `importedFields.has('forma_commerciale')` o `form.forma_commerciale` non vuota. Se il file non aveva la colonna `forma_commerciale`, il bottone "Crea Mix" rimaneva disabilitato e l'utente non poteva procedere.

**Causa 3 — picker appariva troppo tardi:** il dialog di selezione lotti veniva aperto solo in `handleSave` (dopo che l'utente aveva compilato tutti i campi e premuto "Crea Mix"), invece che immediatamente dopo l'import del file. Se l'utente compilava i campi e poi annullava il picker, perdeva tutto.

**Fix:**

- Estratta funzione `handleLottoSelect(gruppo)` che sostituisce il click inline nel picker. Imposta `componentiImportati`, `nomi` e ricostruisce `importedFields` con tutti i campi presenti nel gruppo (incluso `'nomi'`). Se tutti i componenti hanno la stessa `forma_commerciale`, la imposta nel form.
- `canSave` cambiato da `importedFields.has('forma_commerciale')` a `importedFields.has('nomi')` — se i componenti sono importati da file il salvataggio è abilitato indipendentemente da `forma_commerciale`.
- Guard in `handleSave` allineata alla stessa logica.
- `formaCommercialeGruppo` aggiunto fallback al lotto del gruppo se né il file né il form hanno `forma_commerciale`.
- Il picker ora si apre subito in `handleTextImport` appena viene rilevato che ci sono più lotti distinti, non più in `handleSave`.

---

## File modificati

| File | Tipo | Descrizione |
|---|---|---|
| `src/main/ipc/composti.ipc.ts` | Modificato | Aggiunto handler `composti:delete-by-mix-id` |
| `src/renderer/pages/composti/CompostiPage.tsx` | Modificato | Bulk delete usa `delete-by-mix-id`; messaggio dialog migliorato |
| `src/renderer/pages/composti/MixPesticidiForm.tsx` | Modificato | Fix picker lotti: `handleLottoSelect`, `canSave`, apertura anticipata del picker |