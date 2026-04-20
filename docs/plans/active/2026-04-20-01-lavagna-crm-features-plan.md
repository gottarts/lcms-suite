# Lavagna CRM — Raggruppamento, Fix Analiti, Feature Griglia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere alla lavagna React Flow: raggruppamento CRM con analiti in comune (GroupNode), fix blocco analiti IS con filtro dest. uso, chip analiti con toggle, selezione CRM aggiorna `selSrcs` condiviso, e feature Work (WorkDrawer, Ricarica, Cancella) riusando esattamente il codice della griglia.

**Architecture:** Tutte le modifiche sono in `SchemaCalibrazione.lavagna.tsx` (inline node components, funzioni pure di layout, hook). Il file `SchemaCalibrazione.tsx` (root) riceve le callback necessarie come nuove props passate a `SchemaLavagna`. Nessuna modifica a `SchemaCalibrazione.grid.tsx`, `SchemaCalibrazione.logic.ts`, `SchemaCalibrazione.types.ts`.

**Tech Stack:** React, TypeScript, @xyflow/react (React Flow), dagre, localStorage

---

## Mappa file

| File | Modifiche |
|------|-----------|
| `src/renderer/pages/metodi/SchemaCalibrazione.lavagna.tsx` | Principale: GroupNode, fix AnalitiNode, toggle chip, selezione, azioni Work |
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | Passa nuove props a `SchemaLavagna`: callbacks toggle, delete, drawer, ricarica |

---

## Task 1: Aggiungi props callback a SchemaLavagna

**File:**
- Modify: `src/renderer/pages/metodi/SchemaCalibrazione.lavagna.tsx` (riga 30–41)
- Modify: `src/renderer/pages/metodi/SchemaCalibrazione.tsx` (riga 825–836)

- [ ] **Step 1: Estendi l'interfaccia SchemaLavagnaProps**

In `SchemaCalibrazione.lavagna.tsx`, alla riga 30, modifica `SchemaLavagnaProps`:

```typescript
export interface SchemaLavagnaProps {
  metodoId: string
  metodoNome: string
  analiti: AnalitoItem[]
  crmItems: CrmItem[]
  selSrcs: Map<string, SorgenteSel>
  removedMix: Set<string>
  mixLottoSel: Map<string, string>
  workCols: WorkInSchema[][]
  filtroDestUso: DestUso
  onSelectModulo?: (id: string) => void
  // Nuove props per feature interattive
  onToggleMix?: (mixId: string) => void
  onToggleSng?: (sngId: string) => void
  onTogglePrepStock?: (prepKey: string, prepId: number, crmNome: string, cv: number, lotto: string | null, flacone: string | null, progressivo: number | null) => void
  onToggleWork?: (work: WorkInSchema, colSrc: number) => void
  onDeleteWork?: (colIdx: number, workIdx: number) => void
  onOpenWorkDrawer?: (work: WorkInSchema, colIdx: number) => void
  onRicaricaWork?: (workId: number) => void
  onRemoveMix?: (mixId: string) => void
  onRemoveSng?: (sngId: string) => void
}
```

- [ ] **Step 2: Passa le nuove props da SchemaCalibrazione.tsx**

In `SchemaCalibrazione.tsx`, nel blocco `<SchemaLavagna ...>` (riga 825–836):

```tsx
{vista === 'lavagna' && (
  <SchemaLavagna
    metodoId={metodoId}
    metodoNome={metodoNome}
    analiti={analiti}
    crmItems={crmItemsFiltrati}
    selSrcs={selSrcs}
    removedMix={removedMixEffettivo}
    mixLottoSel={mixLottoSel}
    workCols={workCols}
    filtroDestUso={filtroDestUso}
    onToggleMix={toggleMix}
    onToggleSng={toggleSng}
    onTogglePrepStock={togglePrepStock}
    onToggleWork={toggleWork}
    onDeleteWork={handleDeleteWork}
    onOpenWorkDrawer={(w, ci) => { setDrawerWork(w); setDrawerCol(ci) }}
    onRicaricaWork={(id) => setDialogs(d => ({ ...d, ricaricaWorkId: id }))}
    onRemoveMix={(mixId) => setRemovedMix(prev => { const s = new Set(prev); s.add(mixId); return s })}
    onRemoveSng={(sngId) => {
      // I singoli non hanno removedMix — li escludiamo rimuovendoli da selSrcs
      setSelSrcs(prev => { const m = new Map(prev); m.delete(sngId); return m })
    }}
  />
)}
```

