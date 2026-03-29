# Resoconto sessione — Revert CRM Mix Lane System

**Data:** 2026-03-29
**Oggetto:** Rimozione del sistema corsie (lane) per i CRM mix nello Schema Calibrazione — revert a colonna singola

---

## Cosa è stato fatto

Richiesta dell'utente: eliminare tutto il sistema "corsie" (lane) introdotto nel commit `65d7b9e`, che gestiva mix a composizione diversa con colonne multiple, colori, linee SVG tratteggiate e frammenti. Tornare a una singola colonna CRM Mix pulita.

Il lavoro si è svolto in due tentativi:

1. **Primo tentativo (fallito):** modifiche manuali chirurgiche ai 3 file SchemaCalibrazione. Tecnicamente corrette ma l'utente ha voluto un approccio più netto.
2. **Secondo tentativo (corretto):** `git revert 65d7b9e` — inversione precisa del commit incriminato, senza toccare nulla d'altro.

---

## Decisione architetturale

Il commit `65d7b9e` era un'unica unità atomica che toccava solo i file SchemaCalibrazione + docs. Il revert era quindi sicuro e chirurgico: non c'erano dipendenze nei commit successivi (`e9b432e`, `8d7f2e2`) sui meccanismi lane/frammenti.

La gestione di **più lotti della stessa miscela** (stessa composizione, `mix_id` diversi) è lasciata aperta per una sessione futura — da affrontare con un approccio più semplice e concordato prima dell'implementazione.

---

## Bug / Problemi emersi

### Lane system troppo complesso / non voluto
**Root cause:** Il commit `65d7b9e` ha introdotto un sistema per gestire mix a composizione *diversa* (analiti sovrapposti tra mix diversi) che l'utente non aveva richiesto in quei termini, o di cui non aveva compreso l'impatto visivo prima dell'implementazione.

**Fix:** `git revert 65d7b9e` — commit `846daf5`.

---

## Commit di questa sessione

| Hash | Descrizione |
|------|-------------|
| `846daf5` | revert: CRM Mix lane system — torna a colonna singola |

---

## File modificati dal revert

| File | Modifica |
|------|----------|
| `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx` | Rimossi lane system, CONN_COLORS, SVG connectors, frammenti |
| `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts` | Rimossa `computeMixFragmentsAndLanes()` e import `MixFragment` |
| `src/renderer/pages/metodi/SchemaCalibrazione.types.ts` | Rimossa interfaccia `MixFragment` |
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | Ripristinata riga cambiata nel commit originale |
| `docs/plans/active/2026-03-29-crm-mix-lane-system-plan.md` | Eliminato (era il piano del commit revertito) |
| `docs/plans/active/2026-03-29-crm-mix-lane-system-resoconto-sessione.md` | Eliminato (era il resoconto del commit revertito) |

---

## Note per sessioni future

- **La colonna CRM Mix è ora di nuovo singola e semplice.** Prima di aggiungere qualsiasi supporto per più lotti o più mix, concordare esplicitamente con l'utente il comportamento visivo.
- La struttura `AnalitoItem.mixIds: string[]` (many-to-many) introdotta nel commit `65d7b9e` è stata anch'essa revertita — se serve in futuro, reintrodurla con cautela.
- Il piano di questa sessione (`adaptive-frolicking-bengio.md`) descriveva un approccio intermedio (rimozione chirurgica manuale) che è stato scartato in favore del revert git.
- `extraSrcs` in `WorkInSchema` e `ricostruisciWorkInSchema` sono rimasti intatti — fanno parte di commit precedenti (`8d7f2e2`).
