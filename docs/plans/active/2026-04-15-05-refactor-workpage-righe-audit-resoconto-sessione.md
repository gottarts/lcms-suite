# Resoconto sessione — Refactoring WorkPage: layout a righe stile Audit

**Data:** 2026-04-15
**Oggetto:** Sostituzione delle card Work con righe compatte stile AuditCrmSection, con storico preparazioni espandibile e pulsante Prepara/Rinnova prominente

---

## Cosa è stato fatto

Refactoring completo della visualizzazione della WorkPage: le card in griglia (1-4 colonne) sono state sostituite con righe compatte ispirate al layout di `AuditCrmSection`. Ogni riga mostra nome, info compatta, badge stato e pulsanti azioni in linea. Sotto ogni riga è possibile espandere lo storico delle preparazioni della work (non le prep Neat dei CRM).

Miglioramenti successivi nella stessa sessione:
- Aggiunto il toggle storico preparazioni anche alle righe archiviate (`WorkRowArchivio`)
- Il pulsante Prepara/Rinnova spostato vicino al nome, con stile colorato distinto (verde = prima prep, indigo = rinnovo)
- Cliccando Prepara/Rinnova il drawer si apre con il form registrazione già espanso

---

## Feature aggiunte

### Layout a righe stile Audit (WorkRow)
**Motivazione:** Le card in griglia erano disordinate e poco dense. Il layout a righe è più leggibile e coerente con il resto dell'app (AuditCrmSection).
**Implementazione:** Nuovo componente `WorkRow` con header `bg-muted/30` + sezione storico espandibile. Lo storico viene caricato on-demand alla prima apertura via `workApi.preparazioniList(work.id)`. Ogni riga dello storico mostra data, operatore, note, data scadenza calcolata e badge stato (attiva/in_scadenza/scaduta).

### Storico preparazioni nelle righe archiviate
**Motivazione:** Le work archiviate tracciate hanno uno storico preparazioni ugualmente rilevante.
**Implementazione:** `WorkRowArchivio` ora ha lo stesso stato `expanded/storico/loadingStorico` di `WorkRow`, con toggle visibile solo se `validita_mesi` è presente.

### Pulsante Prepara/Rinnova prominente
**Motivazione:** Il pulsante era nascosto in fondo tra gli altri micro-pulsanti. L'utente voleva un accesso visivo immediato.
**Implementazione:** Il pulsante è stato spostato subito dopo il nome della work, dentro un `flex` insieme al nome. Dimensione `h-6 text-[11px]`, colori: verde per prima prep, indigo per rinnovo, arancione disabilitato per work bloccata.

### Apertura automatica form preparazione dal pulsante
**Motivazione:** Click su Prepara/Rinnova apriva il drawer ma il form era chiuso — richiedeva un secondo click.
**Implementazione:** Aggiunta prop `openPrepForm?: boolean` a `WorkDrawerProps`. Nel `useEffect` che reagisce a `workId`, `setPrepForm(!!openPrepForm)`. In WorkPage, stato `drawerPrepForm` impostato a `true` prima di aprire il drawer dal pulsante Prepara/Rinnova.

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/work/WorkPage.tsx` | Riscrittura completa: `WorkCard` → `WorkRow`, `WorkCardArchivio` → `WorkRowArchivio`; stato `drawerPrepForm` |
| `src/renderer/pages/work/WorkDrawer.tsx` | Aggiunta prop `openPrepForm` all'interfaccia e al componente; `useEffect` aggiornato |

---

## Note per sessioni future

- Il piano è in `docs/plans/active/2026-04-15-05-refactor-workpage-righe-audit-plan.md`
- Il calcolo dello stato (attiva/in_scadenza/scaduta) nello storico preparazioni di `WorkRow` e `WorkRowArchivio` è duplicato — se in futuro si aggiunge logica più complessa, valutare di estrarlo in una funzione condivisa
- `WorkRowArchivio` non ha i pulsanti azioni (Schema, Modifica, Archivia) perché le work archiviate non si modificano — corretto by design
