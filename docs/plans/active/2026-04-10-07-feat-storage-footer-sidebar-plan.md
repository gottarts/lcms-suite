# Piano: Spostare il percorso storage dalla Topbar al footer della Sidebar

## Context

Attualmente `dbPath` viene mostrato nella Topbar (componente `Topbar.tsx`), accanto al titolo della pagina. Questo crea ridondanza visiva. L'obiettivo è spostare tutto il controllo della cartella storage in fondo alla Sidebar, in un pannello dedicato con: indicatore suite, percorso abbreviato, pulsante "CAMBIA CARTELLA", e sotto di esso data + orario separati.

---

## Layout target del footer Sidebar

```
┌─────────────────────────────┐
│ ● suite                     │
│   /cartella/lcms.db         │
│   [CAMBIA CARTELLA]         │
├─────────────────────────────┤
│   ven 10 apr 2026  14:35    │  ← data e orario sulla stessa riga, in basso
└─────────────────────────────┘
```

Data e orario sono **sotto** il pannello storage, separati da un `border-t`. Non vanno messi nello stesso blocco del percorso.

---

## File da modificare

### 1. `src/renderer/components/layout/Topbar.tsx`
- Rimuovere la prop `dbPath?: string | null` dall'interfaccia `TopbarProps`
- Rimuovere il `<span>` condizionale che mostra `dbPath`

### 2. `src/renderer/components/layout/AppLayout.tsx`
- Rimuovere `useState<string | null>(null)` per `dbPath`
- Rimuovere `useEffect` che chiama `window.electronAPI.getConfig()` per `dbPath`
- Rimuovere la prop `dbPath={dbPath}` passata a `<Topbar>`

### 3. `src/renderer/components/layout/Sidebar.tsx`
Aggiungere al footer:

**State:**
```typescript
const [dbPath, setDbPath] = useState<string | null>(null)
```

**useEffect al mount:**
```typescript
useEffect(() => {
  window.electronAPI.getConfig().then((cfg) => setDbPath(cfg.dbPath ?? null))
}, [])
```

**handleChangeFolder:**
```typescript
async function handleChangeFolder() {
  const result = await window.electronAPI.selectFolder()
  if (result.ok) setDbPath(result.dbPath)
}
```

**Percorso abbreviato** (nome cartella padre + file):
```typescript
const shortPath = dbPath
  ? [...dbPath.split(/[\\/]/g)].slice(-2).join('/')
  : '—'
```

**JSX footer (sostituisce il div attuale):**
```jsx
{/* Pannello storage */}
<div className="p-3 text-xs text-muted-foreground border-t border-sidebar-border space-y-1">
  <div className="flex items-center gap-1 font-medium text-foreground">
    <span className="text-green-500">●</span> suite
  </div>
  <div className="truncate" title={dbPath ?? ''}>
    {shortPath}
  </div>
  <button
    onClick={handleChangeFolder}
    className="mt-1 w-full border border-sidebar-border rounded px-2 py-0.5 text-xs hover:bg-muted transition-colors"
  >
    CAMBIA CARTELLA
  </button>
</div>

{/* Data e orario */}
<div className="p-3 text-xs text-muted-foreground text-center border-t border-sidebar-border">
  <div>{today}</div>
  <div>{time.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</div>
</div>
```

**State `today`** (aggiunto accanto a `time`):
```typescript
const today = new Date().toLocaleDateString('it-IT', {
  weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
})
```

`today` è una costante calcolata una volta sola (non cambia in sessione), non serve state separato.

---

## Verifica

1. `npm run dev` — avviare l'app
2. Topbar: mostra solo il titolo della pagina, nessun percorso
3. Footer Sidebar: mostra `● suite`, percorso abbreviato con tooltip, pulsante "CAMBIA CARTELLA"
4. Clic "CAMBIA CARTELLA" → dialog di sistema → selezione cartella → percorso si aggiorna
5. Footer in basso: data e orario su righe separate, sotto il pannello storage
6. Navigare tra le pagine → footer stabile e corretto
