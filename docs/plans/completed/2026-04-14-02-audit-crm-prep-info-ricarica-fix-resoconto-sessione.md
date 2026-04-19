# Resoconto sessione — Audit CRM: info prep + warning scadute + fix Ricarica

**Data:** 2026-04-14
**Oggetto:** Aggiunta informazioni preparazioni all'audit CRM, badge prep Neat scadute, fix dialog Ricarica vuoto quando solo prep scadute

---

## Cosa è stato fatto

- Arricchita la pagina Audit CRM con informazioni sulle preparazioni Neat (flacone, data prep, scadenza prep) visibili nei badge CRM sottostanti agli analiti
- Aggiunto badge "⚠ Prep Neat scadute" nell'header dei Work con preparazioni scadute alla data di audit
- I badge CRM diventano rossi se la preparazione Neat associata è scaduta
- Aggiunto flag `ha_prep_scadute_at_data` propagato dal backend SQL fino all'UI e al PDF
- Report PDF aggiornato: colonna Flag sommario, pillola "PREP SCADUTE" nel banner, riga prep nella cella analiti con sfondo rosso
- Fix bug: il dialog Ricarica (da chip "⚠ Prep stock scadute" in Schema Calibrazione) risultava completamente vuoto — causa: query `check-lot-status` escludeva `source_type='prep'`

---

## Bug risolti / Feature aggiunte

### Fix — RicaricaDialog vuoto per preparazioni scadute
**Root cause:** La query `work:check-lot-status` in `work.ipc.ts` filtrava `WHERE wi.source_type = 'crm'`, escludendo totalmente gli ingredienti `source_type='prep'`. Quando un Work aveva solo preparazioni scadute (nessun CRM scaduto), il dialog riceveva un array vuoto → nessuna sezione visibile, pulsante Conferma disabilitato (`daRisolvere.length === 0`).

**Fix:** Riscritta la query con `WHERE wi.source_type IN ('crm','prep')`, LEFT JOIN condizionale su `preparazioni` e `composti`, e ramo separato nel mapping per gli ingredienti `prep`. I sostituti per le prep scadute sono altre preparazioni attive dello stesso `composto_id`. Il label nel dialog ora mostra "Prep: {nome composto}" per distinguerli visivamente dai CRM.

Nota: `work:ricarica` gestiva già correttamente il ramo `source_type='prep'` (linee 637–649) — era solo l'alimentazione dei dati a mancare.

### Feature — Audit CRM: informazioni preparazioni Neat
**Motivazione:** I badge CRM nell'audit mostravano solo nome e lotto, senza scadenza né dati della preparazione Neat tramite cui il CRM era usato. Impossibile valutare la validità della catena CRM→Prep alla data di audit.

**Implementazione:**
- Backend: aggiunto `source_prep_flacone/data_prep/scadenza/dismissione` nella `stmtIngredienti` del handler `dashboard:audit-crm`
- Model: `CrmUsato` esteso con campi `prep_*` opzionali; mappa `prepInfoByCompostoId` costruita per ogni Work (priorità a prep scadute in caso di più prep dello stesso composto)
- UI: badge CRM esteso con riga `prep: {flacone} · {data} · scad. {scadenza}`, rosso se scaduta

### Feature — Audit CRM: badge e flag prep Neat scadute
**Motivazione:** `ha_crm_scaduti` copriva solo `source_type='crm'`; i Work che usano CRM via preparazione Neat non venivano marcati anche se la prep era scaduta alla data audit.

**Implementazione:**
- Backend: subquery SQL `n_prep_scadute_at_data` nella query `works` (conta prep con `scadenza < @data` e non dismesse alla data)
- Flag `ha_prep_scadute_at_data: boolean` propagato in `AuditWorkRow`
- UI: badge ambra "⚠ Prep Neat scadute" nell'header Work (nascosto se bloccata)
- PDF: pillola "PREP SCADUTE" nel banner scheda Work + `PREP SCAD` nel sommario + sfondo rosso chiaro nella cella CRM quando almeno un CRM ha prep scaduta

---

## File modificati

| File | Modifica |
|------|----------|
| `src/main/ipc/dashboard.ipc.ts` | Aggiunta subquery `n_prep_scadute_at_data` nella query works; aggiunta colonne `source_prep_*` in stmtIngredienti; estrazione flag nel map |
| `src/main/ipc/work.ipc.ts` | Riscritta query `check-lot-status`: include `source_type='prep'`, LEFT JOIN condizionale, ramo mapping separato, sostituti via `preparazioni` attive |
| `src/renderer/pages/dashboard/lib/auditModel.ts` | `CrmUsato` con campi prep opzionali; `AuditWorkRow` con `ha_prep_scadute_at_data`; mappa `prepInfoByCompostoId` e arricchimento `crmSottostanti` |
| `src/renderer/pages/dashboard/lib/auditReport.ts` | Sommario Flag include `PREP SCAD`; banner pillola "PREP SCADUTE"; tabella analiti con riga prep e `didParseCell` per sfondo rosso |
| `src/renderer/pages/dashboard/sections/AuditCrmSection.tsx` | Badge "⚠ Prep Neat scadute"; badge CRM rosso + riga prep info quando scaduta |
| `src/renderer/pages/work/RicaricaDialog.tsx` | Funzione `groupLabel()` con label "Prep: {nome}" per ingredienti prep |

---

## Note per sessioni future

- **Scadenza prep alla data audit vs oggi:** il flag `ha_prep_scadute_at_data` è calcolato rispetto alla `@data` dell'audit (non `date('now')`), coerentemente con la logica storica — corretto.
- **`work:ricarica` non modificato:** il ramo `source_type='prep'` era già presente e funzionante; il fix era solo nella query upstream `check-lot-status`.
- **PDF `didParseCell` e indice riga:** viene usato `data.row.index` per accedere agli analiti — funziona perché la body è costruita nell'ordine di `w.analiti_coperti`. Da monitorare se jspdf-autotable cambia versione.
- **Preparazioni con più flaconi dello stesso composto in un Work:** si tiene la prep più "problematica" (scaduta ha precedenza). Se in futuro si vogliono mostrare tutte le prep, serve un cambio di tipo in `CrmUsato` (array invece di singolo).
- Piano della sessione: `docs/plans/active/2026-04-14-02-audit-crm-prep-info-ricarica-fix-plan.md`
