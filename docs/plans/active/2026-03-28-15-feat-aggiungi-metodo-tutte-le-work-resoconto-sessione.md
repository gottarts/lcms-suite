# Resoconto sessione — "+ Metodo ↗" esteso a tutte le work

**Data:** 2026-03-28
**Oggetto:** Estensione pulsante "+ Metodo ↗" a tutte le work in WorkPage (non solo orfane)

---

## Cosa è stato fatto

Il pulsante "+ Metodo ↗" nelle card di WorkPage era visibile solo per le work orfane (`primo_metodo_id === null`). L'utente voleva poterlo usare anche per work già associate a un metodo, per aggiungere associazioni multiple.

La logica esistente (dialog `AggiungiASchemaDialog`, IPC `metodi:list-for-work`) era già generica — la restrizione era solo nella condizione di rendering. Aggiunto anche il filtro per escludere dalla lista i metodi già associati alla work.

---

## Feature aggiunte

### "+ Metodo ↗" su tutte le work
**Motivazione:** Le work già associate a un metodo potevano essere aggiunte a un secondo schema solo passando per ImportaWorkDialog. L'utente voleva farlo direttamente dalla card.

**Implementazione:**
- `WorkPage.tsx` riga 132: rimossa condizione `!w.primo_metodo_id`. Il pulsante appare sempre, sia per work orfane che per work già associate.
- Per work con metodo, la card ora mostra tutti e 3 i pulsanti: "Prepara", "Schema ↗", "+ Metodo ↗".

### Filtro metodi già associati in AggiungiASchemaDialog
**Motivazione:** Aprendo il dialog da una work già associata al metodo X, la lista non deve mostrare X (l'utente non può ri-associare la stessa work allo stesso metodo).

**Implementazione:**
- Primo `useEffect` di `AggiungiASchemaDialog`: carica in parallelo `metodiApi.listForWork(workId)` e `workApi.get(workId)`. Quest'ultimo restituisce `metodi_ids` (da `work_metodi`). I metodi già presenti in `metodi_ids` vengono filtrati dalla lista.
- Nessuna nuova dipendenza: `workApi.get` era già importato nel file.

### Tooltip aggiornato
"Aggiungi questa work a un metodo di calibrazione" → "Aggiungi questa work a un metodo"

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/work/WorkPage.tsx` | Rimossa condizione `!w.primo_metodo_id` su `onAddToSchema`; tooltip abbreviato |
| `src/renderer/pages/work/AggiungiASchemaDialog.tsx` | Primo `useEffect` carica anche `workApi.get` e filtra metodi già associati; commento header aggiornato |

---

## Note per sessioni future

- `work_metodi` è una cache sincronizzata con il JSON `schema_calibrazione`. È affidabile per il filtro in apertura dialog; la fonte di verità assoluta rimane il JSON.
- Se una work è associata a tutti i metodi compatibili, la lista sarà vuota — il dialog mostra già "Nessun metodo disponibile".
- Piano di sessione: `docs/plans/active/2026-03-28-15-feat-aggiungi-metodo-tutte-le-work-plan.md`
