# Resoconto sessione — Warning tracciabilità Work figlia/madre

**Data:** 2026-04-17
**Oggetto:** Avviso visivo quando una Work figlia è stata preparata prima dell'ultima preparazione della sua Work sorgente (madre rinnovata anticipatamente)

---

## Cosa è stato fatto

Implementata una feature di controllo tracciabilità sulla relazione Work madre/figlia: quando una Work madre viene ri-preparata (es. perché la soluzione finisce prima della scadenza), le Work figlie che la usano come sorgente risultano "obsolete" perché contengono materiale dalla madre precedente.

Il sistema ora segnala questa condizione in due posti:
- **WorkPage (lista):** badge giallo inline accanto al pulsante Prepara/Rinnova — "Figlie da ripreparare" sulla madre, "Sorgente rinnovata" sulla figlia
- **WorkDrawer (dettaglio):** banner giallo con lista delle figlie obsolete (lato madre) e banner giallo "Una Work sorgente è stata ri-preparata dopo questa work" (lato figlia)

Soglia: confronto strettamente `<` su `data_prep` (nessuna tolleranza). Severità: solo warning visivo, non bloccante.

---

## Feature aggiunte

### Warning tracciabilità Work figlia/madre

**Motivazione:** Una Work madre può esaurirsi fisicamente prima della scadenza teorica. L'operatore ne registra una nuova preparazione, ma le Work figlie restano con data_prep antecedente — tracciabilità rotta.

**Implementazione:**

1. **`workTree.ts`** — aggiunti due flag a `WorkTreeProblemi`:
   - `figlia_prep_obsoleta`: true se almeno una child work ha `ultima_prep_data < ultima_prep_data` della madre corrente
   - `sorgente_rinnovata`: true se almeno una sorgente diretta ha `ultima_prep_data > ultima_prep_data` della work corrente (prospettiva figlia)
   - Entrambi propagati verso l'alto con OR logico

2. **`work.ipc.ts`** — nuovo handler `work:figlie-obsolete`: query inversa che, dato un `workId`, restituisce le work figlie non archiviate con `ultima_prep_data < ultima_prep` della madre. Usato dal drawer lato madre per listare le figlie con nome e data.
   - Aggiunta anche alla query `work:list` di due subquery inline (`n_figlie_obsolete`, `n_sorgenti_rinnovate`) per alimentare i badge della lista senza chiamate extra per riga.

3. **`api.ts`** — aggiunto `workApi.figlieObsolete(workId)`.

4. **`WorkDrawer.tsx`** — nuovi state `figlieObsolete` e `sorgenteObsoleta`, caricati nell'`useEffect`. Due banner gialli: lista figlie obsolete (madre) e avviso sorgente rinnovata (figlia). Il flag `sorgente_rinnovata` (non `figlia_prep_obsoleta`) è quello corretto per la prospettiva figlia — bug corretto durante la sessione.

5. **`WorkPage.tsx`** — due badge gialli con `AlertCircle` inline accanto al pulsante Prepara/Rinnova.

**Bug corretto in corso d'opera:** il primo tentativo usava `figlia_prep_obsoleta` per il banner della figlia, ma quel flag segnala la prospettiva madre ("ho figlie obsolete"). Per la figlia serviva il confronto inverso (`child.ultima_prep_data > ultimaPrep.data_prep`) → nuovo flag `sorgente_rinnovata`.

---

## File modificati

| File | Modifica |
|------|----------|
| `src/main/services/workTree.ts` | Aggiunti flag `figlia_prep_obsoleta` e `sorgente_rinnovata` a `WorkTreeProblemi` + logica di confronto e propagazione |
| `src/main/ipc/work.ipc.ts` | Nuovo handler `work:figlie-obsolete` + subquery `n_figlie_obsolete`/`n_sorgenti_rinnovate` in `work:list` |
| `src/renderer/lib/api.ts` | Aggiunto `workApi.figlieObsolete` |
| `src/renderer/pages/work/WorkDrawer.tsx` | State + useEffect + due banner gialli warning |
| `src/renderer/pages/work/WorkPage.tsx` | Due badge inline accanto al pulsante Prepara/Rinnova in `WorkRow` |

---

## Note per sessioni future

- La query `work:list` ora ha due subquery aggiuntive con correlazioni annidate — se la lista diventa molto larga (centinaia di work) potrebbe rallentare. Monitorare.
- `sorgente_rinnovata` è calcolato solo per sorgenti **dirette** (un livello). Per catene profonde (nonna→madre→figlia) la figlia vede la madre rinnovata, ma non necessariamente la nonna. Valutare se serve propagazione ricorsiva in futuro.
- Il piano di questa sessione è in `~/.claude/plans/esiste-la-possibilita-che-dreamy-duckling.md` (copiato qui come `*-plan.md`).
