# Piano: Fix link audit work + UNIQUE constraint metodo_analiti

## Context

Due bug distinti segnalati dall'utente:
1. I link nell'audit delle Work aprono la work page ma senza filtri → l'utente atterra sulla lista intera senza capire quale work è rilevante nel contesto dell'audit.
2. `composti:update` va in errore SQLITE_CONSTRAINT_UNIQUE su `metodo_analiti(metodo_id, nome)` in certi scenari con composti che fanno parte di un mix.

---

## Fix 1: Link audit Work con filtri

### File da modificare
- `src/renderer/pages/dashboard/sections/AuditCrmSection.tsx`
- `src/renderer/pages/work/WorkPage.tsx`

### Cosa manca
Il link dall'audit chiama:
```typescript
navigate('/work', { state: { openWorkId: row.work_id, archiviata: row.archiviate_alla_data } })
```
Ma `WorkPage` non riceve (e non applica) nessun filtro. L'utente atterra sulla lista completa.

### Pattern già esistente (da riusare)
In `CompostiPage.tsx` il pattern è identico:
```typescript
const initialSearch = (location.state as any)?.searchFilter ?? ''
```
E in `AuditCrmSection.tsx` il link verso composti già passa `searchFilter`.

### Implementazione

**AuditCrmSection.tsx** — aggiungere info sul metodo nello state del navigate per i link work:
- `WorkRowBlock` riceve già `model` (che ha `metodo_id`, `metodo_nome`). Passare `filtroMetodo: model.metodo_id` nello state.
- Stesso per `ChildWorkBadges` se ha accesso al metodo.

**WorkPage.tsx** — nel `useEffect` che legge `location.state` (righe 56-74), aggiungere:
```typescript
if (state?.filtroMetodo) setFiltroMetodo(state.filtroMetodo)
```

> La gestione archivio/attiva esiste già e funziona. Non toccarla.

---

## Fix 2: UNIQUE constraint failed in `composti:update`

### File da modificare
- `src/main/ipc/composti.ipc.ts`

### Causa
Nel handler `composti:update`, quando un composto fa parte di un mix:
1. Il loop su `altriIds` (righe ~431-437) inserisce `(mid, altro.nome)` per ogni componente del mix
2. Il loop principale (righe ~449-462) inserisce poi `(mid, nuovoNome)` per il composto aggiornato
3. Se `nuovoNome` coincide (case-insensitive) con il nome di uno degli `altriIds`, l'`INSERT OR IGNORE` **non protegge** perché il constraint è già violato nell'unica transazione

### Fix
Nel loop mix (riga ~432), filtrare i componenti il cui nome (NOCASE) è uguale al `nuovoNome` del composto aggiornato:

```typescript
for (const altro of altriIds) {
  if ((altro.nome as string).toUpperCase() === nuovoNome.toUpperCase()) continue  // skip duplicato
  deleteLinksMix.run(altro.id)
  for (const mid of metodiIds) {
    insertLinkMix.run(altro.id, mid)
    insertAnalitaUpd.run(mid, (altro.nome as string).toUpperCase())
  }
}
```

> Nota: `INSERT OR IGNORE` non rileva duplicati che avvengono nella **stessa transazione** prima che il record sia commesso. Il filtro esplicito è la soluzione corretta.

---

## Verifica

1. **Fix 1:** Nell'audit dashboard, cliccare un link work → la work page deve aprirsi con il filtro metodo già selezionato e la riga espansa.
2. **Fix 2:** Aggiornare un composto che fa parte di un mix dove esiste un componente con lo stesso nome → nessun errore UNIQUE.