- [ ] **Step 3: Destructura le nuove props nel componente SchemaLavagna**

In `SchemaCalibrazione.lavagna.tsx`, riga 1003–1004, aggiorna la destructuring:

```typescript
export function SchemaLavagna(props: SchemaLavagnaProps) {
  const {
    metodoId, analiti, crmItems, removedMix, mixLottoSel, workCols,
    selSrcs,
    onToggleMix, onToggleSng, onTogglePrepStock, onToggleWork,
    onDeleteWork, onOpenWorkDrawer, onRicaricaWork,
    onRemoveMix, onRemoveSng,
  } = props
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/pages/metodi/SchemaCalibrazione.lavagna.tsx src/renderer/pages/metodi/SchemaCalibrazione.tsx
git commit -m "feat(lavagna): aggiungi props callback per selezione e azioni CRM/Work"
```

---

## Task 2: Fix blocco analiti IS con filtro dest. uso

**Problema:** In `AnalitiNode` (riga 556–681) e `SidebarAnaliti` (riga 384–504), i `props.analiti` passati sono `analiti` (tutti) oppure `analitiAllFiltrati`? In `SchemaCalibrazione.tsx` riga 828, la prop `analiti` è `analiti` (non filtrata). Il vero bug è in `SchemaCalibrazione.tsx`: quando `filtroDestUso = 'taratura'`, la variabile `analiti` passata alla lavagna non include i CRM IS come "coperti" perché `buildAnalitiData` li ha filtrati.

**Fix:** Passare alla lavagna `analitiTuttiDestUso` — una variante di `analiti` calcolata includendo sempre i CRM IS indipendentemente da `filtroDestUso`.

**File:**
- Modify: `src/renderer/pages/metodi/SchemaCalibrazione.tsx` (sezione calcoli analiti, riga ~425–451)

- [ ] **Step 1: Leggi la sezione buildAnalitiData in SchemaCalibrazione.tsx**

Cerca la riga `buildAnalitiData` nel file per capire come viene chiamata con il filtro. Dovrebbe essere intorno alla riga 425.

- [ ] **Step 2: Aggiungi calcolo analiti con IS sempre visibili**

Nella sezione calcoli (dopo `analitiAllFiltrati`), aggiungi:

```typescript
// Analiti per la lavagna: stessa logica del filtro ma IS sempre inclusi
// (i CRM IS non vengono mai esclusi dal calcolo copertura analiti)
const analitiPerLavagna = useMemo(() => {
  // Includi sempre i CRM IS nei "crmItemsFiltrati" usati dalla lavagna
  const crmConIS = crmItemsFiltrati.some(c => c.isIS)
    ? crmItemsFiltrati
    : [...crmItemsFiltrati, ...crmItems.filter(c => c.isIS)]
  const { analiti: a } = buildAnalitiData(crmConIS, analitiRows, filtroDestUso, crmItems)
  return a
}, [crmItemsFiltrati, crmItems, analitiRows, filtroDestUso])
```

- [ ] **Step 3: Passa analitiPerLavagna a SchemaLavagna**

Nella prop `analiti` di `SchemaLavagna`, sostituisci `analiti` con `analitiPerLavagna`:

```tsx
<SchemaLavagna
  ...
  analiti={analitiPerLavagna}
  ...
/>
```

- [ ] **Step 4: Verifica manuale**

