# Piano: 3 feature — Metodi in Composti, Audit Work archiviate, SchemaCalibrazione button

## Context

Tre feature indipendenti richieste:
1. Nel drawer DB Composti, i badge dei metodi analitici sono read-only. Devono aprire il MetodoDrawer al click.
2. In Audit, le work archiviate non sono segnalate; e non è possibile aprire una work direttamente dall'audit.
3. In SchemaCalibrazione, il pulsante "Torna a Metodi" è troppo piccolo (`h-8 text-xs`).

---

## Feature 1 — CompostoPanel: badge metodi analitici cliccabili → apre MetodoDrawer

**File:** `src/renderer/pages/composti/CompostoPanel.tsx`

### Modifiche
1. Aggiungere import `MetodoDrawer`:
   ```ts
   import { MetodoDrawer } from '../metodi/MetodoDrawer'
   ```

2. Aggiungere stato nel componente (vicino agli altri stati, ~riga 58):
   ```ts
   const [selectedMetodoId, setSelectedMetodoId] = useState<string | null>(null)
   ```

3. Modificare il badge (riga 260) per renderlo cliccabile:
   ```tsx
   <Badge
     key={m.id}
     variant="outline"
     className="text-xs cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
     onClick={() => setSelectedMetodoId(String(m.id))}
   >
     {m.nome}
   </Badge>
   ```

4. Aggiungere `MetodoDrawer` come secondo drawer (dopo la chiusura del `</SlidePanel>` principale):
   ```tsx
   <MetodoDrawer
     metodoId={selectedMetodoId}
     onClose={() => setSelectedMetodoId(null)}
     onEdit={() => {}}
     onDelete={() => {}}
     onOpenSchema={() => {}}
     onOpenParametri={() => {}}
   />
   ```
   I handler no-op rendono il drawer read-only nel contesto Composti. I pulsanti Modifica/Elimina sono visibili ma inattivi — comportamento accettabile per una visualizzazione rapida.

---

## Feature 2a — Audit: badge "Archiviata" se data audit > data archiviazione

La query in `dashboard.ipc.ts` (riga 188-196) **non filtra** `archiviato=0`, quindi le work archiviate già appaiono nei risultati audit. Il problema è che non sono segnalate visivamente.

### File 1: `src/main/ipc/dashboard.ipc.ts`
Nel SELECT works (riga 155), aggiungere `w.archiviato_at` alla lista colonne selezionate:
```sql
w.id, w.nome, w.concentrazione AS conc, w.conc_variabile, w.unita_conc, w.volume_ml,
w.validita_mesi, w.livello, w.solvente, w.archiviato_at,
```

### File 2: `src/renderer/pages/dashboard/lib/auditModel.ts`
Aggiungere campo `archiviate_alla_data: boolean` su `AuditWorkRow` (dopo `ha_prep_scadute_at_data`, riga ~47):
```ts
archiviate_alla_data: boolean
```

Nella funzione `buildAuditModel`, quando si costruisce ogni entry `righe_work`, aggiungere:
```ts
archiviate_alla_data: !!(wRaw.archiviato_at && wRaw.archiviato_at.slice(0, 10) <= input.data),
```

### File 3: `src/renderer/pages/dashboard/sections/AuditCrmSection.tsx`
Nel `WorkRowBlock`, nel header div (riga ~48, dopo i badge esistenti, prima del badge `stato`):
```tsx
{row.archiviate_alla_data && (
  <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300">
    Archiviata
  </Badge>
)}
```

---

## Feature 2b — Audit: click sul nome work naviga a WorkPage con riga espansa

Il click sul nome work deve navigare a `/work` e aprire la work con lo storico preparazioni espanso (pattern già usato dalla WorkPage recente con la riga espandibile).

Serve:
- Passare `{ workId: number, archiviata: boolean }` come `location.state` nella navigazione
- WorkPage legge lo state da `useLocation` e lo usa per impostare `drawerId` + eventualmente `mostraArchivio`

### File 1: `src/renderer/pages/dashboard/sections/AuditCrmSection.tsx`

1. `navigate` è già importato (riga 2). Aggiungere `archiviato_at` al tipo `AuditWorkRow` (fatto nella feature 2a).

2. Aggiornare firma `WorkRowBlock` per ricevere callback:
   ```tsx
   function WorkRowBlock({ row, onOpenWork }: { row: AuditWorkRow; onOpenWork: (id: number, archiviata: boolean) => void })
   ```

