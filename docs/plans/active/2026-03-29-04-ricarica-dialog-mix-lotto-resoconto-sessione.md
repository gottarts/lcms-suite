# Resoconto sessione — RicaricaDialog: selezione lotto per mix anziché per composto

**Data:** 2026-03-29
**Oggetto:** Raggruppamento per mix nel dialog di aggiornamento lotti CRM

---

## Cosa è stato fatto

Nel `RicaricaDialog` (dialog "Aggiorna lotti CRM"), quando una work contiene composti appartenenti a una CRM Mix, il dialog mostrava la selezione del lotto **per ogni singolo composto** della mix — N righe identiche per N analiti. Poiché tutti i composti di una mix devono usare lo stesso lotto, è sufficiente 1 sola riga per mix.

Implementato il raggruppamento per `mix_id`:
- Il backend ora restituisce `mix_id` e `forma_commerciale` per ogni ingrediente, e `mix_id` per ogni sostituto
- Il frontend raggruppa gli ingredienti per `mix_id` e mostra 1 sola riga per mix, con la lista dei composti sottostante a titolo informativo
- Il selettore "ambiguo" per mix mostra i **lotti del mix** (distinti per `mix_id` dei sostituti) anziché singoli composti
- La scelta di un lotto mix si propaga a tutti i `source_id` del gruppo tramite match su `mix_id` del sostituto
- I singoli CRM (senza mix) mantengono il comportamento precedente invariato

---

## Feature aggiunte

### Raggruppamento mix in RicaricaDialog

**Motivazione:** Ogni analita di una CRM Mix appariva come riga separata con il proprio selettore lotto, generando ridondanza (es. Mix con 10 analiti → 10 righe identiche). L'utente deve scegliere il lotto della mix, non del singolo analita.

**Implementazione:**
- `work.ipc.ts`: aggiunto `c.mix_id` e `c.forma_commerciale` alla SELECT di `work:check-lot-status`; aggiunto `mix_id` alla SELECT dei sostituti
- `RicaricaDialog.tsx`: nuova funzione `buildGroups()` che raggruppa `lotStatus` per `mix_id` (null = singolo); stato del gruppo = il peggiore tra i membri (mancante > ambiguo > auto > ok)
- Render: 1 riga per gruppo con `forma_commerciale` come etichetta; lista composti sotto come dettaglio non interattivo
- `handleMixScelta()`: on change del selettore mix, cerca per ogni membro del gruppo il sostituto con `mix_id` corrispondente e aggiorna `scelte[source_id]`
- `getMixSceltaAttuale()` e `getMixOpzioni()`: helper per ricavare la scelta corrente e le opzioni disponibili dal primo membro ambiguo del gruppo
- `handleConferma` e `tuttiRisolti` invariati — operano su `scelte` per `source_id`

**Nota architetturale:** Un nuovo lotto di una mix ha sempre `mix_id` diverso dal vecchio (confermato dall'utente). La propagazione della scelta per `mix_id` è quindi affidabile.

---

## File modificati

| File | Modifica |
|------|----------|
| `src/main/ipc/work.ipc.ts` | Aggiunto `mix_id`, `forma_commerciale` alla SELECT ingredienti; aggiunto `mix_id` alla SELECT sostituti in `work:check-lot-status` |
| `src/renderer/pages/work/RicaricaDialog.tsx` | Refactor per raggruppamento per mix: nuova logica `buildGroups`, selettore unico per mix, propagazione scelta, lista composti come dettaglio |

---

## Note per sessioni future

- **`tuttiRisolti`** controlla tutti i `source_id` in `daRisolvere` — funziona correttamente perché `handleMixScelta` popola `scelte` per tutti i member della mix
- Se in futuro una mix ha analiti con stato diverso (es. alcuni ok e altri ambigui nella stessa mix), la logica `getMixOpzioni` usa il primo membro con stato `ambiguo|auto` — da verificare se questo caso può verificarsi in pratica
- Il piano approvato è in `docs/plans/active/2026-03-29-ricarica-dialog-mix-lotto-plan.md`
