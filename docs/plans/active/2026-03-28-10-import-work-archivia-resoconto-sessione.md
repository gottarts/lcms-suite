# Resoconto sessione — Semplificazione import work + pulsante Archivia

**Data:** 2026-03-28
**Oggetto:** Revisione regole import work in SchemaCalibrazione e aggiunta pulsante "Archivia" in WorkPage

---

## Cosa è stato fatto

Sessione focalizzata sulla semplificazione del sistema di import/archiviazione delle work, partendo dalla richiesta dell'utente di eliminare la distinzione `isImported` (flag in memoria) e di adottare regole più semplici:

1. **Import rule semplificata** — una work è importabile se non è archiviata, non è già linked al metodo corrente, e condivide analiti con il metodo corrente.
2. **Archiviazione semplificata** — il pulsante ✕ in SchemaCalibrazione rimuove solo il link (`work_metodi`), non archivia mai. L'archiviazione avviene solo tramite ricarica (già esistente) o tramite nuovo pulsante "Archivia" in WorkDrawer.

---

## Feature aggiunte / Bug affrontati

### Semplificazione handleDeleteWork in SchemaCalibrazione
**Motivazione:** Il flag `isImported` viveva solo in memoria. Dopo un reload, la work importata perdeva il flag e veniva archiviata (invece di essere de-linkata) alla rimozione dallo schema — causando work inaccessibili.
**Fix:** `handleDeleteWork` chiama sempre `removeFromMetodo()`, mai `archivia()`. Rimossi `recentlyArchivedByCol`, `isImported` da `WorkInSchema`, e `isImported: true` da `handleImportWork`.

### Pulsante "Archivia" in WorkDrawer / WorkPage
**Motivazione:** Senza archivio dallo schema, serve un modo esplicito per archiviare una work non più utile.
**Implementazione:** Aggiunto pulsante "Archivia" (ambra) nel WorkDrawer. WorkPage gestisce `archiviaId`, `handleArchivia`, e un `ConfirmDialog` dedicato. Il pulsante appare solo in vista attiva (non in archivio).

### Filtro import work — stato APERTO, non risolto
**Obiettivo:** Mostrare nel dialog "Importa Work" solo le work rilevanti per il metodo corrente.

**Tentativo 1** (errato): JOIN su `work_ingredienti → composti → metodo_analiti` per nome CRM. Fallisce se la work usa work intermedie come sorgenti (`source_type = 'work'`): nessun ingrediente CRM diretto → work esclusa anche se rilevante.

**Tentativo 2** (anche errato): JOIN su `work_metodi → metodo_analiti` dell'altro metodo → `metodo_analiti` del metodo corrente. Avrebbe dovuto mostrare solo work di metodi che condividono analiti. In pratica mostra anche work orfane (non linked a nessun metodo) perché la query ha un bug o un'interpretazione non corretta. Il test dell'utente ha rilevato: work non presenti in nessuno schema compaiono nella lista.

**⚠ PUNTO APERTO:** Il filtro non funziona correttamente. Serve capire:
- Come esistono work senza schema (orfane create da WorkPage con "Nuova Work")?
- La regola corretta di visibilità nel dialog import: solo work di altri metodi? Tutte le non-archiviate non-linked? Solo quelle con CRM in comune?
- Il tentativo 2 (join metodo_analiti) non esclude le work orfane perché non hanno `work_metodi` → la JOIN non produce righe → `DISTINCT` non aiuta — **la query è implicitamente corretta** (orfane non hanno wm_other → non joinano → non appaiono). Questo suggerisce che le work "orfane" hanno in realtà un `work_metodi` residuo, oppure c'è un altro problema.

**Commento utente:** "Il filtro import work non funziona ancora — la nuova query mostra work non associate a nessun metodo (work orfane create da WorkPage). Punto aperto: capire la regola corretta di visibilità e come esistono work senza schema associato. Rivedere completamente l'approccio nella prossima sessione."

---

## File modificati

| File | Modifica |
|------|----------|
| `src/main/ipc/work.ipc.ts` | Riscritta query `work:list-for-import` (tentativo 2 — da rivedere) |
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | `handleDeleteWork` sempre `removeFromMetodo`; rimossi `recentlyArchivedByCol` e blocco `setSostituitoDa` |
| `src/renderer/pages/metodi/SchemaCalibrazione.types.ts` | Rimosso `isImported?: boolean` da `WorkInSchema` |
| `src/renderer/pages/work/WorkDrawer.tsx` | Prop `onArchivia`, pulsante "Archivia", import icona `Archive` |
| `src/renderer/pages/work/WorkPage.tsx` | Stato `archiviaId`, handler `handleArchivia`, `ConfirmDialog` archiviazione |

---

## Note per sessioni future

- **Il filtro import work è da rivedere completamente.** Capire prima come nascono le work orfane (create in WorkPage senza schema) e se vanno escluse o incluse nell'import.
- Il plan di questa sessione è in `~/.claude/plans/serialized-chasing-sky.md`.
- La semplificazione `handleDeleteWork` (rimuove solo link, mai archivia) è confermata corretta e non da toccare.
- Il pulsante "Archivia" in WorkDrawer è confermato e funzionante.
- Considerare se aggiungere una colonna `is_native` a `work_metodi` nella prossima sessione per distinguere work native vs importate in modo persistente — ma l'utente aveva detto di evitarlo per ora.
