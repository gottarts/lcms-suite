# Piano: Ripristino DB Composti — Regressioni da commit 2c4eabd

## Contesto

Il commit `2c4eabd` ("fix-schemi-calib") aveva come obiettivo la correzione di SchemaCalibrazione, ma ha accidentalmente svuotato `CompostiTable.tsx` e `StoriaDialog.tsx`, rimuovendo funzionalità fondamentali del DB Composti. `CompostiPage.tsx` continua a passare le vecchie props ai componenti semplificati, causando mismatch e funzionalità non operative.

## Problemi identificati

### 1. `CompostiTable.tsx` — TOTALMENTE SVUOTATO (225 → 81 linee)

**Funzionalità rimosse:**
- Colonne avanzate: `data_apertura`, `concentrazione`, `purezza`, `solvente`, `ubicazione`, `stoccaggio`, `accreditamento_crm`, `work_standard`, `destinazione_uso`, `forma_commerciale`, `matrice`, `mw`, `formula`
- **Selezione con checkbox** (`selectedIds`, `onSelectionChange`, shift+click)
- Gestione colonne visibili/ordinate (`colVisible`, `colOrder`)
- Filtri per colonna (`colFilters`, `onColFilter`)
- Badge RIVALIDATO e Scadenza estesa con link allo storico
- Badge preparazioni attive con click → tab preparazioni
- Indicatore campi mancanti (triangolo arancione)
- `ApriAperturaDialog` per apertura fiale multiple
- `FialeSelector`
- `onRefresh`, `onOpenStorico`, `onOpenPreparazioni`
- Riga dismessa con `opacity-40`

**Risultato:** La tabella mostra solo 8 colonne fisse, non è selezionabile, le bulk actions della barra sopra non funzionano perché i checkbox non esistono nella tabella.

**Fix:** Ripristinare il componente `CompostiTable` al codice precedente al commit `2c4eabd` (commit `33663b4~1` oppure il diff inverso). Il file originale era 225 linee.

### 2. `StoriaDialog.tsx` — RIMOSSI PARAMETRI BULK (183 → 134 linee)

**Funzionalità rimosse:**
- Props `onSavedBulk`, `isBulk`, `bulkLottiDistinti`
- Campo `nuovaScadenza` e relativo `<Input type="date">`
- Banner avviso lotti multipli in bulk rivalidazione
- Logica `showLottoScadenza` (mostra lotto/scadenza solo per rivalidazione singola)
- Logica `showBulkWarning` (banner per bulk con lotti multipli)
- Routing `onSavedBulk` vs `compostiApi.addStoria` a seconda se bulk o singolo

**Conseguenze:**
- La dismissione **bulk** non funziona: `StoriaDialog` non ha `onSavedBulk`, quindi `handleBulkStoria` in `CompostiPage` non viene mai chiamato
- La rivalidazione **singola** non aggiorna la scadenza (campo rimosso)
- `CompostiPage.tsx` righe 1120-1122 passa `onSavedBulk`, `isBulk`, `bulkLottiDistinti` che vengono ignorati silenziosamente

**Fix:** Ripristinare il `StoriaDialog` con le props e la logica di routing bulk/singolo.

### 3. `CompostiPage.tsx` — Mismatch props verso `CompostiTable`

`CompostiPage` (righe 1087-1094) passa ancora le vecchie props:
```tsx
onRefresh={load}
onOpenStorico={handleOpenStorico}
onOpenPreparazioni={handleOpenPreparazioni}
selectedIds={selectedIds}
onSelectionChange={setSelectedIds}
colVisible={colVisible}
colOrder={colOrder}
colFilters={colFilters}
onColFilter={handleColFilter}
```

`CompostiTable` attuale non accetta nessuna di queste (TypeScript silenzioso). Le bulk actions (Rivalidazione bulk, Dismetti bulk) non funzionano perché `selectedIds` rimane sempre vuoto (i checkbox non esistono nella tabella).

**Fix:** Dopo aver ripristinato `CompostiTable`, le props coincideranno e non serve modificare `CompostiPage`.

## File da modificare

| File | Azione |
|------|--------|
| `src/renderer/pages/composti/CompostiTable.tsx` | Ripristinare versione pre-`2c4eabd` (da `git show 33663b4:...`) |
| `src/renderer/pages/composti/StoriaDialog.tsx` | Ripristinare versione pre-`2c4eabd` con props bulk + campo nuovaScadenza |

`CompostiPage.tsx` non va modificato — era già corretto, solo le sue prop-passate-a-CompostiTable erano "dimenticate" dal componente.

## Strategia di ripristino

Usare `git show <commit>:<file>` per ottenere la versione precedente al commit dannoso e sovrascrivere i file attuali.

Il commit precedente a `2c4eabd` è `33663b4`. Si dovrà verificare che quella versione di `CompostiTable` e `StoriaDialog` sia quella corretta (pre-regressione).

```bash
git show 33663b4:src/renderer/pages/composti/CompostiTable.tsx
git show 33663b4:src/renderer/pages/composti/StoriaDialog.tsx
```

## Verifica post-fix

1. **Selezione**: aprire DB Composti → le checkbox appaiono nella tabella → selezionare più composti → la barra bulk actions mostra il conteggio corretto
2. **Dismissione singola**: dal menu "..." di un composto → "Dismetti" → dialog si apre → conferma → composto appare come dismesso nella lista (o scompare se `mostraDismessi=false`)
3. **Dismissione bulk**: selezionare 2+ composti → "Dismetti" nel bulk bar → il `StoriaDialog` si apre in modalità bulk → conferma → i composti vengono dismessi e `selectedIds` si azzera
4. **Rivalidazione singola**: dal menu "..." → "Rivalidazione" → il dialog mostra campo "Nuova data di scadenza" → compilare e confermare → lo stato del composto si aggiorna
5. **Colonne visibili**: il menu "Colonne" nasconde/mostra correttamente le colonne nella tabella
6. **Filtri per colonna**: l'input filtro in testa a ogni colonna filtra i dati
7. **Stato aggiornato dopo dismissione**: dopo conferma dismissione il composto scompare dalla lista (se `mostraDismessi=false`) o appare in grigio/opacity-40
