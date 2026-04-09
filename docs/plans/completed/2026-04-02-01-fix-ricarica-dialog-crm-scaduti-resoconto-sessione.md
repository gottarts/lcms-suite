# Resoconto sessione — Fix RicaricaDialog per CRM scaduti

**Data:** 2026-04-02
**Oggetto:** Fix del form di ricarica (RicaricaDialog) che non funzionava per le work con CRM scaduti

---

## Cosa è stato fatto

Investigato e risolto un bug nel `RicaricaDialog` che impediva la sostituzione dei lotti CRM scaduti: il dropdown risultava vuoto e il pulsante "Conferma e Ricarica" rimaneva disabilitato.

La sessione è iniziata come pianificazione di estensione più ampia (WorkPage + SchemaCalibrazione + filtro selezione CRM), ma durante l'analisi è emerso il bug critico nel dialog, che è stato risolto come priorità principale.

---

## Bug risolti

### RicaricaDialog — dropdown vuoto per CRM scaduti (componenti di mix)

**Root cause:** La funzione `getMixOpzioni` in `RicaricaDialog.tsx` filtrava i sostituti con `if (s.mix_id && ...)`, scartando silenziosamente tutti i sostituti con `mix_id = null`. Per i CRM scaduti (non dismessi), il backend `work:check-lot-status` cerca sostituti per nome — e può trovare composti singoli (senza mix) con lo stesso nome. Questi hanno `mix_id = null` e venivano tutti scartati → dropdown vuoto → `tuttiRisolti = false` → bottone disabilitato.

Il bug non si manifestava per i CRM **dismessi** perché in quel contesto i sostituti erano sempre altri lotti dello stesso mix (con `mix_id` valorizzato).

**Fix:** `getMixOpzioni` ora distingue i due tipi di sostituto:
- sostituti con `mix_id`: trattati come prima, deduplicati per `mix_id`
- sostituti singoli (`mix_id = null`): inclusi usando `id` come chiave univoca

Il `value` del `<option>` nel dropdown usa ora il formato `"single:<id>"` per i singoli, e `handleMixScelta` / `getMixSceltaAttuale` gestiscono entrambi i formati.

**Fix secondario:** Le label "Lotto attuale (dismesso)" nelle sezioni "Scelta richiesta" ora mostrano "scaduto" o "dismesso" in base al campo `rep.data_dismissione`.

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/work/RicaricaDialog.tsx` | Fix `getMixOpzioni`, `handleMixScelta`, `getMixSceltaAttuale`, render `<option>`, label dismesso/scaduto |

---

## Note per sessioni future

- La sessione ha identificato altri tre miglioramenti non ancora implementati (rimandati):
  1. **WorkPage**: il pulsante "Schema ↗" dovrebbe diventare "Aggiorna Schema ↗" con stile giallo anche per `haScaduti`, come già fatto per `isBloccata` (arancio). Modifica in `WorkPage.tsx` righe 321–330.
  2. **Filtro mix scaduti in SchemaCalibrazione.logic.ts**: il filtro `disponibili` esclude i singoli scaduti ma include i componenti di mix scaduti (guardia `!r.mix_id`). Rimuovere la guardia per escludere anche i componenti di mix senza rivalidazione valida.
  3. **Stesso filtro in AggiungiASchemaDialog.tsx**: identica modifica alla funzione `buildCrmItems`.

- Il piano completo (incluse le tre estensioni future) è in `docs/plans/active/2026-04-02-01-fix-ricarica-dialog-crm-scaduti-plan.md`.

- Attenzione: il backend `work:check-lot-status` (in `work.ipc.ts`) quando cerca sostituti usa `nome = ?` senza filtro su `mix_id`. Questo significa che per un componente di mix scaduto può trovare sostituti sia mix che singoli — comportamento intenzionale per massimizzare le opzioni di sostituzione.
