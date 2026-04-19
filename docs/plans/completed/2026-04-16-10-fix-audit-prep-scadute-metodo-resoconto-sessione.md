# Resoconto sessione — Fix audit: prep scadute filtrate per metodo auditato

**Data:** 2026-04-16
**Oggetto:** Il badge "Prep Neat scadute" nell'audit compariva anche quando le prep scadute coprivano solo analiti NON accreditati nel metodo in esame. Fix + differenziazione visiva UI e PDF.

---

## Cosa è stato fatto

- Aggiunto campo `ha_prep_scadute_solo_non_accreditati` nel modello audit, calcolato confrontando le prep scadute della work con gli analiti effettivamente coperti dal metodo auditato (`coperti`).
- `ha_prep_scadute_at_data` mantenuto al valore grezzo SQL (non filtrato), così il flag è sempre veritiero rispetto alla work.
- UI: badge differenziato — "⚠ Prep Neat scadute (analiti non accreditati nel metodo)" vs "⚠ Prep Neat scadute".
- PDF scheda work: etichetta e larghezza rettangolo adattati al caso "non accreditati".
- PDF tabella riepilogativa: colonna Flag mostra "PREP SCAD (non accr.)" vs "PREP SCAD".
- PDF: "Scadenza work | Analiti coperti" spostato al margine destro (`align: 'right'`) per evitare sovrapposizione con i badge di flag.

---

## Bug risolti / Feature aggiunte

### Fix: prep scadute non filtrate per metodo auditato
**Root cause:** `ha_prep_scadute_at_data` veniva calcolato dalla query SQL contando tutte le prep scadute della work, senza sapere quali analiti appartengono al metodo in esame. Nel caso della work FFFF, la prep `25DILE188A_finto` (scad. 2026-05-10) copriva 23 analiti presenti nella work ma nessuno nel metodo auditato.
**Fix:** Aggiunto `ha_prep_scadute_solo_non_accreditati` calcolato in `auditModel.ts` dopo la costruzione di `coperti`. Badge e PDF differenziano i due casi visivamente.

### Fix: "Scadenza work" sovrapposta ai badge nel PDF
**Root cause:** Coordinata x fissa (`DEFAULT_MARGINS.left + 64`) non teneva conto della larghezza variabile dei badge.
**Fix:** Testo ancorato al margine destro con `align: 'right'`.

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/dashboard/lib/auditModel.ts` | Aggiunto campo `ha_prep_scadute_solo_non_accreditati` nel tipo `AuditWorkRow` e nel calcolo |
| `src/renderer/pages/dashboard/sections/AuditCrmSection.tsx` | Badge differenziato per i due casi |
| `src/renderer/pages/dashboard/lib/auditReport.ts` | Etichetta PDF differenziata; scadenza work ancorata a destra |

---

## Note per sessioni future

- Il campo `n_prep_scadute_at_data` nella query SQL in `dashboard.ipc.ts` resta invariato e corretto: conta le prep scadute della work indipendentemente dal metodo, che è il comportamento voluto (il flag va mostrato sempre, solo con etichetta diversa).
- Se in futuro si vuole fare lo stesso per `ha_crm_scaduti`, la logica è analoga: ricalcolare dal basso usando `coperti` invece del valore grezzo.
