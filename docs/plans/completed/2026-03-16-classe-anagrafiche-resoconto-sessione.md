# Resoconto Sessione — Anagrafica Auto-populate + Merge
**Data:** 2026-03-16
**Branch:** master
**DB user_version:** 9 (invariato — nessuna migration necessaria)

---

## 🎯 Obiettivi della sessione

1. Campo `classe` libero con autocomplete (e tutti i campi collegati ad anagrafiche)
2. Auto-populate anagrafiche al salvataggio composto / import CSV / creazione mix
3. Merge voci anagrafica con propagazione ai composti (rename + merge esplicito)

---

## ✅ Feature completate

### FEAT-A — Campo classe libero con autocomplete

**Problema:** `classe` era una `<Select>` con valori hardcoded in `MixPesticidiForm`. Anche gli altri campi (produttore, solvente, ubicazione, stoccaggio, operatore apertura) erano `<Input>` plain senza suggerimenti.

**Soluzione:** nuovo componente `AutocompleteInput` — campo testo libero con dropdown suggerimenti filtrati. I suggerimenti vengono caricati dall'anagrafica (se già popolata) + merge con i valori distinti nel DB composti, garantendo suggerimenti anche al primo avvio.

#### File modificati

| File | Tipo | Descrizione |
|------|------|-------------|
| `src/renderer/components/shared/AutocompleteInput.tsx` | ✨ Nuovo | Componente riusabile: input libero + dropdown + highlight match + navigazione tastiera |
| `src/renderer/pages/composti/CompostoForm.tsx` | 🔧 Modificato | Sostituiti `<Select>` e `<Input>` con `AutocompleteInput` per: classe, produttore, solvente, ubicazione, stoccaggio, operatore apertura |
| `src/renderer/pages/composti/MixPesticidiForm.tsx` | 🔧 Modificato | Stesse sostituzioni + rimossa `<Select>` hardcoded per classe |
| `src/main/ipc/composti.ipc.ts` | 🔧 Modificato | Aggiunto handler `composti:distinct-values` (whitelist campi, sicurezza SQL injection) |

#### Logica suggerimenti (entrambi i form)

Il `useEffect` iniziale chiama `anagrafiche:list` una sola volta e ne estrae le voci per tutti i campi. Poi fa il merge con `composti:distinct-values` per ogni campo (deduplicato case-insensitive, ordinato). Risultato: chi ha già le anagrafiche popolate vede i suggerimenti anche su un nuovo composto; chi parte da zero vede i valori già presenti nel DB.

---

### FEAT-B — Auto-populate anagrafiche al salvataggio

**Logica:** ogni volta che un composto viene salvato, i valori dei campi collegati vengono automaticamente aggiunti alle rispettive anagrafiche se non già presenti.

**Mappa campi → anagrafiche:**

| Campo composto | Anagrafica |
|----------------|-----------|
| `classe` | Classi |
| `produttore` | Produttori |
| `solvente` | Solventi |
| `stoccaggio` | Posizioni stoccaggio |
| `ubicazione` | Ubicazioni |
| `operatore_apertura` | Operatori |

#### File modificati

| File | Tipo | Descrizione |
|------|------|-------------|
| `src/main/ipc/anagrafiche.ipc.ts` | 🔧 Modificato | Aggiunto handler `anagrafiche:sync-voce` — trova o crea anagrafica, aggiunge voce con `INSERT OR IGNORE` |
| `src/main/ipc/composti.ipc.ts` | 🔧 Modificato | Aggiunta funzione `syncVociDb` (helper interno, no IPC) chiamata in `composti:create` e `composti:create-mix` |
| `src/renderer/lib/anagrafiche-sync.ts` | ✨ Nuovo | Utility frontend che chiama `anagrafiche:sync-voce` in parallelo via `Promise.allSettled` |
| `src/renderer/lib/api.ts` | 🔧 Modificato | Aggiunto `anagraficheApi.syncVoce`, `renameVocePropagate`, `mergeVoci`; `compostiApi.distinctValues` |
| `src/renderer/pages/composti/CompostoForm.tsx` | 🔧 Modificato | Chiama `syncAnagrafiche` dopo `doSave` |
| `src/renderer/pages/composti/MixPesticidiForm.tsx` | 🔧 Modificato | Chiama `syncAnagrafiche` dopo `createMix` (caso A e caso B) |

#### Dettaglio `syncVociDb` (backend)

Funzione fuori da `registerCompostiIpc`, usa statements pre-compilati (`INSERT OR IGNORE`) per efficienza. Chiamata in:
- `composti:create` — copre import CSV + nuovo composto singolo
- `composti:create-mix` — campi comuni + produttori distinti per-riga dai componenti importati

