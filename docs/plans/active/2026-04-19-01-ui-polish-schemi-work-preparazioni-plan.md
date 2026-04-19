# Piano: Work Standards — 4 fix UI/UX

## Context
Quattro piccole fix identificate da note di revisione UI:
1. Eliminare bottone "+Nuova Work" (feature morta)
2. Chip scadenza work: togliere codice colore verde, testo descrittivo neutro
3. Schema analiti: icona ↗ troppo chiara (opacity 0.55), aumentare contrasto
4. Schema: togliere bottone "Ricarica ↻" dalle soluzioni work intermedie

---

## Fix 1 — Rimuovere bottone "+Nuova Work"

**File:** [src/renderer/pages/work/WorkPage.tsx](src/renderer/pages/work/WorkPage.tsx#L156-L160)

Righe 156–160: rimuovere il blocco `{!mostraArchivio && (<Button ...> Nuova Work </Button>)}`.

Import `Plus` da lucide-react potrebbe diventare inutilizzato → verificare e rimuovere se non usato altrove nel file.

---

## Fix 2 — Chip scadenza work: niente colore verde, testo neutro

**File:** [src/renderer/pages/work/WorkPage.tsx](src/renderer/pages/work/WorkPage.tsx#L449-L620)

- `STATO_LAB_BADGE` (righe 449-454): la voce `attiva` ha `border-green-300 text-green-700 bg-green-50`. Sostituire con classi neutre (`border-muted text-muted-foreground bg-transparent` o simile) per togliere il verde.
- Il testo del badge attiva mostra `Attiva · Scade il <data>` (riga 618). Cambiare testo in **"Work valida per X mesi dalla preparazione"** usando `work.validita_mesi` già disponibile.
- Per `in_scadenza` e `scaduta` mantenere i colori amber/red (semantica di allerta).

---

## Fix 3 — Icona ↗ analiti: aumentare contrasto

**File:** [src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx](src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx#L332-L339)

Riga 337: `opacity:0.55` → portare a **`opacity:0.85`** (o 1 se senzaCrm già gestisce l'opacità sul contenitore a riga 323).

Nota: il contenitore esterno ha già `opacity: senzaCrm ? 0.4 : ...` — l'icona dentro eredita quell'opacità. Per i composti normali (non senzaCrm) portare a 0.85–1 è sufficiente.

---

## Fix 4 — Rimuovere bottone "Ricarica ↻" dalle soluzioni work intermedie in SCHEMI

**File:** [src/renderer/pages/metodi/SchemaCalibrazione.tsx](src/renderer/pages/metodi/SchemaCalibrazione.tsx#L239-L253)

Rimuovere l'intero blocco `{/* Pulsante Ricarica */}` (righe 239–253).

Verificare: `onRicaricaWork` è ancora usato da `RicaricaDialog` che rimane nel progetto? Sì — il dialog è mount a riga 990 ma non sarà più raggiungibile. Rimuovere anche:
- prop `onRicaricaWork` dal componente `ColonneWork` (righe 124, 130)
- la chiamata `onRicaricaWork` nel render (riga 851)
- il dialog `RicaricaDialog` (righe 989–1007) — o lasciarlo dormiente se la feature potrebbe tornare

**Decisione conservativa**: rimuovere solo il bottone e la prop; lasciare il dialog mount condizionato su `ricaricaWorkId` che non sarà mai settato → nessun side effect.

---

## Verifica

1. Avviare l'app, andare in Work Solutions → non deve comparire "+Nuova Work"
2. Aprire una work attiva → chip scadenza deve essere neutro (no verde) con testo "Work valida per X mesi dalla preparazione"
3. Aprire uno Schema con composti → icona ↗ visibile con buon contrasto
4. In uno schema con work intermedie → nessun bottone "Ricarica ↻" visibile
