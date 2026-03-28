# Piano — Fix DrawerDettaglioWork: volumi extra + catena inline

## Context

`DrawerDettaglioWork` in `SchemaCalibrazione.tsx` riusa il `WorkInSchema` prodotto da `ricostruisciWorkInSchema`, che filtra deliberatamente solo i sorgenti presenti nello schema corrente. Questo è corretto per il calcolo delle concentrazioni, ma causa tre problemi nella visualizzazione operativa:

1. **Tabella "Volumi di prelievo"** — mancano le righe dei sorgenti extra (non in schema). Il laboratorio fisicamente preleva anche quelli.
2. **`usedVol`** — sottostimato: non include i volumi dei sorgenti extra, quindi il solvente di completamento appare gonfiato e il totale prelievi è errato.
3. **Catena tracciabilità** — i nodi extra vengono appesi in coda fuori da `ChainNode` (livello top), invece di essere inseriti inline come figli della work, all'interno del componente ricorsivo.

Il fetch di `dbWork` via `workApi.get(work.dbId)` è già in place — tutti i dati necessari sono disponibili in `dbWork.ingredienti`.

---

## File modificato

- `src/renderer/pages/metodi/SchemaCalibrazione.tsx`

---

## Implementazione

### Step 1 — Calcola `extraVols` da `dbWork.ingredienti`

Subito dopo il blocco `extraComps` (dopo riga 423), aggiungere:

```typescript
// Righe extra per tabella volumi: sorgenti crm non in schema
// Deduplicazione: una riga per mix (source_mix_id), una per singolo (source_id)
const extraVols: Array<{ nome: string; vol: number; dilFactor?: number; concTarget?: number }> = []
if (dbWork?.ingredienti) {
  const seenExtraVol = new Set<string>()
  for (const ing of dbWork.ingredienti as any[]) {
    if (ing.source_type !== 'crm') continue
    if (crmIdSet.has(ing.source_id)) continue
    const key = ing.source_mix_id ? `mix:${ing.source_mix_id}` : `sng:${ing.source_id}`
    if (seenExtraVol.has(key)) continue
    seenExtraVol.add(key)
    extraVols.push({
      nome: ing.source_mix_nome ?? ing.source_nome ?? `ID ${ing.source_id}`,
      vol: ing.volume_prelievo_ml ?? 0,
      dilFactor: ing.fattore_diluizione ?? undefined,
      concTarget: ing.conc_target_mgL ?? undefined,
    })
  }
}
```

### Step 2 — Aggiorna `usedVol` (riga 391)

```typescript
// Prima:
const usedVol  = work.vols.reduce((a, v) => a + v.vol, 0)

// Dopo:
const schemaVolSum = work.vols.reduce((a, v) => a + v.vol, 0)
// extraVols calcolato dopo (spostare il blocco o usare variabile lazy):
// → spostare il calcolo di extraVols PRIMA di usedVol, oppure usare:
const usedVol = schemaVolSum + extraVols.reduce((a, v) => a + v.vol, 0)
```

Nota: `extraVols` dipende da `dbWork` che è stato calcolato prima. Poiché `crmIdSet` è già definito prima di `usedVol`, è sufficiente spostare il blocco `extraVols` prima della riga `usedVol`, oppure calcolare `usedVol` come somma lazy dopo `extraVols`. Riorganizzare nell'ordine: `crmIdSet` → `extraComps` → `extraVols` → `usedVol/solvVol/neg`.

### Step 3 — Righe ambra nella tabella volumi (dopo le righe schema)

Dopo il blocco `{work.vols.map(...)}` (riga 571), prima della riga solvente:

```tsx
{extraVols.map((v, i) => (
  <tr key={`xv-${i}`} style={{ background:'#fffbeb' }}>
    <td style={{ padding:'4px 6px', fontFamily:'IBM Plex Mono, monospace',
                 fontSize:11, borderBottom:'1px solid #fde68a', color:'#92400e' }}>
      ⚠ {v.nome}
    </td>
    <td style={{ padding:'4px 6px', fontFamily:'IBM Plex Mono, monospace',
                 fontSize:11, borderBottom:'1px solid #fde68a', color:'#92400e' }}>
      {v.dilFactor ? `÷${v.dilFactor}` : (v.concTarget ? `${v.concTarget} mg/L` : '—')}
    </td>
    <td style={{ padding:'4px 6px', fontFamily:'IBM Plex Mono, monospace',
                 fontSize:11, fontWeight:700, borderBottom:'1px solid #fde68a', color:'#92400e' }}>
      {v.vol.toFixed(3)}
    </td>
  </tr>
))}
```

### Step 4 — Catena tracciabilità: extra inline in `ChainNode`

**Modificare `ChainNode`** per rendere anche `w.extraSrcs` inline dopo i figli schema:

```tsx
{(w.extraSrcs ?? []).map(s => (
  <div key={`xs-${s.id}`}>
    <div style={{ width:1, height:10, background:C.page.brd, marginLeft: depth * 16 + 3 }} />
    <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:11,
                  paddingLeft:(depth + 1) * 16 }}>
      <div style={{ width:8, height:8, borderRadius:2, flexShrink:0, background:'#f59e0b' }} />
      <div>
        <div style={{ fontFamily:'IBM Plex Mono, monospace', color:'#92400e' }}>⚠ {s.nome}</div>
        <div style={{ fontSize:9, color:'#b45309' }}>fuori schema</div>
      </div>
    </div>
  </div>
))}
```

**Rimuovere** il blocco esterno (righe 631–643) che appendeva gli extra dopo `<ChainNode>`:

```tsx
// RIMUOVERE:
{(work.extraSrcs ?? []).map(s => (
  ...
))}
```

---

## Verifica

1. Aprire SchemaCalibrazione con un metodo che ha work importate con Mix/CRM non presenti nello schema corrente.
2. Aprire il drawer di una work con `extraSrcs`.
3. Controllare:
   - **Tabella volumi**: le righe amber appaiono con volume corretto; il "Totale prelievi" include anche quei volumi; "Solvente (completamento)" è ridotto di conseguenza.
   - **Catena tracciabilità**: i nodi extra (⚠ nome) appaiono come figli indentati della work, non appesi in coda.
4. Verificare che work senza extra sorgenti si comportino esattamente come prima.
