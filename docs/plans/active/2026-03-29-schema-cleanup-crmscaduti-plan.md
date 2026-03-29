# Piano: Schema Calibrazione + CRM Scaduti + Feedback Archiviazione

**Data**: 2026-03-29

## Context

Tre miglioramenti indipendenti richiesti:

1. **Step bar e pulsante Ricarica** — La step bar dello Schema Calibrazione (step 1-4) e il pulsante "Ricarica ↻" in basso a sinistra sono considerati ridondanti/superflui e vanno rimossi.
2. **CRM scaduti ricaricabili** — La feature "Ricarica" (RicaricaDialog) funziona già per CRM dismessi ma non per CRM scaduti. Estenderla ai scaduti.
3. **Feedback archiviazione work** — Dopo la Ricarica automatica (che archivia la vecchia work e crea la nuova), mostrare un messaggio visibile all'utente.

---

## Punto 1 — Rimuovi step bar e pulsante Ricarica dallo Schema

### File
- `src/renderer/pages/metodi/SchemaCalibrazione.tsx`

### Cambiamenti
1. **Rimuovi il blocco `/* ── Step bar ── */`** (righe ~1088-1123): l'intero `<div>` che contiene la step bar.
2. **Rimuovi le costanti `stepStatus` e `steps`** (righe 1038-1049) — non più usate dopo la rimozione.
3. **Rimuovi il pulsante "Ricarica ↻"** dalla bottom bar (riga ~1180-1184): solo il `<button>` del ricarica, non "Ricomincia da zero".
4. **Rimuovi il confirm dialog `confirmReset === 'reload'`** (cerca `setConfirmReset('reload')` e il branch corrispondente nel ConfirmDialog) se esiste un branch separato per 'reload'.
5. **Rimuovi `handleReloadSchema`** se non ha altri punti di utilizzo dopo la rimozione del pulsante.

> Note: `hasCon` è ancora usato per mostrare il warning "⚠ Ci sono analiti con sia mix che singolo" nella bottom bar — **non rimuoverlo**.

---

## Punto 2 — CRM scaduti ricaricabili (estendi RicaricaDialog)

### File principali
- `src/main/ipc/work.ipc.ts` — `work:check-lot-status` e `work:ricarica`
- `src/renderer/pages/work/RicaricaDialog.tsx`
- `src/renderer/pages/work/WorkPage.tsx` — `WorkCard` (chip/badge scaduti)
- `src/renderer/pages/work/WorkDrawer.tsx` — banner CRM scaduti

### Analisi attuale
- `work:check-lot-status` (righe ~437-470): controlla ingredienti con `data_dismissione IS NOT NULL` → cerca sostituti attivi. I scaduti (`ha_crm_scaduti`) hanno un banner informativo giallo ma **nessun pulsante Ricarica**.
- La logica di sostituzione: cerca lotti con stesso nome, non dismessi, non scaduti → status `ok/auto/ambiguo/mancante`.

### Cambiamenti

**a) `work.ipc.ts` — `work:check-lot-status`**
- Attualmente salta i componenti con `!data_dismissione` (status 'ok'). Estendere: se l'ingrediente è scaduto (e non dismesso), includerlo nella stessa logica di ricerca sostituti.
- Condizione da aggiungere: un ingrediente è "da sostituire" se `data_dismissione IS NOT NULL` **oppure** scaduto (`scadenza_prodotto < today` e nessuna rivalidazione valida).

**b) `WorkPage.tsx` — `WorkCard`**
- Il badge "Ricarica ↻" arancione appare solo quando `isBloccata` (dismessi). Aggiungere: mostrare anche quando `haScaduti && !isBloccata` (o unificare la condizione).
- Considerare colore diverso (giallo/ambra) o stesso arancione per coerenza.

**c) `WorkDrawer.tsx`**
- Il banner giallo dei scaduti attualmente non ha azioni. Aggiungere un pulsante "Ricarica" nel banner (come per il drawer dei dismessi, se presente).

**d) `RicaricaDialog.tsx`**
- Nessun cambio necessario: la dialog già gestisce status `auto/ambiguo/mancante` — funzionerà anche per scaduti una volta che il backend li include nel check.

---

## Punto 3 — Toast dopo archiviazione automatica da Ricarica

### File
- `src/renderer/pages/metodi/SchemaCalibrazione.tsx` — callback `onRicaricaSuccess` (righe ~1271-1288)
- `src/renderer/pages/work/WorkPage.tsx` — `onRicaricaSuccess` o callback post-ricarica

### Cambiamento
Dopo la ricarica riuscita, mostrare un breve **toast/snackbar** (non modal bloccante) con messaggio tipo:
> "Work aggiornata. La precedente versione è stata archiviata."

Verificare se esiste già un sistema di toast nel progetto (cercare `toast`, `Snackbar`, `notification`). Se non esiste, usare un semplice `<div>` con auto-dismiss (setTimeout → remove) posizionato in overlay.

---

## Ordine di esecuzione

1. Punto 1 (rimozione step bar + btn) — cambio puramente sottrattivo, basso rischio
2. Punto 2 (scaduti ricaricabili) — modifica backend + UI cards/drawer
3. Punto 3 (toast archiviazione) — aggiunta UI localizzata

---

## Verifica

- Aprire Schema Calibrazione → la step bar non è più visibile, il pulsante Ricarica ↻ in basso non c'è più.
- Creare una work con CRM scaduto → deve apparire badge "Ricarica ↻" sulla card.
- Aprire RicaricaDialog su work con CRM scaduto → deve proporre lotti sostitutivi.
- Eseguire Ricarica → dopo il successo deve apparire il toast di conferma archiviazione.
