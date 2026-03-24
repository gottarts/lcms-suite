# Bugfix — SchemaCalibrazione: label sezione "CRM & Analiti" tagliata

---

## Problema

Nello SchemaCalibrazione, la label flottante "CRM & Analiti" (posizionata sul bordo superiore del riquadro tratteggiato) non era visibile: appariva tagliata o completamente nascosta. L'utente vedeva il bordo tratteggiato con l'header della griglia ma nessuna etichetta di sezione.

---

## Root cause

Due cause concorrenti:

1. **`overflow: hidden` sull'outer container di `GrigliaAnalitiCrm`.**
   La label è posizionata con `position: absolute, top: -9px` rispetto al container padre. Poiché il container aveva `overflow: 'hidden'`, qualsiasi contenuto che usciva dai bordi veniva tagliato — inclusa la label che sporgeva di 9px in alto.

2. **Padding-top insufficiente nel workspace.**
   Il workspace aveva `padding: '8px 12px'`. Con la label a `top: -9`, essa si trovava a `8 - 9 = -1px` dal bordo superiore del workspace — già fuori visuale anche se non fosse stata tagliata dall'overflow.

```tsx
// GrigliaAnalitiCrm — outer container (DIFETTOSO)
<div style={{ display:'flex', flexDirection:'column', flexShrink:0,
              minHeight:0, overflow:'hidden',   // ← tagliava la label
              ...borderRadius:12... }}>
  <span style={{ position:'absolute', top:-9, left:16, ... }}>CRM &amp; Analiti</span>
```

```tsx
// Workspace (DIFETTOSO)
gap:16, padding:'8px 12px'   // ← 8px < 9px → label fuori bounds
```

---

## Fix

### 1. Rimosso `overflow: hidden` dall'outer container

**File:** `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx`

```tsx
// Prima
<div style={{ display:'flex', flexDirection:'column', flexShrink:0,
              minHeight:0, overflow:'hidden', ... }}>

// Dopo
<div style={{ display:'flex', flexDirection:'column', flexShrink:0,
              minHeight:0, ... }}>
```

Lo scrolling verticale del corpo della griglia è gestito dal div interno (`overflowY: 'auto'`), quindi rimuovere `overflow: hidden` dall'outer non ha effetti collaterali.

### 2. Aumentato padding-top del workspace

**File:** `src/renderer/pages/metodi/SchemaCalibrazione.tsx`

```tsx
// Prima
padding:'8px 12px'

// Dopo
padding:'16px 12px 8px'
```

16px > 9px: la label che sporge di 9px ha spazio sufficiente per essere visibile.

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx` | Rimosso `overflow: hidden` dall'outer container di `GrigliaAnalitiCrm` |
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | Aumentato padding-top workspace da `8px` a `16px` |

---

## Note

- Lo stesso pattern label-flottante (`position: absolute, top: -9`) è usato anche in `ColonneWork`, ma lì il container non aveva `overflow: hidden`, quindi non aveva lo stesso problema.
- Il fix del padding-top è difensivo: anche senza `overflow: hidden`, una label a `top: -9` con solo `8px` di spazio sopra sarebbe parzialmente tagliata dal workspace.
