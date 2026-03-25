# Bugfix — SchemaCalibrazione: testo volume sovrapposto al bottone "Ricarica ↻"

---

## Problema

Nella card work dello SchemaCalibrazione, quando un work era bloccata (lotti CRM dismessi), il bottone "Ricarica ↻" si sovrapponeva visivamente all'ultima riga della tabella volumi (la riga del solvente con il valore `0.000 mL`).

---

## Root cause

Il bottone "Ricarica ↻" è posizionato con `position: absolute, bottom: 7, right: 7`. L'ultima riga della tabella volumi (solvente) ha il valore `mL` allineato a destra — esattamente dove cade il bottone. Poiché il padding inferiore della card era fisso a `8px`, il contenuto della tabella e il bottone si sovrapponevano.

---

## Fix

**File:** `src/renderer/pages/metodi/SchemaCalibrazione.tsx`

Aggiunto `paddingBottom` condizionale sulla card: quando `isBloccata`, il padding inferiore passa da `8px` a `28px`, lasciando spazio al bottone assoluto.

```tsx
// Prima
borderRadius:10, padding:'8px 12px', position:'relative',

// Dopo
borderRadius:10, padding:`8px 12px ${isBloccata ? 28 : 8}px`, position:'relative',
```

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | `paddingBottom` condizionale sulla card work quando `isBloccata` |

---

## Note

- Il bottone "Ricarica ↻" compare solo quando `isBloccata && w.dbId` — il padding extra non incide sulle card normali.
