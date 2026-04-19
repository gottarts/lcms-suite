# Piano: 3 Feature/Fix Work/Audit/RicaricaDialog

## Context
Tre miglioramenti indipendenti richiesti:
1. Il tasto "Schema ↗" nella WorkCard naviga sempre al `primo_metodo_id`, ignorando gli altri metodi. Il WorkDrawer già gestisce il multi-metodo con dropdown — la WorkCard deve fare lo stesso.
2. I badge CRM nell'AuditCrmSection sono statici. Devono diventare cliccabili e navigare al DB Composti con filtro sul nome del composto.
3. RicaricaDialog usa inline styles con `background: 'rgba(0,0,0,0.4)'` per l'overlay — su certi temi/sfondi risulta poco leggibile. Va reso più opaco/solido, o convertito in classi Tailwind per coerenza con il tema.

---

## 1. WorkCard — tasto Schema con multi-metodo

**File:** [src/renderer/pages/work/WorkPage.tsx](src/renderer/pages/work/WorkPage.tsx)

### Problema
- `WorkCard` riceve `onGoSchema?: () => void` — una callback senza argomenti
- `WorkPage` passa `onGoSchema={() => navigate('/metodi', { state: { schemaMetodoId: w.primo_metodo_id } })}` — hardcoded al primo metodo
- Con più metodi non c'è possibilità di scelta

### Soluzione
1. Cambiare la prop `onGoSchema` da `() => void` a `(metodoId: string) => void` (come in WorkDrawer)
2. In `WorkPage` passare `onVaiASchema={mid => { navigate('/metodi', { state: { schemaMetodoId: mid } }) }}` — o riutilizzare la stessa handler già definita alla riga 191
3. In `WorkCard`, nel render del tasto Schema (righe 376-385):
   - Se `work.metodi_ids.length === 1`: `<Button onClick={() => onGoSchema(work.metodi_ids[0])}>Schema ↗</Button>` (comportamento attuale, invariato)
   - Se `work.metodi_ids.length > 1`: `<DropdownMenu>` con un `<DropdownMenuItem>` per ogni metodo, usando `metodiNomi[mid]` come label (stesso pattern del WorkDrawer righe 483-499)

**Nota:** `metodiNomi` è già passato a `WorkCard` (riga 168) — nessuna prop aggiuntiva necessaria.

---

## 2. AuditCrmSection — badge CRM cliccabili

**File:** [src/renderer/pages/dashboard/sections/AuditCrmSection.tsx](src/renderer/pages/dashboard/sections/AuditCrmSection.tsx)

### Problema
I `<Badge>` nei componenti `WorkRowBlock` e `ScopertoRowBlock` sono elementi passivi.

### Soluzione
1. Aggiungere `useNavigate` al file (già importato da react-router-dom negli altri componenti)
2. Wrappare ogni `<Badge>` in un `<button>` cliccabile (o aggiungere `onClick` + `cursor-pointer` direttamente al Badge) che chiama:
   ```tsx
   navigate('/composti', { state: { searchFilter: c.composto_nome } })
   ```
3. Applicare a tutti i badge in `WorkRowBlock` (riga 71-94) e `ScopertoRowBlock` (riga 118-127)
4. Aggiungere stile hover leggero (es. `hover:opacity-80 cursor-pointer`) per segnalare la clicccabilità

**Pattern CompostiPage già supporta:** `location.state?.searchFilter` (riga 340) — nessuna modifica al DB Composti necessaria.

---

## 3. RicaricaDialog — overlay poco chiaro

**File:** [src/renderer/pages/work/RicaricaDialog.tsx](src/renderer/pages/work/RicaricaDialog.tsx)

### Problema
L'overlay usa `background: 'rgba(0,0,0,0.4)'` (riga 216) — su sfondi chiari risulta traslucente e poco definito visivamente. Il pannello interno usa inline styles mentre il resto dell'app usa classi Tailwind/shadcn.

### Soluzione
Aumentare l'opacità dell'overlay da `0.4` a `0.6` (o `rgba(0,0,0,0.55)`) — intervento minimo, chirurgico, senza riscrivere il componente.

---

## File da modificare
- [src/renderer/pages/work/WorkPage.tsx](src/renderer/pages/work/WorkPage.tsx) — prop WorkCard + render tasto Schema
- [src/renderer/pages/dashboard/sections/AuditCrmSection.tsx](src/renderer/pages/dashboard/sections/AuditCrmSection.tsx) — badge cliccabili
- [src/renderer/pages/work/RicaricaDialog.tsx](src/renderer/pages/work/RicaricaDialog.tsx) — opacità overlay

## Verifica
- Work con 1 metodo: tasto Schema funziona come prima
- Work con 2+ metodi: tasto Schema mostra dropdown con nomi metodi
- Badge CRM in Audit → click → naviga a /composti con filtro preimpostato
- RicaricaDialog: overlay visivamente più netto
