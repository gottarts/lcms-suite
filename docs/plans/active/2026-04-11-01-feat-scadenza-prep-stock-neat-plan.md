# Piano: Scadenza prep NEAT nelle Work

## Context

Le work possono usare preparazioni stock NEAT come ingredienti (`source_type = 'prep'`). Le prep NEAT hanno un campo `scadenza` nella tabella `preparazioni`, ma il sistema non lo verifica mai nelle work. Al contrario, per i CRM normali esiste già la logica completa: flag `ha_crm_scaduti`, badge "CRM scaduti" nella WorkCard, banner nel WorkDrawer. Lo stesso pattern va applicato alle prep NEAT.

## Approccio

### 1. Backend — `src/main/ipc/work.ipc.ts`

Aggiungere in entrambi i punti dove si calcola `n_ingredienti_scaduti` (righe ~34-54 in `work:list` e ~193-212 in `work:get`) una query/conteggio aggiuntivo per le prep NEAT scadute.

**In `work:list`** — aggiungere subquery SQL accanto a `n_ingredienti_scaduti`:
```sql
(SELECT COUNT(*)
  FROM work_ingredienti wi
  JOIN preparazioni p ON p.id = COALESCE(wi.prep_id, wi.source_id)
  WHERE wi.work_id = w.id
    AND wi.source_type = 'prep'
    AND p.stato IS NULL OR p.stato = 'Attiva'   -- non dismessa
    AND p.data_dismissione IS NULL
    AND p.scadenza IS NOT NULL
    AND p.scadenza < date('now')
) AS n_prep_scadute,
```
Poi nel mapping `.map()`: `ha_prep_scadute: (w.n_prep_scadute as number) > 0`

**In `work:get`** — aggiungere query analoga dopo quella per `nScaduti` (riga ~193):
```ts
const nPrepScadute = (db.prepare(`
  SELECT COUNT(*) AS cnt
  FROM work_ingredienti wi
  JOIN preparazioni p ON p.id = COALESCE(wi.prep_id, wi.source_id)
  WHERE wi.work_id = ?
    AND wi.source_type = 'prep'
    AND p.data_dismissione IS NULL
    AND p.scadenza IS NOT NULL
    AND p.scadenza < date('now')
`).get(id) as any).cnt as number
work.ha_prep_scadute = nPrepScadute > 0
```

> **Nota sulla tabella `preparazioni`**: la colonna `stato` potrebbe non esistere come campo diretto — la scadenza è calcolata dal campo `scadenza` e `data_dismissione`. Usare solo `data_dismissione IS NULL AND scadenza < date('now')`.

### 2. Tipo condiviso — `src/shared/types.ts`

Aggiungere il campo alla interfaccia `Work` (riga ~254):
```ts
ha_prep_scadute?: boolean  // true se almeno 1 prep NEAT usata è scaduta
```

### 3. WorkPage — `src/renderer/pages/work/WorkPage.tsx`

Nella `WorkCard` (riga ~272), aggiungere dopo il badge "CRM scaduti" (riga ~298-303):
```tsx
{!isBloccata && !!work.ha_prep_scadute && (
  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-yellow-400 text-yellow-700 bg-yellow-50 flex items-center gap-1">
    <AlertCircle className="h-2.5 w-2.5" />
    Prep scadute
  </Badge>
)}
```

### 4. WorkDrawer — `src/renderer/pages/work/WorkDrawer.tsx`

Aggiungere banner analogy a quello "CRM scaduti" (riga ~459-465), subito dopo di esso:
```tsx
{!isBloccata && !!work.ha_prep_scadute && (
  <div className="rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
    <div className="flex items-start gap-2">
      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
      <span>Una o più preparazioni NEAT usate in questa work sono scadute. Verifica le prep nel DB Composti.</span>
    </div>
  </div>
)}
```

Inoltre, nella riga ~322-325 dove viene mostrato il testo `prep #N · Neat`, aggiungere la data di scadenza se disponibile. Per farlo, occorre propagare `scadenza` nel `SorgenteSel` (step 5).

### 5. Propagare `scadenza` nel SorgenteSel — `src/renderer/pages/work/WorkDrawer.tsx` e `SchemaCalibrazione.types.ts`

**`SchemaCalibrazione.types.ts`** — aggiungere campo opzionale a `SorgenteSel`:
```ts
scadenza?: string | null   // solo per tipo 'prep'
```

**`WorkDrawer.tsx` riga ~146-155** — nel blocco `else if (ing.source_type === 'prep')`, aggiungere `scadenza` al `SorgenteSel` spingendo la info dalla query di `work:get`. Però `work:get` già carica `wi.*` e JOIN a `preparazioni` per flacone/progressivo — aggiungere `scadenza` alla subquery CASE:
```sql
CASE
  WHEN wi.source_type = 'prep' THEN (SELECT scadenza FROM preparazioni WHERE id = COALESCE(wi.prep_id, wi.source_id))
  ELSE NULL
END AS source_scadenza,
```

Poi nel building `SorgenteSel` riga ~147:
```ts
srcs.push({
  ...
  scadenza: ing.source_scadenza ?? null,
})
```

**`WorkDrawer.tsx` riga ~321-326** — mostrare scadenza se presente:
```tsx
{src.tipo === 'prep' && (src.progressivo != null || src.lotto) && (
  <div style={{ fontSize:9, color: src.scadenza && src.scadenza < oggi ? 'red' : C.page.t2, ... }}>
    {`prep #${src.progressivo ?? '?'}${src.lotto ? ` da lotto ${src.lotto}` : ''} · Neat`}
    {src.scadenza && <span> · scad. {formatDate(src.scadenza)}</span>}
  </div>
)}
```

## File modificati

| File | Cosa cambia |
|------|-------------|
| `src/main/ipc/work.ipc.ts` | +subquery `n_prep_scadute` in `work:list` e `work:get`; +`ha_prep_scadute` nel mapping |
| `src/shared/types.ts` | +`ha_prep_scadute?: boolean` in `Work`; +`scadenza?: string \| null` in `SorgenteSel` |
| `src/renderer/pages/work/WorkPage.tsx` | +badge "Prep scadute" in WorkCard |
| `src/renderer/pages/work/WorkDrawer.tsx` | +banner warning; +`source_scadenza` nella subquery SQL; +propagazione in SorgenteSel; +mostra scadenza accanto "Neat" |
| `src/renderer/pages/metodi/SchemaCalibrazione.types.ts` | +`scadenza?: string \| null` in `SorgenteSel` |

## Verifica

1. Creare o trovare una prep NEAT con `scadenza` passata nel DB
2. Creare/aprire una work che la usa come ingrediente
3. Verificare: badge "Prep scadute" visibile nella WorkCard
4. Aprire il drawer: banner warning visibile + data scadenza rossa accanto al testo "Neat"
5. Verificare che work senza prep scadute non mostrino il badge
