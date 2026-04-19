# Resoconto sessione — Fix badge prep count e navigazione badge metodo

**Data:** 2026-04-16
**Oggetto:** Fix conteggio badge preparazioni e navigazione da badge metodo a MetodiPage

---

## Cosa è stato fatto

Due fix mirati nel modulo DB Composti:

1. Il badge "prep X" mostrava solo le preparazioni attive — corretto per mostrare il totale (attive + dismesse + scadute).
2. Il click sul badge metodo in CompostoPanel apriva il MetodoDrawer (drawer annidato, poco utile) — sostituito con navigazione diretta a MetodiPage con filtro sul metodo selezionato.

---

## Bug risolti / Feature aggiunte

### Fix 1 — Badge prep: conteggio totale

**Root cause:** La subquery SQL usata era `WHERE composto_id = c.id AND stato = 'Attiva'` (campo `prep_attive_count`), escludendo preparazioni dismesse, esaurite e scadute. Il badge mostrava quindi un numero non corrispondente alla realtà.

**Fix:** Aggiunta nuova subquery `prep_totale_count` senza filtro su `stato`. Il badge in CompostiTable ora usa `prep_totale_count`.

### Fix 2 — Badge metodo → navigazione a MetodiPage con filtro

**Root cause:** In CompostoPanel, il click sui badge metodo chiamava `setSelectedMetodoId()`, aprendo un `MetodoDrawer` annidato. L'utente ritiene questo flusso inutile e preferisce navigare direttamente a MetodiPage con la lista già filtrata sul metodo cliccato.

**Implementazione:**
- CompostoPanel: rimosso `selectedMetodoId` state e import/render di `MetodoDrawer`. Aggiunto `useNavigate` e onClick che chiama `navigate('/metodi', { state: { filtroMetodoId: id } })`.
- MetodiPage: aggiunto `useEffect` che dipende da `[metodi]` — quando la lista è caricata, legge `filtroMetodoId` dallo state di navigazione, cerca il metodo corrispondente e imposta `search` con il suo nome. Lo state viene poi pulito con `window.history.replaceState({}, '')` per evitare loop al refresh.

---

## File modificati

| File | Modifica |
|------|----------|
| `src/main/ipc/composti.ipc.ts` | Aggiunta subquery `prep_totale_count` (COUNT senza filtro stato) |
| `src/renderer/pages/composti/CompostiTable.tsx` | Badge prep usa `prep_totale_count` invece di `prep_attive_count` |
| `src/renderer/pages/composti/CompostoPanel.tsx` | Rimosso MetodoDrawer, aggiunto `useNavigate`, onClick badge metodo ora naviga a `/metodi` |
| `src/renderer/pages/metodi/MetodiPage.tsx` | Aggiunto `useEffect` per leggere `filtroMetodoId` da navigation state e impostare `search` |

---

## Note per sessioni future

- `prep_attive_count` e `prep_scadute_count` rimangono nella query SQL (usati per il badge ⚠ rosso in CompostiTable) — non rimuoverli.
- MetodoDrawer è ancora usato in MetodiPage stessa (per aprire i dettagli di un metodo dalla lista) — non era stato rimosso, solo dal CompostoPanel.
- Il pattern di navigazione con state `{ filtroMetodoId }` segue la stessa convenzione già usata per `searchFilter` e `schemaMetodoId`.
