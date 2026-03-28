# Piano: tooltip concentrazioni nel form Crea Work + fix mix eterogenea

## Context

Nel form `ModalCreaWork` (schema calibrazione), quando una sorgente ha concentrazioni variabili (mix con analiti a concentrazioni diverse, o work derivata da tali mix), viene mostrato solo il label "variabile" senza dettaglio. L'utente vuole un tooltip che mostri le concentrazioni di ogni singolo composto.

Inoltre: c'è un bug nella card mix della `GrigliaAnalitiCrm` — mostra sempre `info.cv` (il cv del primo componente) come concentrazione del mix, anche quando il mix ha composti a concentrazioni eterogenee. Va corretto.

**Regola fondamentale**: un mix con composti a concentrazioni diverse NON ha una concentrazione propria — va mostrata solo la concentrazione per-composto.

---

## File critici

- [src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx](src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx)
- [src/renderer/pages/metodi/SchemaCalibrazione.tsx](src/renderer/pages/metodi/SchemaCalibrazione.tsx)
- [src/renderer/pages/metodi/SchemaCalibrazione.logic.ts](src/renderer/pages/metodi/SchemaCalibrazione.logic.ts)

---

## Stato attuale rilevante

- `toggleMix` (SchemaCalibrazione.tsx:654) già computa correttamente `SorgenteSel.concVariabile = eterogenea` → `getConcInfo` ritorna già correttamente `variabile`
- `CrmItem.concVariabile` (logic.ts:66) è hardcoded a `false` ma non è letto per il flusso principale (bonus fix)
- `mixInfo.get(a.mixId)` in GrigliaAnalitiCrm prende il primo `CrmItem` del mix; la riga 384 ne mostra `info?.cv` senza verificare se il mix è eterogeneo ← **bug**
- `ModalCreaWork` non riceve `crmItems` → non può costruire la lista composti per il tooltip

---

## Cambiamenti

### 1. Fix bug mix card — `SchemaCalibrazione.grid.tsx` (riga ~68-72 + riga 384)

Dopo le mappe esistenti (`mixInfo`, `mixAllComps`, ecc.), aggiungere:
```typescript
// mix_id → true se i componenti hanno cv diverse
const mixCvSets = new Map<string, Set<number>>()
for (const c of crmItems) {
  if (c.mix_id) {
    const s = mixCvSets.get(c.mix_id) ?? new Set<number>()
    s.add(c.cv)
    mixCvSets.set(c.mix_id, s)
  }
}
```

Alla riga 384, sostituire:
```tsx
{info?.cv ? `${info.cv} mg/L` : ''}
```
con:
```tsx
{(mixCvSets.get(a.mixId)?.size ?? 0) <= 1 && info?.cv ? `${info.cv} mg/L` : ''}
```

### 2. Aggiungi `crmItems` a `ModalProps` — `SchemaCalibrazione.grid.tsx` (riga ~422)

Aggiungere `crmItems: CrmItem[]` all'interfaccia `ModalProps` e al destructuring di `ModalCreaWork`.

### 3. Tooltip nel form sorgenti — `SchemaCalibrazione.grid.tsx` (riga ~556-587)

Nel loop `srcs.map(s => ...)`, quando `isVar = true`, calcolare il testo del tooltip.
Aggiungere "ⓘ" con `title` nativo accanto al label "variabile".
Per mix: `crmItems.filter(c => c.mix_id === s.id)` → lista composti.
Per work: `getCompsFromWork(w, workCols, crmItems)` → lista composti con conc calcolata.

### 4. Passa `crmItems` a `ModalCreaWork` — `SchemaCalibrazione.tsx` (riga ~927)

### 5. (Bonus) Fix `CrmItem.concVariabile` — `SchemaCalibrazione.logic.ts` (riga ~66)

Ricalcola `concVariabile` dopo il mapping degli items, rilevando i mix eterogenei.

### 6. (Post-approvazione) Fix catena tracciabilità nel drawer

In `ChainNode` (SchemaCalibrazione.tsx), le foglie CRM mostravano sempre `src.cv mg/L · CRM`.
Fix: se `src.concVariabile = true`, mostrare `variabile ⓘ · CRM` con tooltip composti.

---

## Verifica

1. Aprire schema calibrazione con un metodo che ha un mix con analiti a concentrazioni diverse
2. Nella GrigliaAnalitiCrm: la card del mix NON deve mostrare una concentrazione unica
3. Selezionare quel mix come sorgente → aprire ModalCreaWork → "variabile ⓘ" con tooltip
4. Aprire drawer di una work con mix eterogeneo → catena tracciabilità → "variabile ⓘ · CRM"
