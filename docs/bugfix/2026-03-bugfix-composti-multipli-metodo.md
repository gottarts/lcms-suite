# Resoconto Bugfix — LCMS Suite
**Data:** 2026-03-13
**Branch:** `fix/metodi-merge-rename`
**DB user_version:** invariato

---

## 🐛 Bug risolto — Badge composti multipli nel MetodoDrawer

### Problema

Nel pannello laterale del metodo (MetodoDrawer), la sezione "Composti associati" mostrava badge ripetuti per la stessa sostanza. Ad esempio, se un metodo era associato a 3 lotti di Atrazina, comparivano 3 badge "Atrazina" distinti.

### Causa

I badge multipli non erano causati da righe duplicate in `composti_metodi` (verificato con query SQL diretta sul DB — 0 duplicati trovati), ma dal fatto che la stessa sostanza può avere più lotti registrati come composti distinti, ognuno con il proprio `id`. La logica precedente mostrava un badge per ogni record, non per ogni sostanza.

### Soluzione

Raggruppamento dei composti per `nome` con `useMemo` prima del render. Per ogni sostanza viene mostrato un solo badge, con un contatore del numero di lotti se > 1.

**Esempio risultato:**
- Prima: `Atrazina` `Atrazina` `Atrazina` `Simazina`
- Dopo: `Atrazina (3)` `Simazina`

L'intestazione della sezione mostra entrambi i contatori: `Composti associati (2 sostanze, 4 lotti)`.

Il click sul badge naviga comunque a `/composti` con il nome della sostanza come filtro di ricerca, mostrando tutti i lotti.

### File modificato

| File | Tipo |
|------|------|
| `src/renderer/pages/metodi/MetodoDrawer.tsx` | 🔧 Modificato |

---

## 🔍 Diagnostica eseguita

Durante l'indagine è stato verificato lo stato del database con una query diretta su `lcms.db`:

```sql
SELECT composto_id, metodo_id, COUNT(*) as n
FROM composti_metodi
GROUP BY composto_id, metodo_id
HAVING n > 1
```

**Risultato:** 0 righe — nessun duplicato nel DB. Il problema era esclusivamente nella logica di visualizzazione.

---

## Commit

```bash
git add src/renderer/pages/metodi/MetodoDrawer.tsx
git commit -m "fix(metodi): raggruppa badge composti per nome con contatore lotti"
```