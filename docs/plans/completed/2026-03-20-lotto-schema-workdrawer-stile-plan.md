# Piano: Rimozione lotto da SchemaCalibrazione + lotto in WorkDrawer + uniformazione stile

## Context
Lo schema calibrazione è generico e i lotti dei CRM cambiano: non ha senso mostrare il lotto nelle card della griglia. Il lotto va invece nel WorkDrawer (pagina Work), dove ha senso per tracciabilità specifica della work preparata. Inoltre lo stile del drawer dello schema è molto diverso dal resto dell'app (inline styles vs Tailwind/shadcn) e va uniformato.

---

## Modifiche

### 1. Rimuovere lotto da SchemaCalibrazione.grid.tsx

**File:** `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx`

- **Card Singoli:** rimuovere `{crm.lotto ?? '—'}`, mantenere solo scadenza se presente
- **Card Mix:** rimuovere ` · ${info.lotto}`, mantenere solo produttore

---

### 2. Estendere work:get per restituire source_lotto e source_mix

**File:** `src/main/ipc/work.ipc.ts`

Aggiungere `source_lotto` (lotto CRM) e `source_mix` (forma_commerciale CRM) alla query ingredienti.

---

### 3. WorkDrawer.tsx — lotto in composizione + sezione tracciabilità

**File:** `src/renderer/pages/work/WorkDrawer.tsx`

- Sezione "Sorgenti / Tracciabilità": albero visivo dot colorati (arancio work, verde CRM) con source_mix e lotto
- Sezione Composizione: lotto e nome commerciale sotto il nome del composto CRM

---

### 4. Uniformare DrawerDettaglioWork in SchemaCalibrazione.tsx a SlidePanel

**File:** `src/renderer/pages/metodi/SchemaCalibrazione.tsx`

- Sostituire pannello custom con `SlidePanel` (shadcn Sheet)
- Pulsante Elimina → `Button` shadcn
- Separatori → `Separator` shadcn
- Contenuto interno mantiene inline styles (palette C)

---

## Verifica

- SchemaCalibrazione: card singoli mostrano solo scadenza (no lotto), card mix solo produttore
- WorkDrawer: sezione Tracciabilità con dot + lotto; Composizione con lotto e nome commerciale
- Drawer schema calibrazione usa SlidePanel coerente con il resto dell'app
