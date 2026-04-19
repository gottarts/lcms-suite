# Resoconto sessione — Schemi: analiti con CRM filtrati per destinazione d'uso

**Data:** 2026-04-19
**Oggetto:** Miglioramenti a Metodi → Schemi: visibilità analiti con CRM in altra dest. uso, rinomina selezione automatica, link DB Composti nel dialog

---

## Cosa è stato fatto

- Gli analiti che hanno CRM valido in DB ma non per la destinazione d'uso correntemente selezionata (es. filtro QC attivo ma CRM solo in Taratura) ora appaiono con stile **normale** invece di essere grigi/disabilitati come se non esistessero
- Questi analiti mostrano un **badge cliccabile** colorato (es. "Tar", "IS") che cambia direttamente il filtro dest. uso alla destinazione in cui il CRM è disponibile
- Nel blocco degli analiti "filtrati per dest. uso" vengono mostrati prima quelli disponibili in Taratura/QC e in fondo quelli disponibili solo in IS
- Il pulsante "Selezione automatica" è rinominato **"Selezione automatica — Riepilogo copertura"**
- Nel dialog di selezione automatica, tutti i chip degli analiti (mix selezionati, singoli, non coperti) sono **cliccabili** per navigare direttamente al DB Composti filtrato per nome, con underline all'hover

---

## Feature aggiunte

### Distinzione visiva "CRM filtrato" vs "nessun CRM in DB"
**Motivazione:** Prima tutti gli analiti senza CRM nel filtro corrente venivano mostrati identicamente disabilitati (opacity 0.4, bordo tratteggiato). Ma questo era fuorviante: un analita con CRM in Taratura ma filtro QC attivo non è "senza CRM" — esiste, è solo in un'altra destinazione d'uso.

**Implementazione:**
- Aggiunto `crmFiltrati?: boolean` e `destUsoCrm?: DestUso[]` a `AnalitoItem` in `SchemaCalibrazione.types.ts`
- `buildAnalitiData()` ora riceve `itemsTotali` (tutti i CRM pre-filtro): se un analita è `senzaCrm` nel filtro corrente ma presente in `itemsTotali`, viene marcato `crmFiltrati=true` e `destUsoCrm` indica in quali dest. uso ha CRM
- Il gruppo `crmFiltrati` viene posizionato **prima** dei `senzaCrmVero` nella lista, con separatore visivo. All'interno del gruppo: prima Tar/QC, poi IS in fondo
- Nel rendering della cella analita: se `crmFiltrati=true`, stile normale (opacity 1, bordo solido) anche se `isIS=true`; badge colorati cliccabili per ogni dest. uso disponibile

**Bug risolto durante debug:** `buildAnalitiData` ri-filtrava internamente `items` per `filtroDestUso` — ma `items` era già filtrato dal chiamante. Rimosso il filtro ridondante interno.

### Link DB Composti nel dialog Selezione automatica
**Motivazione:** Il dialog mostra tutti gli analiti del metodo — utile poter navigare direttamente al DB Composti per vedere i dettagli di un analita.

**Implementazione:**
- Aggiunta prop `onGoToComposto?: (nome: string) => void` ad `AutoSelectDialog`
- Tutti i chip analiti (mix selezionati, singoli, non coperti) usano il componente `AnalitaChip` con hover underline + cursor pointer
- La navigazione chiude il dialog e lo schema, poi apre `/composti` con `searchFilter = nome`

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/metodi/SchemaCalibrazione.types.ts` | Aggiunto `crmFiltrati?`, `destUsoCrm?` a `AnalitoItem` |
| `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts` | `buildAnalitiData` riceve `itemsTotali`, calcola `crmFiltrati`/`destUsoCrm`, ordine gruppi Tar/QC prima di IS |
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | Passa `crmItems` come totali, `filtroDestUso`+`onChangeFiltroDestUso` alla griglia, `onGoToComposto` al dialog, rinomina bottone, aggiunge `useNavigate` |
| `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx` | Prop `filtroDestUso`/`onChangeFiltroDestUso`, stile `crmFiltrati` normale, badge dest. uso, separatori aggiornati per i 4 gruppi |
| `src/renderer/pages/metodi/AutoSelectDialog.tsx` | Titolo rinominato, prop `onGoToComposto`, componente `AnalitaChip` con hover |

---

## Note per sessioni future

- Il campo `destinazione_uso` nel DB usa valori come "Taratura", "Controllo qualità", "Interno IS" — la logica `matchesFiltroDestUso` usa `includes('taratura')`, `includes('controllo')`, `includes('intern')|includes(' is')`. Se vengono aggiunti nuovi valori in DB, potrebbe servire aggiornare questa funzione
- La rilevazione IS via nome (`/^m[0-9]/`) è euristica — potrebbe dare falsi positivi. Non modificato in questa sessione
- Piano di riferimento: `docs/plans/active/2026-04-19-03-feat-schemi-analiti-crm-filtrati-dest-uso-plan.md`
