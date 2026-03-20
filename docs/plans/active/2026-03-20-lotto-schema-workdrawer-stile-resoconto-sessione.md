# Resoconto sessione — 2026-03-20
## Rimozione lotto da SchemaCalibrazione + lotto/tracciabilità in WorkDrawer + uniformazione stile

---

## Obiettivo

- Rimuovere il numero di lotto dalle card CRM nello SchemaCalibrazione (lo schema è generico, i lotti cambiano)
- Mostrare il lotto nel WorkDrawer (pagina Work), dove è contestuale alla work preparata
- Aggiungere una sezione visiva "Sorgenti / Tracciabilità" nel WorkDrawer con catena a dot colorati e lotti
- Uniformare lo stile del drawer dello schema calibrazione al resto dell'app (Tailwind/shadcn)

---

## Modifiche effettuate

### `src/main/ipc/work.ipc.ts`
- Estesa la query SQL `work:get` per restituire `source_lotto` (lotto del CRM sorgente) e `source_mix` (forma commerciale/nome del kit) per ogni ingrediente

### `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx`
- Card Singoli: rimosso lotto, rimane solo `scad. XXX` se presente
- Card Mix: rimosso ` · lotto`, rimane solo produttore

### `src/renderer/pages/work/WorkDrawer.tsx`
- Nuova sezione **"Sorgenti / Tracciabilità"** prima della Composizione: albero visivo con dot colorati (arancio per work, verde per CRM), mostra nome commerciale (source_mix) e lotto CRM
- Sezione **Composizione**: aggiunta riga `Lotto: XXX` + nome commerciale sotto il nome del composto CRM

### `src/renderer/pages/metodi/SchemaCalibrazione.tsx`
- `DrawerDettaglioWork` migrato da pannello custom (position:fixed, backdrop manuale, inline styles) a `SlidePanel` (shadcn Sheet, Radix UI portal)
- Pulsante Elimina → shadcn `Button` con `className="text-destructive"`
- Separatori tra sezioni → shadcn `Separator`
- Contenuto interno (tabella volumi, ChainNode, lista composti) mantiene inline styles con palette C

---

## File modificati

| File | Tipo modifica |
|------|--------------|
| `src/main/ipc/work.ipc.ts` | Backend: SQL esteso |
| `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx` | UI: rimozione lotto |
| `src/renderer/pages/work/WorkDrawer.tsx` | UI: tracciabilità + lotto |
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | UI: refactor drawer → SlidePanel |
