# Resoconto sessione — Fix duplicati parametri metodo (COLLATE NOCASE + rename)

**Data:** 2026-04-16
**Oggetto:** Eliminazione duplicati in `metodo_analiti` e rinomina parametro alla modifica del nome composto

---

## Cosa è stato fatto

- Identificata la causa radice dei duplicati nei parametri dei metodi: la UNIQUE constraint su `(metodo_id, nome)` in SQLite è case-sensitive (BINARY collation), quindi `"Paraquat"` e `"PARAQUAT"` venivano trattati come valori distinti e l'`INSERT OR IGNORE` non li bloccava.
- Creata migration `025-metodo-analiti-nocase.sql` per ricreare la tabella con `COLLATE NOCASE` sulla colonna `nome`, normalizzare i nomi esistenti in UPPERCASE e rimuovere i duplicati già presenti.
- Applicata la migration direttamente sul DB reale (user_version aggiornata a 25) perché il DB aveva già user_version=24 e la migration 024 (primo tentativo) era stata ignorata.
- Fixato `composti:create-mix` che passava `comp.nome` senza `.toUpperCase()` — unico percorso non normalizzato.
- Aggiunta logica di **rename** del parametro quando si modifica il nome di un composto: invece di cancellare+inserire (perdendo ordine, accreditato, alias), si fa `UPDATE metodo_analiti SET nome = nuovo` preservando tutti i campi. Il rename avviene solo se nessun altro composto usa ancora il vecchio nome su quel metodo.

---

## Bug risolti / Feature aggiunte

### Fix: duplicati in metodo_analiti
**Root cause:** La UNIQUE constraint `UNIQUE(metodo_id, nome)` in SQLite usa BINARY collation di default. La migration 016 aveva popolato `metodo_analiti` da `composti.nome` senza normalizzare il case, mentre tutti gli IPC handler inseriscono in UPPERCASE. Nei DB esistenti coesistevano nomi con case misto (es. `"Paraquat"`) e uppercase (`"PARAQUAT"`), considerati diversi dalla constraint — quindi l'`INSERT OR IGNORE` non li bloccava.
**Fix:** Migration 025 che: (1) elimina duplicati case-insensitive tenendo il MIN(id), (2) normalizza tutti i nomi in UPPERCASE, (3) ricrea la tabella con `nome TEXT NOT NULL COLLATE NOCASE` — la UNIQUE diventa permanentemente case-insensitive. Fix anche in `composti:create-mix` riga 615: aggiunto `.toUpperCase()` su `comp.nome`.

### Fix: modifica nome composto creava nuovo parametro invece di rinominare
**Root cause:** In `composti:update`, quando il nome del composto cambiava, il codice faceva `INSERT OR IGNORE` del nuovo nome — creando un nuovo parametro — senza rimuovere il vecchio. Questo perdeva `ordine`, `accreditato`, `alias_strumento`, `alias_lims`, `alias_oqlab` del parametro originale.
**Fix:** Prima della transazione si legge il vecchio nome del composto. Se il nome è cambiato e nessun altro composto ha il vecchio nome su quel metodo, si esegue `UPDATE metodo_analiti SET nome = nuovoNome WHERE metodo_id = ? AND LOWER(nome) = LOWER(vecchioNome)` invece dell'insert. Se altri composti usano ancora il vecchio nome, si inserisce normalmente il nuovo (il vecchio parametro rimane valido per gli altri).

---

## File modificati

| File | Modifica |
|------|----------|
| `src/main/migrations/025-metodo-analiti-nocase.sql` | Nuova migration: COLLATE NOCASE + dedup + normalizzazione UPPERCASE |
| `src/main/ipc/composti.ipc.ts` | `create-mix`: aggiunto `.toUpperCase()` su nome; `update`: logica rename parametro invece di insert |

---

## Note per sessioni future

- La migration 024 era già stata creata e applicata in questa sessione con user_version=24, ma il DB reale aveva già user_version=24 — la migration era stata silenziosamente ignorata. Per questo si è usato 025 e applicata manualmente sul DB reale.
- Il DB reale è in `/Users/vitogelao/Documents/Personali/Chem/Arpa/LCMS Suite Progetto/LCMS_Suite_Storage/lcms.db` (user_version ora = 25).
- La logica di rename in `composti:update` funziona solo per composti singoli. I componenti di mix che hanno il nome modificato passano per la stessa funzione `composti:update` (uno alla volta), quindi sono coperti.
- Attenzione: `checkAltriComposti` viene chiamato **dopo** `deleteLinks.run(id)`, quindi il composto corrente è già scollegato e non viene conteggiato tra "altri con lo stesso nome" — comportamento corretto.
