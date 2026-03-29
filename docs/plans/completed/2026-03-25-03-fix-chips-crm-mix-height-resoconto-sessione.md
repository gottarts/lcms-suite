# Resoconto sessione — Fix layout chips CRM mix in SchemaCalibrazione

**Data:** 2026-03-25
**Oggetto:** Ridisegno calcolo altezze righe griglia analiti/CRM per adattamento adattivo al contenuto

---

## Cosa è stato fatto

Redesign completo del motore di calcolo altezze nella griglia `GrigliaAnalitiCrm` di `SchemaCalibrazione.grid.tsx`. Il sistema precedente divideva uniformemente l'altezza stimata della chips mix per il numero di analiti, senza garantire che le righe si adattassero al contenuto reale (né della chips mix, né delle card singoli).

---

## Bug risolti / Feature aggiunte

### Fix: chips CRM mix troncata quando più alta della somma delle righe analita

**Root cause:** Il vecchio `mixPerRowH[mixId]` calcolava `minH / nAna` (altezza per riga uniforme) e poi `rowHeight()` prendeva il massimo tra base singoli e questa quota. Il problema era che se le righe avevano altezze naturali eterogenee (es. un analita con 2 singoli, uno con 0), la somma risultante poteva essere inferiore all'altezza della chips, che veniva quindi troncata.

**Fix:** Sostituito con sistema a tre fasi:
1. `mixChipsH[mixId]` — altezza totale del contenuto della chips (senza divisione per nAna)
2. `mixRowHeights` — per ogni mix calcola le altezze naturali delle righe; se la somma < `mixChipsH`, scala proporzionalmente per riempire lo spazio
3. `rowHeight(a)` legge l'altezza per indice da `mixRowHeights`

### Fix: card singoli troncate quando il contenuto supera ROW=48px

**Root cause:** Il calcolo "naturale" usava `nSingoli * ROW (48px)` come altezza per riga, ma una card singolo può avere fino a 4 righe di testo (cv/forma, lotto, scadenza, rivalidazione) per un totale reale di ~63px.

**Fix:** Aggiunta funzione `sngCardH(crm)` che stima l'altezza reale di una card in base ai campi presenti, e `sngCellH(a)` che somma le card + gap + padding. Queste vengono usate sia nel calcolo `naturals` per i mix che in `rowHeight()` per analiti senza mix.

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx` | Sostituito `mixPerRowH` con `mixChipsH` + `mixRowHeights`; aggiunto `sngCardH` e `sngCellH` per stima altezza reale card singoli |

---

## Note per sessioni future

- Le funzioni `sngCardH` e `sngCellH` usano stime statiche delle altezze (14px per riga testo, 13px per righe secondarie, 3px gap, 6px padding). Se il layout delle card singoli cambia, aggiornare queste costanti.
- Il piano di questa sessione è in `~/.claude/plans/peppy-wishing-star.md`.
- Potenziale area da monitorare: il calcolo `mixChipsH` usa `CHIP_AREA = 236px` (card 254px - 18px padding). Se la larghezza della colonna mix cambia (attualmente 270px), aggiornare questa costante.
- Caso edge da verificare in futuro: analiti con mix che hanno numero molto diverso di singoli (es. 0 vs 3) — la scalatura proporzionale potrebbe rendere la riga con 0 singoli troppo alta rispetto al contenuto visualizzato.
