# Fix: Selezione automatica — mix + singolo duplicato per stesso analita

**Data**: 2026-04-17  
**Tipo**: Bug fix  
**Stato**: Completato

---

## Problema

Nella selezione automatica CRM degli schemi di calibrazione, quando veniva selezionata una mix che copriva un analita, il sistema selezionava **anche** lo standard singolo per lo stesso analita.

Conseguenza: l'analita risultava aggiunto da due sorgenti distinte (mix + singolo), comportamento scorretto che poteva causare errori nello schema. Osservato sul metodo 098.

---

## Causa root

**File**: `src/renderer/pages/metodi/AutoSelectDialog.tsx`, riga 56.

Il set `coperteDaMix` veniva popolato con nomi in **lowercase** (proveniente da `buildMixComposizioni` in `SchemaCalibrazione.scenari.ts:60` che fa `n.toLowerCase()`).

Il controllo di esclusione usava però `a.nome` in **case originale** dal DB:

```ts
// Prima del fix — confronto fallisce per mismatch di case
if (coperteDaMix.has(a.nome)) continue  // "Atrazine" ≠ "atrazine" → false!
```

Il `continue` non scattava, quindi l'analita veniva considerato "non coperto da mix" e veniva aggiunto anche come singolo.

---

## Fix

Riga 56 di `AutoSelectDialog.tsx`: normalizzare il confronto a lowercase.

```ts
// Dopo il fix
if (coperteDaMix.has(a.nome.toLowerCase())) continue
```

Modifica chirurgica a una sola riga.

---

## File modificati

- `src/renderer/pages/metodi/AutoSelectDialog.tsx` — riga 56, `.toLowerCase()` sul nome analita nel check `coperteDaMix`
