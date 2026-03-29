# Resoconto sessione — WorkDrawer miglioramenti + vista archivio work

**Data:** 2026-03-28
**Oggetto:** Tre feature sul modulo Work: bottone "Vai a schema" da warning CRM, metodi associati in cima al drawer con nomi leggibili, vista archivio work in WorkPage

---

## Cosa è stato fatto

- Aggiunto bottone **"Vai a schema"** nel banner CRM scaduti del WorkDrawer: se la work ha 1 metodo naviga direttamente, se ne ha più mostra un DropdownMenu con i nomi dei metodi
- **Metodi associati** spostati in cima al WorkDrawer (prima dei banner), con nomi leggibili (`metodiNomi[mid]`) al posto degli ID
- Aggiunta **vista archivio** in WorkPage: bottone toggle "Archivio" nella toolbar carica le work con `archiviato = 1`; le card archiviate mostrano data e motivo archiviazione, sono cliccabili e aprono il WorkDrawer normale per vedere ingredienti e preparazioni

---

## Feature aggiunte

### Bottone "Vai a schema" dal banner CRM scaduti
**Motivazione:** Il warning CRM scaduti nel drawer era solo informativo; l'operatore non aveva un percorso diretto per andare a sistemare lo schema.
**Implementazione:** Aggiunto bottone sotto il testo del banner. Usa il prop `onVaiASchema` già esistente nell'interfaccia. Se `metodi_ids.length > 1` usa `DropdownMenu` per scegliere il metodo. Import aggiunto: `ExternalLink` da lucide-react, `DropdownMenu*` da shadcn/ui.

### Metodi associati in cima al drawer
**Motivazione:** La sezione era in fondo al drawer, difficile da vedere; gli ID erano incomprensibili.
**Implementazione:** Blocco spostato subito dopo i bottoni Modifica/Elimina. `{mid}` sostituito con `{metodiNomi?.[mid] ?? mid}` (prop già disponibile). Rimosso il vecchio blocco in fondo.

### Vista archivio work
**Motivazione:** Le work archiviate erano completamente invisibili (filtrate da `work:list`). Non c'era modo di consultarle.
**Implementazione:**
- Nuovo handler IPC `work:list-archivio` in `work.ipc.ts`: query analoga a `work:list` ma `WHERE archiviato = 1`, ordinata per `archiviato_at DESC`
- `workApi.listArchivio()` aggiunto in `api.ts`
- `WorkPage`: stato `mostraArchivio`, `load(archivio: bool)` ricarica la lista giusta, bottone toggle "Archivio" nella toolbar
- Componente `WorkCardArchivio` con date e motivo archiviazione, cliccabile per aprire il WorkDrawer esistente

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/work/WorkDrawer.tsx` | Bottone "Vai a schema" nel banner CRM, metodi associati in cima con nomi |
| `src/main/ipc/work.ipc.ts` | Nuovo handler `work:list-archivio` |
| `src/renderer/lib/api.ts` | `workApi.listArchivio()` |
| `src/renderer/pages/work/WorkPage.tsx` | Toggle archivio, `WorkCardArchivio`, load parametrizzata |

---

## Note per sessioni future

- Il WorkDrawer non distingue tra work attiva e archiviata: mostra Modifica/Elimina anche sulle archiviate. Potrebbe valere la pena nasconderli quando `work.archiviato = 1` se l'utente segnala confusione.
- `work:list-archivio` restituisce un set minimale di colonne (no `stata_lab`, no `bloccata`, no `ha_crm_scaduti`) — se serve più dettaglio nelle card archiviate, estendere la query.
- Piano di sessione: `~/.claude/plans/humming-riding-cupcake.md`
