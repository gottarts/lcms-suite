# Resoconto sessione — Lavagna CRM: raggruppamento, selezione, azioni Work

**Data:** 2026-04-20
**Oggetto:** Feature e fix sulla vista Lavagna dello Schema Calibrazione

---

## Cosa è stato fatto

Implementate 7 task sulla lavagna React Flow (`SchemaCalibrazione.lavagna.tsx`):
- Aggiunta props callback da root a `SchemaLavagna` (toggle mix/sng, delete/drawer/ricarica Work, rimuovi CRM)
- Fix blocco analiti IS: sempre visibili come coperti indipendentemente dal filtro dest. uso
- Click su card CRM aggiorna `selSrcs` condiviso → pulsante "Crea Work" esistente si attiva
- Pulsante × su card Mix e Sng per rimuoverle dalla lavagna
- Pulsanti Dettaglio/Ricarica/× su card Work (WorkDrawer, RicaricaDialog, delete)
- Toggle collassa/espandi chip componenti su Mix e preparazioni NEAT su Sng
- GroupNode React Flow per CRM con analiti in comune (union-find clustering)

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/metodi/SchemaCalibrazione.lavagna.tsx` | Tutti i task sopra |
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | Props callback + `analitiPerLavagna` per fix IS |

---

## Note per sessioni future — Problemi aperti

- **Selezione per Crea Work**: attualmente click su card fa toggle `selSrcs` MA usa un handler separato dal sistema di selezione visiva (highlight frecce). Sarebbe meglio unificare: la selezione multipla delle card (click + shift-click) dovrebbe aggiornare `selSrcs` direttamente, senza handler duplicato.
- **Work come sorgenti dalla lavagna**: non implementato. Click su card Work non aggiunge a `selSrcs` come sorgente intermedia.
- **GroupNode dimensioni**: la logica di clustering è corretta ma il bounding box del gruppo è calcolato sulle posizioni assolute di tutti i membri — se le card sono sparse, il gruppo diventa enorme e ingloba visivamente card non correlate. Fix: al momento del layout iniziale Dagre, posizionare i membri dello stesso cluster vicini prima di calcolare le dimensioni del gruppo.
- **Badge scadenza CRM e Prep NEAT**: le card sulla lavagna mostrano già `scadenzaBadge()` per data scadenza, ma mancano i badge alert colorati (rosso/arancio) sulle card Mix per CRM scaduti e sulle card Sng per preparazioni NEAT scadute — da allineare al markup della griglia.

Spec completa: `docs/superpowers/specs/2026-04-19-lavagna-crm-grouping-features-design.md`
Piano: `docs/superpowers/plans/2026-04-19-lavagna-crm-grouping-features.md`