Avvia l'app, vai allo schema calibrazione, metti filtro dest. uso su "Taratura". Gli analiti IS devono apparire come coperti (badge M o S) e non come scoperti (badge —).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/pages/metodi/SchemaCalibrazione.tsx
git commit -m "fix(lavagna): analiti IS sempre visibili come coperti indipendentemente da filtro dest. uso"
```

---

## Task 3: Selezione CRM dalla lavagna (aggiorna selSrcs condiviso)

**File:**
- Modify: `src/renderer/pages/metodi/SchemaCalibrazione.lavagna.tsx`

- [ ] **Step 1: Aggiungi handleNodeClick con toggle selezione CRM**

In `SchemaLavagna`, sostituisci il `handleNodeClick` esistente (riga 1150–1153):

```typescript
const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
  const id = node.id
  // Selezione visiva (highlight connessioni)
  setSelectedId(prev => prev === id ? null : id)
  setHoveredAnalita(null)

  // Toggle selSrcs per CRM mix e sng (aggiorna lo stato condiviso nel parent)
  const m = moduli.find(x => x.id === id)
  if (!m) return

  if (m.kind === 'mix' && onToggleMix) {
    onToggleMix(m.mixId)
  } else if (m.kind === 'sng' && onToggleSng) {
    onToggleSng(m.id)
  }
  // I nodi Work non aggiornano selSrcs al click semplice
}, [moduli, onToggleMix, onToggleSng])
```

- [ ] **Step 2: Evidenzia card CRM selezionate**

Le card già hanno il flag `highlighted` che produce un outline. Ma `highlighted` ora serve per due scopi: hover analita E selezione in `selSrcs`. Aggiorna `highlightedIds` per includere anche i CRM in `selSrcs`:

In `SchemaLavagna`, dopo la riga che calcola `highlightedIds` (riga 1038–1051), aggiungi:

```typescript
// Merge: evidenzia anche i CRM selezionati in selSrcs
const highlightedIdsWithSel = useMemo(() => {
  const out = new Set(highlightedIds)
  for (const m of moduli) {
    if (m.kind === 'mix' && selSrcs.has(m.mixId)) out.add(m.id)
    if (m.kind === 'sng' && selSrcs.has(m.id)) out.add(m.id)
  }
  return out
}, [highlightedIds, moduli, selSrcs])
```

E usa `highlightedIdsWithSel` al posto di `highlightedIds` nei due `useEffect` che aggiornano `rfNodes`.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/pages/metodi/SchemaCalibrazione.lavagna.tsx
git commit -m "feat(lavagna): click su card CRM aggiorna selSrcs condiviso per Crea Work"
```

---

## Task 4: Pulsante × su card CRM (cancella dalla lavagna)

**File:**
- Modify: `src/renderer/pages/metodi/SchemaCalibrazione.lavagna.tsx`

- [ ] **Step 1: Aggiungi pulsante × su ModuloMixNode**

In `ModuloMixNode` (riga 730–808), aggiungi il pulsante × nell'header, passando `onRemoveMix` tramite `data`:

Prima aggiorna il tipo `MixNodeData`:

```typescript
type MixNodeData = {
  meta: Extract<ModuloMeta, { kind: 'mix' }>
  highlighted: boolean
  onRemoveMix?: (mixId: string) => void
}
```

Poi nell'header del nodo (dopo il badge "+N lotti"), aggiungi:

```typescript
{data.onRemoveMix && (
  <button
    onClick={(e) => { e.stopPropagation(); data.onRemoveMix!(meta.mixId) }}
    title="Rimuovi dalla lavagna"
    style={{
      width: 18, height: 18, borderRadius: '50%', border: 'none',
      background: C.con.bg, color: C.con.text, cursor: 'pointer',
      fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center',
      justifyContent: 'center', flexShrink: 0, padding: 0,
    }}
  >×</button>
)}
```

- [ ] **Step 2: Aggiorna tipo SngNodeData e aggiungi pulsante × su ModuloSngNode**

```typescript
type SngNodeData = {
  meta: Extract<ModuloMeta, { kind: 'sng' }>
  highlighted: boolean
  onRemoveSng?: (sngId: string) => void
}
```

Nell'header di `ModuloSngNode` (riga 829–839):

```typescript
{data.onRemoveSng && (
  <button
    onClick={(e) => { e.stopPropagation(); data.onRemoveSng!(meta.id) }}
    title="Rimuovi dalla lavagna"
    style={{
      width: 18, height: 18, borderRadius: '50%', border: 'none',
      background: C.con.bg, color: C.con.text, cursor: 'pointer',
      fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center',
      justifyContent: 'center', flexShrink: 0, padding: 0,
    }}
  >×</button>
)}
```

