# Piano: Refactoring WorkPage — layout a righe stile Audit

## Context

La WorkPage attuale mostra le work come card in una griglia (1-4 colonne). L'utente vuole passare a un layout a righe compatte stile `AuditCrmSection`, con:
- Una riga per ogni work (header) con badge e pulsanti azioni a destra
- Sotto ogni riga: lo storico delle preparazioni della Work (data prep, operatore, note) — non le prep Neat dei CRM

## File coinvolti

- **Da modificare:** `src/renderer/pages/work/WorkPage.tsx` (solo questo file)
- **Riferimento stile:** `src/renderer/pages/dashboard/sections/AuditCrmSection.tsx` — componente `WorkRowBlock`

## Struttura del nuovo layout

### Lista work (sostituisce grid)
```
<div className="space-y-2">
  {filtered.map(w => <WorkRow ... />)}
</div>
```

### WorkRow (sostituisce WorkCard)
```
<div className="border rounded-md overflow-hidden">
  {/* Header riga */}
  <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b">
    <div className="font-medium text-sm flex-1 truncate">{work.nome}</div>
    {/* info compatte: conc, volume, solvente, operatore */}
    <span className="text-xs text-muted-foreground hidden sm:block">
      {conc} · {volume} · {solvente}
    </span>
    {/* badge: bloccata, CRM scaduti, Prep stock scadute, Intermedia, validità, stato_lab·scadenza */}
    {/* pulsanti azioni: Prepara/Rinnova, Schema↗, +Metodo, Modifica, Archivia */}
    {/* metodi badge */}
    {/* toggle expand preparazioni */}
  </div>
  {/* Storico preparazioni (espandibile) */}
  {expanded && (
    <div className="divide-y divide-border">
      {storico.map(p => (
        <div className="px-3 py-2 text-xs flex items-center gap-3">
          <span>{formatDate(p.data_prep)}</span>
          {p.operatore && <span>· {p.operatore}</span>}
          {p.note && <span className="italic text-muted-foreground">{p.note}</span>}
          <span className="ml-auto"><StatoBadge /></span>
        </div>
      ))}
    </div>
  )}
</div>
```

## Dettagli implementazione

### Stato per ogni riga
Ogni `WorkRow` gestisce localmente:
- `expanded: boolean` — se la sezione preparazioni è visibile
- `storico: any[]` — caricato on-demand al primo expand via `workApi.preparazioniList(work.id)`
- `loading: boolean`

### Pulsanti azioni (tutti nella header row, a destra)
Stessi pulsanti della WorkCard attuale:
- `Prepara`/`Rinnova` (solo se `validita_mesi`, disabilitato se bloccata)
- `Schema ↗` o dropdown multi-metodo (solo se `metodi_ids.length > 0`)
- `+ Metodo ↗`
- `Modifica` (apre WorkForm via `onEdit`)
- Click sulla riga → apre drawer (come adesso)

I pulsanti azioni NON propagano il click al drawer (stopPropagation).

### WorkCardArchivio → WorkRowArchivio
Stessa logica, layout a riga: nome + badge "Archiviata" + data + motivo (troncato) + metodi badge.

### Cosa NON cambia
- WorkDrawer invariato
- WorkForm invariato
- Logica filtri, ricerca, metodi invariata
- Tutti gli handler (delete, archivia, edit, schema) invariati

## API chiamata
`workApi.preparazioniList(workId)` — già usata nel WorkDrawer, restituisce array di `{ id, data_prep, operatore, note, ... }`

## Verifica
1. Avviare il dev server
2. Aprire la pagina Work Solutions
3. Verificare che le work appaiano come righe (non card)
4. Cliccare sul toggle per espandere lo storico di una work tracciata
5. Verificare che i pulsanti azioni funzionino (prepara, schema, modifica)
6. Verificare che il click sulla riga apra il drawer
7. Verificare modalità archivio
