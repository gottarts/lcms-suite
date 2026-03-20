# Bugfix — SchemaCalibrazione: pagina bianca dopo "Crea Work"

---

## Problema

Premendo il pulsante **Crea Work** in `SchemaCalibrazione`, l'applicazione mostrava una pagina bianca.

---

## Root cause

Nel componente `ModalCreaWork` (`SchemaCalibrazione.grid.tsx`), il `useEffect` di reset all'apertura del modal chiamava `setOp('')`, ma la variabile di stato `op` non era mai stata dichiarata con `useState`.

```tsx
// useEffect reset — riga ~387
useEffect(() => {
  if (open) {
    setNome(''); setVolFin(''); setSolv('MeOH'); setValidita(''); setOp('') // ← crash
    ...
  }
}, [open])
```

`setOp` non esisteva → errore di runtime → React smetteva di renderizzare → pagina bianca.

---

## Fix

**File:** `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx`

1. Aggiunto lo stato mancante tra le dichiarazioni degli altri stati del modal:

```tsx
const [op,         setOp]         = useState('')
```

2. Aggiornato `handleSave` per usare lo stato `op` invece dell'hardcoded `''`:

```tsx
// prima
op: '',

// dopo
op,
```

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx` | Aggiunto `useState` per `op`; `handleSave` usa la variabile di stato |

---

## Note

- Il campo `op` era già presente nel tipo `WorkInSchema` e veniva passato correttamente nelle card, ma mancava solo nel modal di creazione.
- Il bug era introdotto probabilmente durante un refactor del form che aveva rimosso il campo `op` dall'UI mantenendo però la chiamata `setOp` nel reset.