3. Rendere il nome work cliccabile (riga 38):
   ```tsx
   <div
     className="font-medium text-sm flex-1 truncate cursor-pointer hover:text-primary hover:underline transition-colors"
     onClick={() => onOpenWork(row.work_id, row.archiviate_alla_data)}
   >
     {row.work_nome}
   </div>
   ```

4. Nel componente `AuditCrmSection`, passare callback ai `WorkRowBlock`:
   ```tsx
   <WorkRowBlock
     key={r.work_id}
     row={r}
     onOpenWork={(id, archiviata) => navigate('/work', { state: { openWorkId: id, archiviata } })}
   />
   ```

### File 2: `src/renderer/pages/work/WorkPage.tsx`

1. Aggiungere `useLocation` all'import di react-router-dom:
   ```ts
   import { useNavigate, useLocation } from 'react-router-dom'
   ```

2. Nel componente, leggere lo state all'avvio:
   ```ts
   const location = useLocation()
   ```

3. Aggiungere un `useEffect` che si attiva dopo il caricamento iniziale delle works e apre la work indicata dallo state:
   ```ts
   useEffect(() => {
     const state = location.state as { openWorkId?: number; archiviata?: boolean } | null
     if (!state?.openWorkId) return
     if (state.archiviata && !mostraArchivio) {
       setMostraArchivio(true)  // il load viene triggerato dal useEffect esistente su mostraArchivio
     } else {
       setDrawerId(state.openWorkId)
     }
   }, [])  // solo al mount
   ```
   
   Il problema: `setMostraArchivio(true)` triggera il load, ma poi bisogna ancora settare `drawerId`. Approccio più robusto: usare uno stato `pendingOpenId: number | null` che viene consumato dopo il load.

   ```ts
   const [pendingOpenId, setPendingOpenId] = useState<number | null>(null)
   ```

   Nel `useEffect` iniziale (mount):
   ```ts
   useEffect(() => {
     const state = location.state as { openWorkId?: number; archiviata?: boolean } | null
     if (!state?.openWorkId) return
     if (state.archiviata) {
       setPendingOpenId(state.openWorkId)
       setMostraArchivio(true)
     } else {
       setDrawerId(state.openWorkId)
     }
   }, [])
   ```

   Nella funzione `load`, dopo il set delle works, consumare `pendingOpenId`:
   ```ts
   const load = async (archivio = false) => {
     const [data, metodi] = await Promise.all([...])
     setWorks(data)
     ...
     // consumare pending open
     setPendingOpenId(prev => { if (prev !== null) setDrawerId(prev); return null })
   }
   ```
   
   Nota: `setPendingOpenId` con callback non legge la versione aggiornata di `drawerId`, quindi meglio usare un `useEffect` separato che osserva `pendingOpenId` e `works`:
   ```ts
   useEffect(() => {
     if (pendingOpenId !== null && works.some(w => w.id === pendingOpenId)) {
       setDrawerId(pendingOpenId)
       setPendingOpenId(null)
     }
   }, [pendingOpenId, works])
   ```

---

## Feature 3 — SchemaCalibrazione: pulsante "Torna a Metodi" più grande

**File:** `src/renderer/pages/metodi/SchemaCalibrazione.tsx`, riga 765

Attuale: `h-8 px-3 text-xs`
Nuovo: `h-9 px-4 text-sm` (allineato a Shadcn Button size="sm")

```tsx
<button
  onClick={onClose}
  className="h-9 px-4 rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
  style={{ background:'transparent', border:'none', cursor:'pointer' }}
>
  ← Torna a Metodi
</button>
```

---

## File modificati

| File | Feature |
|------|---------|
| `src/renderer/pages/composti/CompostoPanel.tsx` | 1 |
| `src/main/ipc/dashboard.ipc.ts` | 2a |
| `src/renderer/pages/dashboard/lib/auditModel.ts` | 2a |
| `src/renderer/pages/dashboard/sections/AuditCrmSection.tsx` | 2a + 2b |
| `src/renderer/pages/work/WorkPage.tsx` | 2b |
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | 3 |

## Verifica

- Feature 1: Aprire drawer composto → sezione "Metodi Analitici" → cliccare badge → si apre MetodoDrawer sovrapposto. Chiuderlo → torna CompostoPanel.
- Feature 2a: In Audit, selezionare una data successiva all'archiviazione di una work → appare badge ambra "Archiviata" nel blocco work.
- Feature 2b: In Audit → cliccare nome di una work → naviga a `/work`, la work si apre (drawer/riga espansa). Per work archiviate: la pagina passa automaticamente in modalità Archivio e apre la work.
- Feature 3: In SchemaCalibrazione → verificare che "← Torna a Metodi" sia visibilmente più grande e leggibile.