- [ ] **Step 3: Passa onRemoveMix/onRemoveSng nei data dei nodi strutturali**

In `structuralNodes` (riga ~1080–1101), aggiorna la costruzione dei nodi:

```typescript
if (m.kind === 'mix') {
  return { ...base, type: 'mix', data: {
    meta: m, highlighted: false,
    onRemoveMix,
  } as MixNodeData }
}
if (m.kind === 'sng') {
  return { ...base, type: 'sng', data: {
    meta: m, highlighted: false,
    onRemoveSng,
  } as SngNodeData }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/pages/metodi/SchemaCalibrazione.lavagna.tsx
git commit -m "feat(lavagna): pulsante × su card CRM per rimuovere dalla lavagna"
```

---

## Task 5: Azioni sui nodi Work (WorkDrawer, Ricarica, Cancella)

**File:**
- Modify: `src/renderer/pages/metodi/SchemaCalibrazione.lavagna.tsx`

- [ ] **Step 1: Aggiorna tipo WorkNodeData**

```typescript
type WorkNodeData = {
  meta: Extract<ModuloMeta, { kind: 'work' }>
  highlighted: boolean
  onOpenDrawer?: (work: WorkInSchema, colIdx: number) => void
  onRicarica?: (workId: number) => void
  onDelete?: (colIdx: number, workIdx: number) => void
}
```

- [ ] **Step 2: Aggiungi pulsanti azione nell'header di ModuloWorkNode**

In `ModuloWorkNode` (riga 907–927), nell'header dopo il nome, aggiungi una riga di azioni:

```typescript
<div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
  {w.dbId != null && data.onOpenDrawer && (
    <button
      onClick={(e) => { e.stopPropagation(); data.onOpenDrawer!(w, meta.colIdx) }}
      title="Apri dettaglio Work"
      style={{
        fontSize: 9.5, padding: '1px 6px', borderRadius: 3, border: `1px solid ${col.border}`,
        background: col.chip, color: col.text, cursor: 'pointer',
      }}
    >Dettaglio</button>
  )}
  {w.dbId != null && data.onRicarica && (
    <button
      onClick={(e) => { e.stopPropagation(); data.onRicarica!(w.dbId!) }}
      title="Ricarica lotti Work"
      style={{
        fontSize: 9.5, padding: '1px 6px', borderRadius: 3, border: `1px solid ${col.border}`,
        background: col.chip, color: col.text, cursor: 'pointer',
      }}
    >Ricarica</button>
  )}
  {data.onDelete && (
    <button
      onClick={(e) => { e.stopPropagation(); data.onDelete!(meta.colIdx, meta.rowIdx) }}
      title="Elimina Work"
      style={{
        fontSize: 9.5, padding: '1px 6px', borderRadius: 3, border: `1px solid ${C.con.border}`,
        background: C.con.bg, color: C.con.text, cursor: 'pointer',
      }}
    >×</button>
  )}
</div>
```

- [ ] **Step 3: Passa le callback nei data dei nodi Work in structuralNodes**

```typescript
return { ...base, type: 'work', data: {
  meta: m, highlighted: false,
  onOpenDrawer: onOpenWorkDrawer,
  onRicarica: onRicaricaWork,
  onDelete: onDeleteWork,
} as WorkNodeData }
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/pages/metodi/SchemaCalibrazione.lavagna.tsx
git commit -m "feat(lavagna): azioni Work — dettaglio drawer, ricarica, cancella"
```

---

## Task 6: Chip analiti con toggle collassa/espandi in ModuloMixNode e ModuloSngNode

**File:**
- Modify: `src/renderer/pages/metodi/SchemaCalibrazione.lavagna.tsx`

- [ ] **Step 1: Aggiungi stato expand a ModuloMixNode**

In `ModuloMixNode`, aggiungi stato locale e modifica la sezione chip:

