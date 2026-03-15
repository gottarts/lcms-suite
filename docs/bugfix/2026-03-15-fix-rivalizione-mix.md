# Resoconto Sessione — 2026-03-15

**Branch:** `master`
**DB user_version:** 10 (nessuna migration)

---

## Obiettivo

Fix propagazione eventi storia (Rivalidazione e Dismissione) a tutti i componenti di un mix.

---

## Bug risolti

### BUG-1 — `composti:storia-add` non propagava la storia ai componenti del mix ✅

**File:** `src/main/ipc/composti.ipc.ts`

**Sintomo:** cliccando "Rivalidazione" o "Dismetti" su un composto appartenente a un mix, l'evento veniva registrato in `composti_storia` solo per il composto cliccato. Gli altri componenti del mix rimanevano senza l'evento nello storico — badge e stato non si aggiornavan di conseguenza.

**Causa:** l'handler `composti:storia-add` eseguiva un singolo `INSERT` con il `compostoId` ricevuto, senza verificare se il composto facesse parte di un mix. Solo la Dismissione propagava `data_dismissione` tramite `UPDATE composti WHERE mix_id = ?`, ma anche in quel caso il record storico restava singolo.

**Fix:** all'inizio dell'handler viene letto il `mix_id` del composto. Se presente, vengono recuperati tutti i `composto_id` del mix (`SELECT id FROM composti WHERE mix_id = ?`) e l'`INSERT` in `composti_storia` viene eseguito per ciascuno di essi all'interno di un'unica transazione. L'aggiornamento `data_dismissione` per la Dismissione è stato spostato dentro la stessa transazione.

```
Prima:
  INSERT composti_storia (compostoId, ...)       ← solo il composto cliccato
  UPDATE composti SET data_dismissione WHERE mix_id  ← fuori transazione

Dopo:
  db.transaction(() => {
    for (targetId of [tutti i componenti del mix]):
      INSERT composti_storia (targetId, ...)     ← tutti i componenti
    if Dismissione:
      UPDATE composti SET data_dismissione WHERE mix_id
  })
```

Composti singoli (senza `mix_id`): comportamento invariato.

---

## File modificati

| File | Tipo |
|------|------|
| `src/main/ipc/composti.ipc.ts` | 🔧 Modificato |

---

## Stato Database

```
user_version = 10 (invariato)
```

Nessuna migration necessaria.

---

## Commit

```
git add src/main/ipc/composti.ipc.ts
git commit -m "fix(storia-add): propaga Rivalidazione e Dismissione a tutti i componenti del mix"
```