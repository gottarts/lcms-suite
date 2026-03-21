# Fix card CRM Mix in SchemaCalibrazione

## Context

Le card CRM Mix nella scheda calibrazione presentano 4 bug:
1. Nomi analiti barrati di default (vacuous truth JS)
2. Nessuna concentrazione per analita nei chip
3. Titolo della card mostra il mix_id tecnico invece del nome commerciale
4. Link ↗ al DB composti apre solo il primo composto invece di filtrare per tutto il mix

---

## Bug 1 – Nomi barrati (vacuous truth)

**File:** `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx` linea 330

**Causa:** `[].every(pred)` in JavaScript ritorna sempre `true`. Gli analiti che appartengono solo al mix (nessun singolo, `sngIds = []`) hanno sempre `allRem = true`, applicando strikethrough e opacity 0.3 ai loro chip.

**Fix:**
```ts
// PRIMA (buggy)
const allRem = analitoN?.sngIds.every(id => removedCon.has(id)) ?? false

// DOPO
const allRem = !!analitoN && analitoN.sngIds.length > 0
              && analitoN.sngIds.every(id => removedCon.has(id))
```

---

## Bug 2 – Concentrazioni per analita nei chip

**File:** `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx` linee 327-341

**Causa:** I chip mostrano solo il nome dell'analita. `info.cv` nel header è la concentrazione del primo CrmItem del mix.

**Fix:** Costruire una Map `nome → CrmItem` per i compound del mix e affiancare la concentrazione nel chip.

---

## Bug 3 – Card title mostra mix_id tecnico

**File:** `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx` linea 317
**Tipo:** `src/renderer/pages/metodi/SchemaCalibrazione.types.ts`
**Logic:** `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts`

**Causa:** `info?.mix_id ?? a.mixId` mostra il mix_id tecnico (es. "mix_1a2b3c4d"). Il campo `mix` (nome commerciale) non è incluso in `CrmItem`.

**Fix:** Aggiungere `mix: string | null` a `CrmItem`, mapparlo nel hook, usarlo nella card title.

---

## Bug 4 – Link ↗ filtra solo il primo composto

**File A:** `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx` linea 291
**File B:** `src/renderer/pages/composti/CompostiPage.tsx` linee 497-517

**Causa:** `goToComposto(info?.nome ?? a.mixId!)` passa il nome del primo analita. `CompostiPage` non ricerca nel campo `mix_id`.

**Fix:**
- `CompostiPage`: aggiungere `c.mix_id?.toLowerCase().includes(q)` alla ricerca
- `grid.tsx`: cambiare in `goToComposto(a.mixId!)`

---

## File da modificare

| File | Sezione | Bug |
|------|---------|-----|
| `src/renderer/pages/metodi/SchemaCalibrazione.types.ts` | interfaccia `CrmItem` | Bug 3 |
| `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts` | mapping `items` (linea ~48) | Bug 3 |
| `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx` | linea 330, 317, 291, 327-341 | Bug 1, 2, 3, 4 |
| `src/renderer/pages/composti/CompostiPage.tsx` | useMemo `filtered` linea ~516 | Bug 4 |
