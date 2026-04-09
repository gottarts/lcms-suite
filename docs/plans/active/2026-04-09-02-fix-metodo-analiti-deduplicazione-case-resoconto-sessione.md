# Resoconto sessione — Fix deduplicazione case-insensitive in metodo_analiti

**Data:** 2026-04-09
**Oggetto:** Composti con nomi identici tranne maiuscole/minuscole non devono creare duplicati nella tabella parametri del metodo

---

## Cosa è stato fatto

Risolto un bug per cui due composti che differivano solo per maiuscole/minuscole (es. "Atrazina" e "ATRAZINA") assegnati allo stesso metodo creavano duplicati nella tabella `metodo_analiti`. Risolto anche il conseguente problema che lo SchemaCalibrazione non trovava i composti nel DB dopo la normalizzazione a UPPER.

---

## Bug risolti / Feature aggiunte

### Duplicati case-insensitive in metodo_analiti

**Root cause:** Il vincolo `UNIQUE(metodo_id, nome)` in SQLite è case-sensitive per default. Quindi "Atrazina" e "ATRAZINA" venivano trattati come valori distinti e `INSERT OR IGNORE` li inseriva entrambi. Tutti i punti di inserimento in `metodo_analiti` passavano il nome esatto del composto senza normalizzazione.

**Fix:** Normalizzazione a UPPER prima di ogni INSERT in `metodo_analiti`, in tutti i punti di inserimento:
- `composti.ipc.ts`: 3 punti (`composti:create`, `composti:update` ramo mix, `composti:update` principale)
- `metodi.ipc.ts`: 4 punti (`metodi:create`, `metodi:update` composti + analiti manuali, `metodi:merge`) + fix confronto case-sensitive nella logica analiti manuali (il `Set.has()` ora usa `.toUpperCase()` su entrambi i lati)
- `metodo-analiti.ipc.ts`: 1 punto (`metodo-analiti:add`)

**Decisione:** Non è stata creata una migration per normalizzare i dati storici (l'utente ha confermato che non ci sono duplicati esistenti e non si vuole alterare i nomi già presenti).

### SchemaCalibrazione non trovava i composti dopo la normalizzazione

**Root cause:** `buildAnalitiData` in `SchemaCalibrazione.logic.ts` costruiva le mappe `mixMap`, `sngMap`, `isMap` con chiavi in case misto (`item.nome` dai composti), ma il lookup veniva fatto con `row.nome` proveniente da `metodo_analiti` che ora è in UPPER. Il confronto stringa esatta falliva.

**Fix:** Tutte le chiavi delle mappe interne normalizzate a `.toUpperCase()` (sia in inserimento che in lookup).

---

## File modificati

| File | Modifica |
|------|----------|
| `src/main/ipc/composti.ipc.ts` | 3 INSERT in `metodo_analiti` → `.toUpperCase()` |
| `src/main/ipc/metodi.ipc.ts` | 4 INSERT in `metodo_analiti` → `.toUpperCase()` + fix confronto analiti manuali case-insensitive |
| `src/main/ipc/metodo-analiti.ipc.ts` | 1 INSERT in `metodo_analiti` → `.toUpperCase()` |
| `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts` | Chiavi mappe normalizzate a UPPER per match case-insensitive con `analitiRows` |

---

## Note per sessioni future

- I nomi in `metodo_analiti` sono ora sempre in UPPER. I nomi in `composti.nome` restano in case misto. Qualsiasi futuro confronto tra queste due colonne deve usare `LOWER()`/`UPPER()` o `.toUpperCase()`.
- La logica di DELETE in `composti.ipc.ts` usa già `LOWER(nome)` — è già corretta e non è stata toccata.
- Le query backend di lettura (es. `composti:list-for-schema`) usano già `LOWER()` su entrambi i lati — non impattate.
- Se in futuro si aggiunge un nuovo punto di inserimento in `metodo_analiti`, ricordarsi di normalizzare a UPPER.
