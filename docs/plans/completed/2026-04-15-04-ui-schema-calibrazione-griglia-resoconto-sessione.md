# Resoconto sessione — UI Schema Calibrazione: griglia più larga, avviso CRM scadute, fix spazio vuoto

**Data:** 2026-04-15
**Oggetto:** Miglioramenti UI alla griglia dello Schema Calibrazione

---

## Cosa è stato fatto

Tre modifiche UI alla griglia dello Schema Calibrazione:
1. Allargamento colonne della griglia CRM (Analiti, Mix, Singoli)
2. Aggiunto avviso visivo rosso "⚠ SCADUTA" per CRM con `scadenza_prodotto` passata
3. Allargamento colonne Work a 380px
4. Fix striscia vuota in fondo alla schermata

---

## Bug risolti / Feature aggiunte

### Colonne griglia CRM più larghe
**Motivazione:** Le colonne erano strette e lasciavano spazio vuoto a destra; con intermedie attive si attivava lo scroll orizzontale inutilmente.
**Implementazione:** Analiti 190→210, CRM Mix 270→300, Singoli/Neat 260→290 (totale 720→800px). Aggiornati anche `CHIP_AREA` (236→266) e il `left` della card mix assoluta (190→210).

### Avviso CRM scadute nella griglia
**Motivazione:** Le CRM con `scadenza_prodotto` passata non avevano nessun indicatore visivo nella griglia — il testo della scadenza era grigio neutro sia se valida che se scaduta.
**Fix:** Aggiunto `oggi` con `useMemo` nel componente `GrigliaAnalitiCrm`. Per le card singoli (riga ~494) e le card mix (riga ~617): se `scadenza_prodotto < oggi` il testo diventa rosso `#dc2626` e appare `⚠ SCADUTA` accanto alla data. Le CRM rivalidate continuano a mostrare "Rivalidato · scad. est." in arancione invariato.

### Colonne Work più larghe
**Motivazione:** Dopo l'allargamento della griglia CRM, le colonne Work (270px) sembravano strette a confronto.
**Implementazione:** Work 270→380px in `ColonneWork` (vale per Work lv0 e tutte le intermedie).

### Fix striscia vuota in fondo
**Motivazione:** In fondo alla schermata appariva una striscia vuota visibile solo con lo Schema Calibrazione.
**Root cause:** Il container root usava `height:'calc(100vh - 48px - 32px)'` — valore hardcoded che non corrispondeva all'altezza reale disponibile nel layout.
**Fix:** Sostituito con `height:'100%'` per adattarsi al contenitore padre.

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx` | Larghezze colonne CRM, CHIP_AREA, left card mix, `oggi` useMemo, avviso SCADUTA su card singoli e mix |
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | Larghezza colonne Work 270→380px, height root `calc(...)` → `100%` |

---

## Note per sessioni future

- L'avviso SCADUTA non appare per le prep stock Neat (hanno `scadenza` della preparazione, non `scadenza_prodotto`) — se serve anche lì, aggiungere la stessa logica nel blocco Neat (riga ~448).
- `height:'100%'` funziona perché `MetodiPage` monta `SchemaCalibrazione` in sostituzione diretta del contenuto della pagina; se in futuro il mount point cambia, verificare che il padre abbia `height` definita.