Fix chiave rispetto alla prima implementazione: sostituito `try/catch` vuoto con `INSERT OR IGNORE` — il vecchio `try/catch` inghiottiva silenziosamente tutti gli errori, non solo il UNIQUE constraint.

---

### FEAT-C — Merge voci anagrafica con propagazione

**Funzionalità:** nelle card di AnagrafichePage, le anagrafiche collegate ai campi dei composti mostrano due nuove azioni su ogni voce:
- **Rename con propagazione** — rinomina la voce e aggiorna tutti i composti che usavano il vecchio valore
- **Merge esplicito** — seleziona una voce destinazione, sposta tutti i composti dalla voce sorgente alla destinazione, elimina la voce sorgente

Entrambe le operazioni avvengono in una singola transazione SQL atomica.

#### File modificati

| File | Tipo | Descrizione |
|------|------|-------------|
| `src/main/ipc/anagrafiche.ipc.ts` | 🔧 Modificato | Aggiunto `anagrafiche:rename-voce-propagate` e `anagrafiche:merge-voci` (whitelist campi, transazione atomica) |
| `src/renderer/pages/anagrafiche/AnagraficaCard.tsx` | 🔧 Modificato | Prop `campoDB?`, bottone GitMerge per merge esplicito, `AlertDialog` conferma per rename propagato, dialog selezione voce destinazione per merge |
| `src/renderer/pages/anagrafiche/AnagrafichePage.tsx` | 🔧 Modificato | Mappa `NOME_CAMPO_MAP` per passare `campoDB` alle card in base al nome anagrafica |

**Fix bug:** `onMouseDown={e => e.preventDefault()}` aggiunto sui bottoni GitMerge e Elimina per evitare che il `onBlur` dell'input in editing scattasse prima del click, aprendo erroneamente il dialog di rename.

**Card senza `campoDB`:** le anagrafiche non collegate ai composti (es. create manualmente con nome arbitrario) non mostrano i controlli di merge/rename propagato e usano il rename semplice già esistente.

---

## 🐛 Bug risolti

| Bug | Causa | Fix |
|-----|-------|-----|
| Stoccaggio bloccato a tendina dopo sync | `<Select>` condizionale diventava sempre attiva una volta popolata l'anagrafica | Sostituita con `AutocompleteInput` in entrambi i form |
| Suggerimenti vuoti su nuovo composto | `distinct-values` legge solo il DB composti, vuoto al primo avvio | Merge anagrafica + DB composti nel `useEffect` |
| Anagrafiche non popolate da import CSV | `syncVoceDb` con `try/catch` vuoto inghiottiva errori silenziosamente | `syncVociDb` con `INSERT OR IGNORE` + statements pre-compilati |
| `onBlur` spurio su bottoni voce card | Click su GitMerge/Elimina toglieva focus dall'input prima del click | `onMouseDown={e => e.preventDefault()}` |

---

## 🗄️ Stato Database

```
user_version = 9 (invariato)
```

Nessuna migration necessaria — tutte le modifiche usano tabelle e colonne già esistenti (`anagrafiche`, `anagrafiche_voci`, `composti`).

---

## 📁 File modificati riepilogo

| File | Tipo |
|------|------|
| `src/renderer/components/shared/AutocompleteInput.tsx` | ✨ Nuovo |
| `src/renderer/lib/anagrafiche-sync.ts` | ✨ Nuovo |
| `src/main/ipc/composti.ipc.ts` | 🔧 Modificato |
| `src/main/ipc/anagrafiche.ipc.ts` | 🔧 Modificato |
| `src/renderer/lib/api.ts` | 🔧 Modificato |
| `src/renderer/pages/composti/CompostoForm.tsx` | 🔧 Modificato |
| `src/renderer/pages/composti/MixPesticidiForm.tsx` | 🔧 Modificato |
| `src/renderer/pages/anagrafiche/AnagraficaCard.tsx` | 🔧 Modificato |
| `src/renderer/pages/anagrafiche/AnagrafichePage.tsx` | 🔧 Modificato |

---

## Git

```bash
git add src/renderer/components/shared/AutocompleteInput.tsx
git add src/renderer/lib/anagrafiche-sync.ts
git add src/main/ipc/composti.ipc.ts
git add src/main/ipc/anagrafiche.ipc.ts
git add src/renderer/lib/api.ts
git add src/renderer/pages/composti/CompostoForm.tsx
git add src/renderer/pages/composti/MixPesticidiForm.tsx
git add src/renderer/pages/anagrafiche/AnagraficaCard.tsx
git add src/renderer/pages/anagrafiche/AnagrafichePage.tsx

git commit -m "feat(anagrafiche): autocomplete campi composto + auto-populate anagrafiche + merge voci con propagazione"

git push
```