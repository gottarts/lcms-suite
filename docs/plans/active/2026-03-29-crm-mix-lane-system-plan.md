# Piano: CRM Mix overlapping — sub-colonne dinamiche (lane system)

## Context

`AnalitoItem.mixId: string | null` assume che ogni analita appartenga a un solo mix CRM.
Se due mix commerciali diversi contengono alcuni analiti in comune, solo il primo viene tracciato
e il secondo è invisibile nella griglia. L'obiettivo è passare a `mixIds: string[]` e
implementare un algoritmo di lane assignment nella grid che visualizzi più mix sovrapposti
come sub-colonne affiancate, con linee di connessione tra i frammenti dello stesso mix.

Caso estremo supportato: **3 corsie** (max concorrenza prevista in produzione).

---

## File critici

| File | Ruolo |
|------|-------|
| `src/renderer/pages/metodi/SchemaCalibrazione.types.ts` | Tipi — modifica `AnalitoItem`, aggiunge `MixFragment` |
| `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts` | Hook `useSchemaData`, aggiunge `computeMixFragmentsAndLanes` |
| `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx` | Rendering grid — cambio principale |
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | 1 riga da aggiornare (riga 856) |

---

## Step 1 — `SchemaCalibrazione.types.ts`

### Modifica `AnalitoItem`
```diff
- mixId:  string | null
+ mixIds: string[]          // tutti i mix che contengono questo analita
  isCon:  boolean           // ha sia ≥1 mix che ≥1 singolo
```

### Nuovo tipo `MixFragment`
```typescript
export interface MixFragment {
  mixId:    string
  topPx:    number   // posizione verticale (px) nella colonna mix
  heightPx: number   // altezza (px)
  lane:     number   // corsia assegnata (0, 1, 2)
  isFirst:  boolean  // primo frammento del mix → mostra nome/lotto
}
```

---

## Step 2 — `SchemaCalibrazione.logic.ts`

### In `useSchemaData`: da `mixMap` (1:1) a `mixesMap` (1:N)

```diff
- const mixMap = new Map<string, string>()   // nome → mix_id
+ const mixesMap = new Map<string, string[]>() // nome → [mix_id, ...]

  for (const item of items) {
    if (item.mix_id) {
-     mixMap.set(item.nome, item.mix_id)
+     const arr = mixesMap.get(item.nome) ?? []
+     if (!arr.includes(item.mix_id)) arr.push(item.mix_id)
+     mixesMap.set(item.nome, arr)
    } else { ... }
  }
```

### Costruzione `AnalitoItem`
```diff
  nome:   row.nome,
- mixId:  mixMap.get(row.nome) ?? null,
+ mixIds: mixesMap.get(row.nome) ?? [],
  sngIds: sngMap.get(row.nome) ?? [],
- isCon:  mixMap.has(row.nome) && sngMap.has(row.nome),
+ isCon:  (mixesMap.get(row.nome)?.length ?? 0) > 0 && sngMap.has(row.nome),
```

### Ordinamento (`soloSng / conMix / senzaCrm`)
```diff
- const soloSng  = analitiCalc.filter(a => !a.mixId && a.sngIds.length > 0)
- const conMix   = analitiCalc.filter(a =>  a.mixId)
- const senzaCrm = analitiCalc.filter(a => !a.mixId && a.sngIds.length === 0)
+ const soloSng  = analitiCalc.filter(a => a.mixIds.length === 0 && a.sngIds.length > 0)
+ const conMix   = analitiCalc.filter(a => a.mixIds.length > 0)
+ const senzaCrm = analitiCalc.filter(a => a.mixIds.length === 0 && a.sngIds.length === 0)
```

Raggruppamento `mixGrouped`: usa `mixIds[0]` come mix primario (invariato nella logica,
solo il campo cambia nome).

### Nuova funzione esportata: `computeMixFragmentsAndLanes`

```typescript
export function computeMixFragmentsAndLanes(
  analiti:     AnalitoItem[],
  mixTopPx:    Record<string, number>,    // mix_id → top px (calcolato nel grid)
  mixHeightPx: Record<string, number>,    // mix_id → height px
): { fragments: MixFragment[]; totalLanes: number }
```

**Algoritmo (greedy interval scheduling su frammenti):**

1. Ogni mix può avere analiti NON contigui → spezza in frammenti.
   Un "frammento" è un blocco contiguo di righe consecutive dello stesso mix.

   ```
   Per ogni mix_id:
     trova tutti gli indici i dove analiti[i].mixIds.includes(mix_id)
     raggruppa in run contigui
     per ogni run [start..end]:
       topPx    = mixTopPx calcolato per quella riga
       heightPx = somma delle rowHeights nel run
   ```

2. Ordina tutti i frammenti per `topPx`.

3. Greedy lane assignment:
   ```
   laneEnds = []  // bottomPx corrente di ogni corsia
   per ogni fragment:
     lane = primo indice di laneEnds dove laneEnds[lane] <= fragment.topPx
     se non trovato → apri nuova corsia
     fragment.lane = lane
     laneEnds[lane] = fragment.topPx + fragment.heightPx
   ```

4. `totalLanes = laneEnds.length` (capped a 3)

5. `isFirst = true` per il primo frammento di ogni mix_id.

---

## Step 3 — `SchemaCalibrazione.grid.tsx`

