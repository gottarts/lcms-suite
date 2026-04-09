# Piano: 4 nuove feature UI (SchemaCalibrazione + WorkPage)

## Context
L'utente ha richiesto 4 miglioramenti UI:
1. Pulsante "Deseleziona tutto" in SchemaCalibrazione
2. Spostare "Chiudi schema" nell'header come "← Torna a Metodi"
3. Mostrare i metodi associati nella WorkCard
4. Filtro per metodo nelle work di WorkPage

## File critici
- `src/renderer/pages/metodi/SchemaCalibrazione.tsx` (1334 righe)
- `src/renderer/pages/work/WorkPage.tsx` (346 righe)

---

## Feature 1 — "Deseleziona tutto" in SchemaCalibrazione

**Dove:** Bottom bar sinistra, dopo il bottone "Selezione automatica" (riga ~1188), dentro il `<div>` con `display:'flex', gap:12`.

**Cosa aggiungere:**
```jsx
{selSrcs.size > 0 && (
  <button onClick={() => setSelSrcs(new Set())} style={{
    padding:'5px 12px', borderRadius:8, border:`1px solid ${C.page.brd}`,
    background:C.page.sur, cursor:'pointer', fontSize:11,
    fontWeight:500, color:C.page.t2,
  }}>Deseleziona tutto</button>
)}
```
Visibile solo quando `selSrcs.size > 0`.

---

## Feature 2 — Sposta "Chiudi schema" → "← Torna a Metodi" nell'header

### 2a — Aggiungere bottone nell'header (riga ~1101)
Nel `<div style={{ display:'flex', alignItems:'center', gap:12 }}>` dell'header sinistro, **come primo figlio** prima della `<span>` col titolo:
```jsx
<button onClick={onClose} style={{
  padding:'3px 9px', borderRadius:6, border:`1px solid ${C.page.brd}`,
  background:'transparent', cursor:'pointer', fontSize:11,
  fontWeight:500, color:C.page.t2,
}}>← Torna a Metodi</button>
```

### 2b — Rimuovere dal bottom bar (righe ~1195-1200)
Eliminare il bottone "← Chiudi schema" E il separatore `<div>` subito dopo:
```jsx
// DA RIMUOVERE:
<button onClick={onClose} style={{...}}>← Chiudi schema</button>
<div style={{ width:1, height:20, background:C.page.brd }} />
```

---

## Feature 3 — Metodi associati nella WorkCard

### 3a — Aggiungere `metodiNomi` alla signature di WorkCard (riga ~228)
Aggiungere `metodiNomi?: Record<string, string>` alle props.

### 3b — Passare `metodiNomi` al call site (riga ~126-133)
Aggiungere `metodiNomi={metodiNomi}` al `<WorkCard .../>`.

### 3c — Mostrare chips metodi nella WorkCard (dopo la griglia dati, riga ~306)
Inserire prima del blocco action buttons:
```jsx
{metodiNomi && work.metodi_ids && work.metodi_ids.length > 0 && (
  <div className="flex flex-wrap gap-1 mt-2">
    {work.metodi_ids.map((mid: string) => (
      <Badge key={mid} variant="outline" className="text-[10px] px-1.5 py-0 border-indigo-300 text-indigo-700 bg-indigo-50">
        {metodiNomi[mid] ?? mid}
      </Badge>
    ))}
  </div>
)}
```
`Badge` è già importato (riga 10).

---

## Feature 4 — Filtro per metodo in WorkPage

### 4a — Nuovo stato `filtroMetodo` (dopo riga ~25)
```tsx
const [filtroMetodo, setFiltroMetodo] = useState<string | null>(null)
```

### 4b — Estendere `filtered` useMemo (righe ~40-48)
```tsx
const filtered = useMemo(() => {
  let result = works
  if (filtroMetodo) {
    result = result.filter(w => w.metodi_ids?.includes(filtroMetodo))
  }
  if (search.trim()) {
    const q = search.toLowerCase()
    result = result.filter(w =>
      w.nome?.toLowerCase().includes(q) ||
      w.solvente?.toLowerCase().includes(q) ||
      w.operatore?.toLowerCase().includes(q)
    )
  }
  return result
}, [works, search, filtroMetodo])
```

Aggiungere dopo il `filtered` useMemo:
```tsx
const metodiConWork = useMemo(() => {
  const ids = new Set<string>()
  for (const w of works) {
    for (const mid of (w.metodi_ids ?? [])) ids.add(mid)
  }
  return [...ids].filter(id => metodiNomi[id])
}, [works, metodiNomi])
```

### 4c — UI chips filtro (dopo la search bar, dopo riga ~104)
```jsx
{!mostraArchivio && metodiConWork.length > 0 && (
  <div className="flex flex-wrap gap-1.5 mb-4">
    <button
      onClick={() => setFiltroMetodo(null)}
      className={`text-[11px] px-2.5 py-0.5 rounded-full border transition-colors ${
        filtroMetodo === null
          ? 'bg-foreground text-background border-foreground'
          : 'bg-background text-muted-foreground border-border hover:border-foreground/40'
      }`}
    >Tutti</button>
    {metodiConWork.map(mid => (
      <button
        key={mid}
        onClick={() => setFiltroMetodo(filtroMetodo === mid ? null : mid)}
        className={`text-[11px] px-2.5 py-0.5 rounded-full border transition-colors ${
          filtroMetodo === mid
            ? 'bg-indigo-600 text-white border-indigo-600'
            : 'bg-background text-indigo-700 border-indigo-300 hover:bg-indigo-50'
        }`}
      >{metodiNomi[mid]}</button>
    ))}
  </div>
)}
```

### 4d — Reset filtroMetodo al toggle archivio (riga ~83)
```tsx
// DA:
onClick={() => { setMostraArchivio(v => !v); setSearch('') }}
// A:
onClick={() => { setMostraArchivio(v => !v); setSearch(''); setFiltroMetodo(null) }}
```

---

## Verifica
- Aprire SchemaCalibrazione → selezionare qualche sorgente → verificare che appaia "Deseleziona tutto" → cliccarlo → sorgenti azzerate
- Verificare che "← Torna a Metodi" nell'header chiuda lo schema, e che non esista più il bottone in basso
- In WorkPage → aprire una work card con metodi associati → verificare che appaiano i badge indigo
- Verificare che i chips filtro appaiano se ci sono work con metodi → cliccare un chip → solo le work di quel metodo vengono mostrate → cliccare "Tutti" → reset