```typescript
function ModuloMixNode({ data }: NodeProps<Node<MixNodeData>>) {
  const meta = data.meta
  const crm = meta.crm
  const [expanded, setExpanded] = useState(false)
  // ...existing code...
  const MAX_CHIP = 4
  const compVisible = expanded ? meta.comps : meta.comps.slice(0, MAX_CHIP)
  const rimanenti = meta.comps.length - MAX_CHIP
```

Sostituisci la sezione chip (riga 788–806):

```typescript
<div style={{ padding: '4px 12px 10px' }}>
  {compVisible.map(n => (
    <span key={n} style={{
      display: 'inline-block', fontSize: 9.5,
      padding: '1px 5px', margin: '1px 3px 1px 0',
      background: C.mix.chip, color: C.mix.text, borderRadius: 2,
      maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis',
      whiteSpace: 'nowrap', verticalAlign: 'bottom',
    }}>{n}</span>
  ))}
  {!expanded && rimanenti > 0 && (
    <button
      onClick={(e) => { e.stopPropagation(); setExpanded(true) }}
      style={{
        display: 'inline-block', fontSize: 9.5, padding: '1px 6px',
        margin: '1px 3px', background: 'transparent', border: `1px solid ${C.mix.border}`,
        borderRadius: 2, color: C.mix.text, cursor: 'pointer',
      }}
    >▼ +{rimanenti}</button>
  )}
  {expanded && meta.comps.length > MAX_CHIP && (
    <button
      onClick={(e) => { e.stopPropagation(); setExpanded(false) }}
      style={{
        display: 'block', marginTop: 4, fontSize: 9.5, padding: '1px 6px',
        background: 'transparent', border: `1px solid ${C.mix.border}`,
        borderRadius: 2, color: C.mix.text, cursor: 'pointer',
      }}
    >▲ Comprimi</button>
  )}
</div>
```

- [ ] **Step 2: Stesso pattern per ModuloSngNode (se ci sono analiti da mostrare)**

`ModuloSngNode` mostra le preparazioni NEAT, non i componenti. I componenti analita non sono nel `ModuloMeta` per i singoli. Il toggle serve solo per le preparazioni NEAT se ci sono molte prep. Aggiorna `ModuloSngNode`:

```typescript
function ModuloSngNode({ data }: NodeProps<Node<SngNodeData>>) {
  const meta = data.meta
  const crm = meta.crm
  const [prepExpanded, setPrepExpanded] = useState(false)
  const isNeat = (crm.forma || '').toLowerCase().includes('neat')
  // ...existing code...
  const MAX_PREP = 2
  const prepsVisible = prepExpanded ? meta.preps : meta.preps.slice(0, MAX_PREP)
  const prepRimanenti = meta.preps.length - MAX_PREP
```

Nel blocco `isNeat && preps.length > 0`, sostituisci le righe che mostrano le prep e il "+N altre preparazioni":

```typescript
{isNeat && meta.preps.length > 0 && (
  <div style={{
    margin: '4px 10px 10px', padding: '6px 8px',
    background: C.page.sur, borderRadius: 4, border: `1px dashed ${C.sng.border}`,
  }}>
    <div style={{
      fontSize: 8.5, letterSpacing: '0.12em', textTransform: 'uppercase',
      color: C.sng.text, fontWeight: 600, marginBottom: 4,
    }}>Prep. NEAT</div>
    {prepsVisible.map(p => {
      const pBadge = scadenzaBadge(p.scadenza)
      return (
        <div key={p.id} style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, color: C.page.t2, lineHeight: 1.5 }}>
          <span style={{ color: C.page.th }}>fl.</span> {p.flacone || '—'}
          {p.progressivo != null && <span> · #{p.progressivo}</span>}
          {p.concReale != null && <span> · {p.concReale} {p.unitaConc}</span>}
          {pBadge && <div style={{ color: pBadge.color, fontSize: 9.5 }}>{pBadge.label}</div>}
        </div>
      )
    })}
    {!prepExpanded && prepRimanenti > 0 && (
      <button
        onClick={(e) => { e.stopPropagation(); setPrepExpanded(true) }}
        style={{
          marginTop: 3, fontSize: 9.5, padding: '1px 6px',
          background: 'transparent', border: `1px solid ${C.sng.border}`,
          borderRadius: 2, color: C.sng.text, cursor: 'pointer',
        }}
      >▼ +{prepRimanenti} prep.</button>
    )}
    {prepExpanded && meta.preps.length > MAX_PREP && (
      <button
        onClick={(e) => { e.stopPropagation(); setPrepExpanded(false) }}
        style={{
          marginTop: 3, fontSize: 9.5, padding: '1px 6px',
          background: 'transparent', border: `1px solid ${C.sng.border}`,
          borderRadius: 2, color: C.sng.text, cursor: 'pointer',
        }}
      >▲ Comprimi</button>
    )}
  </div>
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/pages/metodi/SchemaCalibrazione.lavagna.tsx
git commit -m "feat(lavagna): chip analiti/prep con toggle collassa/espandi"
```