### `mixAnaliti` — include anche i mix "secondari"
```diff
  for (const a of analiti) {
-   if (a.mixId) { ... mixAnaliti.set(a.mixId, ...) }
+   for (const mid of a.mixIds) {
+     const arr = mixAnaliti.get(mid) ?? []
+     arr.push(a.nome)
+     mixAnaliti.set(mid, arr)
+   }
  }
```

### Calcolo `mixTopPx` e `mixHeightPx` — invariato nella forma
Il loop che calcola `cumY` usa già tutte le righe con `a.mixId`; cambia solo il
campo: `if (a.mixIds.length > 0)`. Per i mix secondari (non primari), top e height
vengono calcolati dagli stessi indici di riga.

> **Nota**: per analiti con più mix, `mixTopPx[mixId]` viene registrato per
> **tutti** i `mixId` in `a.mixIds` (non solo il primo).

### Chiamata a `computeMixFragmentsAndLanes`
```typescript
const { fragments, totalLanes } = computeMixFragmentsAndLanes(
  analiti, mixTopPx, mixHeightPx
)
const LANE_W = Math.floor(270 / Math.min(totalLanes, 3))
```

### Contenitore blocchi mix — larghezza dinamica
```diff
- position:'absolute', left:190, width:270,
+ position:'absolute', left:190, width: LANE_W * totalLanes,
```
L'header "CRM Mix" mostra la stessa larghezza totale (invariato visivamente se
`totalLanes === 1`).

### Rendering card — da 1 card per mix a N frammenti
```tsx
{fragments.map((frag, idx) => {
  const info    = mixInfo.get(frag.mixId)
  const sel     = selSrcs.has(frag.mixId)
  const isRmMx  = removedMix.has(frag.mixId)
  const left    = frag.lane * LANE_W + 8
  const width   = LANE_W - 16
  return (
    <div
      key={`${frag.mixId}-${idx}`}
      ref={frag.isFirst ? el => registerCardRef(frag.mixId, el) : undefined}
      onClick={() => !isRmMx && onToggleMix(frag.mixId)}
      style={{
        position:'absolute',
        left, width,
        top: frag.topPx + 5,
        height: frag.heightPx - 10,
        // ... stili invariati ...
      }}
    >
      {/* Mostra nome commerciale + lotto SOLO sul primo frammento */}
      {frag.isFirst && (
        <>
          <div style={{ fontSize: totalLanes > 1 ? 9 : 11, fontWeight:700,
                        fontFamily:'IBM Plex Mono, monospace', color:C.mix.text,
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {info?.mix ?? frag.mixId}
          </div>
          {info?.lotto && (
            <div style={{ fontSize:8, color:C.page.t2,
                          fontFamily:'IBM Plex Mono, monospace',
                          background: C.mix.chip, borderRadius:3,
                          padding:'1px 4px', display:'inline-block', marginTop:2 }}>
              {info.lotto}
            </div>
          )}
        </>
      )}
      {/* Frammenti successivi: solo indicatore colorato minimal */}
      {!frag.isFirst && (
        <div style={{ fontSize:8, color:C.mix.text, opacity:0.7,
                      fontFamily:'IBM Plex Mono, monospace' }}>
          ···
        </div>
      )}
    </div>
  )
})}
```

### Linee connettore tra frammenti dello stesso mix

Dopo il loop dei frammenti, aggiunge SVG assoluto per le linee:
```tsx
<svg style={{ position:'absolute', left:0, top:0,
              width: LANE_W * totalLanes, height: totalMixHeight,
              pointerEvents:'none', overflow:'visible' }}>
  {/* Per ogni mix con >1 frammento, connetti frammento[i] → frammento[i+1] */}
  {Array.from(fragmentsByMix.entries()).map(([mixId, frags]) => {
    if (frags.length <= 1) return null
    return frags.slice(0, -1).map((f, i) => {
      const next = frags[i + 1]
      const x = f.lane * LANE_W + LANE_W / 2
      return (
        <line key={`conn-${mixId}-${i}`}
          x1={x} y1={f.topPx + f.heightPx - 5}
          x2={x} y2={next.topPx + 5}
          stroke={C.mix.border} strokeWidth={1.5} strokeDasharray="3 3" opacity={0.5}
        />
      )
    })
  })}
</svg>
```

---

## Step 4 — `SchemaCalibrazione.tsx` (riga 856)

```diff
- a.mixId && !removedMix.has(a.mixId)
+ a.mixIds.length > 0 && a.mixIds.some(id => !removedMix.has(id))
```

---

## Larghezze card per numero di corsie

| Corsie | `LANE_W` | Contenuto card |
|--------|----------|----------------|
| 1      | 270px    | Nome completo + lotto + produttore + chip analiti |
| 2      | 135px    | Nome abbreviato + badge lotto (isFirst only) |
| 3      | 90px     | Nome molto corto + badge lotto (isFirst only) |

Chip degli analiti: mostrati solo se `height > 60px` (spazio sufficiente).

---

## Verifiche

1. **Caso base (nessun overlap)**: `totalLanes === 1`, rendering identico a prima.
2. **2 mix sovrapposti**: due corsie, linee SVG tratteggiate tra i frammenti.
3. **3+ mix sovrapposti**: capped a 3 corsie.
4. **Click su card in corsia 1**: `onToggleMix` funziona come prima.
5. **Connessioni SVG work → mix**: `registerCardRef` su `isFirst` fragment → le frecce puntano al primo frammento (comportamento corretto).
6. **Rimozione mix (×)**: `removedMix` set funziona per `mix_id`, invariato.
