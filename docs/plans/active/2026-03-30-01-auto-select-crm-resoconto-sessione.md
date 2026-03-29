# Resoconto sessione — Selezione automatica CRM (Mix + Singoli)

**Data:** 2026-03-30
**Oggetto:** Nuovo dialog `AutoSelectDialog` per la selezione automatica ottimale dei CRM nello SchemaCalibrazione

---

## Cosa è stato fatto

Aggiunto un sistema di selezione automatica dei CRM nello SchemaCalibrazione: un nuovo dialog separato (pulsante "Selezione automatica" nella bottom bar) che calcola autonomamente la combinazione ottimale di CRM mix + singoli che massimizza la copertura degli analiti, rispettando la regola di disgiunzione tra mix.

---

## Feature aggiunte

### AutoSelectDialog — Selezione automatica CRM

**Motivazione:** L'utente doveva scegliere manualmente lo scenario di copertura (ScenarDialog) e poi selezionare i singoli uno per uno. Il nuovo sistema automatizza entrambi i passi in un solo dialog con preview del risultato.

**Algoritmo:**
1. Tra i mix disponibili → Scenario 1 da `generaScenari` (sottoinsieme disgiunto, copertura massima)
2. Per ogni analita non coperto dai mix → primo singolo disponibile (`sngIds[0]`)
3. I singoli non vengono mai selezionati per analiti già coperti da mix (rispetto disgiunzione)

**Implementazione:**
- Nuovo file `AutoSelectDialog.tsx` con calcolo in `useMemo` che riusa `buildMixComposizioni` + `generaScenari` già esistenti
- UI: sezioni Mix selezionati / Singoli selezionati / Non coperti / Esclusi (mix in rosso, singoli neutri)
- In `SchemaCalibrazione.tsx`: stato `autoSelectOpen`, handler `handleAutoSelect`, pulsante bottom bar, render dialog

**Bug corretto in sessione:** `handleAutoSelect` inizialmente chiamava solo `handleApplyScenario` (che aggiorna `removedMix` ma non popola `selSrcs`), senza aggiungere i mix a `selSrcs`. Fix: aggiunta esplicita dei mix a `selSrcs` con la stessa struttura di `toggleMix` (incluso calcolo `concVariabile`).

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/metodi/AutoSelectDialog.tsx` | **Nuovo** — dialog selezione automatica CRM |
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | Import + stato `autoSelectOpen` + handler `handleAutoSelect` + pulsante bottom bar + render dialog |

---

## Note per sessioni future

- Il sistema è separato da `ScenarDialog` (che rimane per la scelta manuale dello scenario). I due sistemi coesistono.
- `handleApplyScenario` aggiorna solo `removedMix` e `scenarioScelto`, NON popola `selSrcs` con i mix — chi vuole selezionare mix programmaticamente deve farlo esplicitamente come in `handleAutoSelect`.
- Se in futuro si vorrà permettere di scegliere quale lotto usare tra più lotti della stessa composizione, il punto di intervento è `mixScelti` in `AutoSelectDialog` (ora usa sempre il primo lotto non rimosso).
- Piano di sessione: `docs/plans/active/2026-03-30-01-auto-select-crm-plan.md`