---

## Task 7: GroupNode React Flow per CRM con analiti in comune

**File:**
- Modify: `src/renderer/pages/metodi/SchemaCalibrazione.lavagna.tsx`

- [ ] **Step 1: Aggiungi funzione di clustering (union-find)**

Dopo la funzione `deriveModuli` (riga 158), aggiungi:

```typescript
// Calcola cluster di CRM (mix/sng) che condividono almeno un analita.
// Ritorna: Map<nodoId, clusterId> e Map<clusterId, { nodeIds, analitiCondivisi }>
function computeClusters(
  moduli: ModuloMeta[],
  analiti: AnalitoItem[],
): Map<string, { nodeIds: string[]; analitiCondivisi: string[] }> {
  // Mappa nodoId → analiti coperti
  const nodeAnaliti = new Map<string, Set<string>>()
  for (const m of moduli) {
    if (m.kind !== 'mix' && m.kind !== 'sng') continue
    const covered = new Set<string>()
    for (const a of analiti) {
      if (m.kind === 'mix' && m.mixIds.some(mid => a.mixIds.includes(mid))) covered.add(a.nome)
      if (m.kind === 'sng' && a.sngIds.includes(m.id)) covered.add(a.nome)
    }
    if (covered.size > 0) nodeAnaliti.set(m.id, covered)
  }

  // Union-Find
  const parent = new Map<string, string>()
  const find = (x: string): string => {
    if (!parent.has(x)) parent.set(x, x)
    if (parent.get(x) !== x) parent.set(x, find(parent.get(x)!))
    return parent.get(x)!
  }
  const union = (a: string, b: string) => { parent.set(find(a), find(b)) }

  const nodeIds = [...nodeAnaliti.keys()]
  for (let i = 0; i < nodeIds.length; i++) {
    for (let j = i + 1; j < nodeIds.length; j++) {
      const ai = nodeAnaliti.get(nodeIds[i])!
      const aj = nodeAnaliti.get(nodeIds[j])!
      for (const nome of ai) {
        if (aj.has(nome)) { union(nodeIds[i], nodeIds[j]); break }
      }
    }
  }

  // Raggruppa per root
  const groups = new Map<string, string[]>()
  for (const id of nodeIds) {
    const root = find(id)
    const arr = groups.get(root) || []
    arr.push(id)
    groups.set(root, arr)
  }

  // Filtra gruppi con 2+ nodi, calcola analiti condivisi tra tutti i membri
  const result = new Map<string, { nodeIds: string[]; analitiCondivisi: string[] }>()
  for (const [root, ids] of groups) {
    if (ids.length < 2) continue
    // Analiti coperti da almeno 2 nodi del gruppo
    const countMap = new Map<string, number>()
    for (const id of ids) {
      for (const nome of nodeAnaliti.get(id)!) {
        countMap.set(nome, (countMap.get(nome) || 0) + 1)
      }
    }
    const condivisi = [...countMap.entries()]
      .filter(([, cnt]) => cnt >= 2)
      .map(([nome]) => nome)
    result.set(root, { nodeIds: ids, analitiCondivisi: condivisi })
  }
  return result
}
```

- [ ] **Step 2: Aggiungi tipo GroupNode e componente visivo**

Prima della definizione di `nodeTypes` (riga 992–998), aggiungi:

```typescript
const GROUP_PADDING = 60 // padding generoso dentro il gruppo

type CrmGroupNodeData = { analitiCondivisi: string[] }

function CrmGroupNode({ data }: NodeProps<Node<CrmGroupNodeData>>) {
  const MAX_LABEL = 4
  const visible = data.analitiCondivisi.slice(0, MAX_LABEL)
  const resto = data.analitiCondivisi.length - MAX_LABEL
  return (
    <div style={{
      width: '100%', height: '100%',
      border: `1.5px dashed ${C.page.brd2}`,
      borderRadius: 10,
      background: 'rgba(245,245,243,0.55)',
      boxSizing: 'border-box',
      pointerEvents: 'none', // il gruppo non intercetta click — passano ai figli
    }}>
      <div style={{
        padding: '5px 10px',
        fontSize: 9,
        color: C.page.t2,
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 3,
        pointerEvents: 'none',
      }}>
        {visible.map(n => (
          <span key={n} style={{
            background: C.page.bg, border: `1px solid ${C.page.brd}`,
            borderRadius: 2, padding: '0 4px',
          }}>{n}</span>
        ))}
        {resto > 0 && <span style={{ color: C.page.th }}>+{resto}</span>}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Aggiungi 'group' a nodeTypes**

```typescript
const nodeTypes = {
  mix: ModuloMixNode,
  sng: ModuloSngNode,
  work: ModuloWorkNode,
  analiti: AnalitiNode,
  group: CrmGroupNode,
}
```

- [ ] **Step 4: Integra clustering in SchemaLavagna**

In `SchemaLavagna`, dopo il `useMemo` per `moduli`, aggiungi:

```typescript
const clusters = useMemo(
  () => computeClusters(moduli, analiti),
  [moduli, analiti],
)
```

- [ ] **Step 5: Calcola dimensioni GroupNode in base ai figli**

La dimensione del GroupNode deve essere abbondante rispetto alla somma delle card figlie. Aggiungi funzione helper:

```typescript
function groupDimensions(
  nodeIds: string[],
  moduli: ModuloMeta[],
  positions: Positions,
): { x: number; y: number; width: number; height: number } {
  const padding = GROUP_PADDING
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const id of nodeIds) {
    const pos = positions[id]
    if (!pos) continue
    const m = moduli.find(x => x.id === id)
    const w = m ? LAYOUT.MODULE_W[m.kind] : 260
    const h = m ? estimatedHeight(m) : 200
    minX = Math.min(minX, pos.x)
    minY = Math.min(minY, pos.y)
    maxX = Math.max(maxX, pos.x + w)
    maxY = Math.max(maxY, pos.y + h)
  }
  if (!isFinite(minX)) return { x: 0, y: 0, width: 400, height: 300 }
  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  }
}
```

- [ ] **Step 6: Genera nodi gruppo e imposta parentId sui figli**

In `structuralNodes` useMemo (riga ~1080), prima della costruzione dei nodi moduliNodes, genera i GroupNode e aggiorna i figli:

```typescript
// Mappa nodeId → clusterId per assegnare parentId
const nodeToCluster = new Map<string, string>()
const groupNodes: Node[] = []
let clusterIdx = 0
for (const [, cluster] of clusters) {
  const groupId = `GROUP-${clusterIdx++}`
  for (const id of cluster.nodeIds) nodeToCluster.set(id, groupId)
  const dims = groupDimensions(cluster.nodeIds, moduli, positions)
  groupNodes.push({
    id: groupId,
    type: 'group',
    position: { x: dims.x, y: dims.y },
    style: { width: dims.width, height: dims.height },
    draggable: false, // il gruppo si ridimensiona automaticamente
    selectable: false,
    data: { analitiCondivisi: cluster.analitiCondivisi } as CrmGroupNodeData,
    zIndex: -1, // sotto le card figlie
  })
}

