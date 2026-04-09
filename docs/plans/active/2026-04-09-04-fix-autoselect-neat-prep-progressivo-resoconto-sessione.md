# Resoconto sessione — Fix selezione automatica Neat con preparato a progressivo maggiore

**Data:** 2026-04-09
**Oggetto:** La selezione automatica nello SchemaCalibrazione non selezionava il preparato stock dei CRM Neat

---

## Cosa è stato fatto

Corretto il comportamento della funzione `handleAutoSelect` in `SchemaCalibrazione.tsx`: quando la selezione automatica include un CRM di tipo Neat, ora seleziona automaticamente anche il suo preparato stock con progressivo maggiore (il più recente), invece di lasciare il Neat come semplice singolo senza prep.

---

## Bug risolti / Feature aggiunte

### Fix: auto-select Neat non selezionava il preparato stock

**Root cause:** In `handleAutoSelect`, per i CRM singoli veniva sempre aggiunto `tipo: 'sng'`. I Neat hanno preparati stock (`prepStock`) che devono essere selezionati esplicitamente come `tipo: 'prep'` per essere usabili come sorgente nelle Work. L'utente era costretto a cliccare manualmente il chip del preparato dopo ogni selezione automatica.

**Fix:** Nel loop dei `sngIds`, verificato se il CRM è Neat (`forma === 'neat'`). Se Neat e ha preparati, si seleziona il preparato con `progressivo` più alto tramite `reduce`. La chiave in `selSrcs` diventa `prep_${prep.id}` con `tipo: 'prep'`, includendo `prepId`, `lotto`, `flacone`, `progressivo`. Se il Neat non ha preparati attivi, si ricade sul comportamento precedente (`tipo: 'sng'`).

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | `handleAutoSelect` linee 1089-1103: gestione Neat con selezione prep a progressivo maggiore |

---

## Note per sessioni future

- Il piano completo è in `docs/plans/active/2026-04-09-04-fix-autoselect-neat-prep-progressivo-plan.md`
- La logica di calcolo del `cv` per il preparato è identica a quella usata nel grid (`SchemaCalibrazione.grid.tsx:388`): `concReale ?? concTarget ?? Number(conc) ?? 0`
- Se in futuro si aggiunge la selezione automatica di preparazioni intermedie (Work), seguire lo stesso pattern di `tipo: 'work'`