const moduliNodes = moduli.map(m => {
  const p = positions[m.id] || { x: 0, y: 0 }
  const clusterId = nodeToCluster.get(m.id)
  // Se il nodo è in un gruppo: posizione relativa al gruppo
  let nodePos = p
  if (clusterId) {
    const groupNode = groupNodes.find(g => g.id === clusterId)
    if (groupNode) {
      nodePos = {
        x: p.x - groupNode.position.x,
        y: p.y - groupNode.position.y,
      }
    }
  }
  const base = {
    id: m.id,
    position: nodePos,
    draggable: true,
    selectable: true,
    ...(clusterId ? { parentId: clusterId, extent: 'parent' as const } : {}),
  }
  // ... rest of node construction unchanged
```

- [ ] **Step 7: Includi groupNodes nell'array finale**

```typescript
return [...groupNodes, analitiNode, ...moduliNodes]
```

- [ ] **Step 8: Aggiorna setPosition per convertire posizione relativa → assoluta al salvataggio**

In `handleNodesChange` (riga ~1138), quando viene salvata la posizione di un nodo figlio, converte in coordinate assolute:

```typescript
else if (ch.position) {
  // Se il nodo è in un gruppo, la posizione RF è relativa al padre.
  // Salviamo in assoluto per coerenza con computeInitialLayout.
  const m = moduli.find(x => x.id === ch.id)
  const clusterId = m ? nodeToCluster.get(m.id) : undefined
  const groupNode = clusterId ? rfNodes.find(n => n.id === clusterId) : undefined
  const absX = groupNode ? ch.position.x + groupNode.position.x : ch.position.x
  const absY = groupNode ? ch.position.y + groupNode.position.y : ch.position.y
  setPosition(ch.id, absX, absY)
}
```

**IMPORTANTE:** `nodeToCluster` deve essere un `useMemo` separato, definito prima di `structuralNodes`, a livello di `SchemaLavagna`, così è accessibile in `handleNodesChange`:

```typescript
const nodeToCluster = useMemo(() => {
  const map = new Map<string, string>()
  let idx = 0
  for (const [, cluster] of clusters) {
    const groupId = `GROUP-${idx++}`
    for (const id of cluster.nodeIds) map.set(id, groupId)
  }
  return map
}, [clusters])
```

Poi in `structuralNodes` usa questo `nodeToCluster` invece di ricrearlo inline.

- [ ] **Step 9: Commit**

```bash
git add src/renderer/pages/metodi/SchemaCalibrazione.lavagna.tsx
git commit -m "feat(lavagna): GroupNode React Flow per CRM con analiti in comune"
```

---

## Task 8: Verifica end-to-end

- [ ] **Step 1: Avvia l'app**

```bash
npm run dev
```

- [ ] **Step 2: Checklist verifica**

Apri un metodo con CRM, vai allo Schema Calibrazione → Lavagna:

1. **Fix IS**: Filtro dest. uso su "Taratura" → analiti IS appaiono coperti (badge M o S), non come "—"
2. **GroupNode**: Due o più CRM che coprono gli stessi analiti appaiono dentro un riquadro tratteggiato con etichetta analiti condivisi. Un CRM solitario non ha wrapper.
3. **Drag dentro gruppo**: Trascina una card CRM dentro il suo gruppo → rimane confinata dentro il bordo. Il bordo è abbondante rispetto alle card.
4. **Selezione**: Click su card Mix o Sng → si evidenzia con outline, il contatore "N sorgenti selezionate" nella bottom bar aumenta. Click di nuovo → deselezione. Il pulsante "Crea Work" nella bottom bar si attiva.
5. **Pulsante ×**: Click su × di una card Mix → la card sparisce dalla lavagna (mix aggiunto a removedMix).
6. **Work Dettaglio**: Click su "Dettaglio" su una card Work con dbId → si apre il WorkDrawer.
7. **Work Ricarica**: Click su "Ricarica" su una card Work con dbId → si apre il RicaricaDialog.
8. **Work Cancella**: Click su × di una card Work → la work viene rimossa.
9. **Toggle chip**: Card Mix con molti componenti → di default mostra max 4 chip, poi bottone "▼ +N". Click espande. Click "▲ Comprimi" riporta allo stato collassato.
10. **Posizioni persistono**: Drag di una card, ricarica la pagina → la posizione è mantenuta.

- [ ] **Step 3: Commit finale se tutto ok**

```bash
git add -A
git commit -m "feat(lavagna): raggruppamento CRM, fix IS, selezione, azioni Work — verifica completa"
```
