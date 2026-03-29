# Piano: Selettore lotto CRM Mix nello Schema Calibrazione

## Context

Nella colonna CRM Mix di SchemaCalibrazione, ogni blocco mix mostra lotto e scadenza del primo `CrmItem` trovato per quel `mix_id`. Se esistono più lotti disponibili per lo stesso mix, non c'è modo di scegliere quale usare nello schema. La feature aggiunge un selettore lotto inline nel blocco mix, visibile solo quando ci sono più lotti distinti.

## Approccio: badge `<select>` nativo inline

Un solo file da modificare: `SchemaCalibrazione.grid.tsx`. Stato locale `mixLottoSel: Map<string, string>` (mix_id → lotto attivo) dentro `GrigliaAnalitiCrm`. Il selettore appare solo se i lotti disponibili per quel mix sono > 1. La scadenza visualizzata nel blocco si aggiorna in base al lotto selezionato.

## File da modificare

**Solo:** [src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx](src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx)

File di riferimento (sola lettura):
- [src/renderer/pages/metodi/SchemaCalibrazione.types.ts](src/renderer/pages/metodi/SchemaCalibrazione.types.ts) — tipo `CrmItem` con campi `lotto`, `mix_id`, `scadenza_prodotto`
- [src/renderer/pages/metodi/SchemaCalibrazione.tsx](src/renderer/pages/metodi/SchemaCalibrazione.tsx) — `toggleMix` non richiede modifiche

## Passi di implementazione

### 1. Stato locale `mixLottoSel`

Aggiungere in `GrigliaAnalitiCrm` (dopo gli altri `const` di stato):
```ts
const [mixLottoSel, setMixLottoSel] = useState<Map<string, string>>(new Map())
```

### 2. Mappa `mixLotti` (dopo la costruzione di `mixInfo`, riga ~68-72)

```ts
// mix_id → Map<lotto, CrmItem>  — un CrmItem rappresentativo per lotto distinto
const mixLotti = new Map<string, Map<string, CrmItem>>()
for (const c of crmItems) {
  if (!c.mix_id) continue
  const lottoMap = mixLotti.get(c.mix_id) ?? new Map<string, CrmItem>()
  const lottoKey = c.lotto ?? ''
  if (!lottoMap.has(lottoKey)) lottoMap.set(lottoKey, c)
  mixLotti.set(c.mix_id, lottoMap)
}
```

### 3. Derivare `info` dal lotto attivo nel blocco assoluto mix

Sostituire `const info = mixInfo.get(a.mixId)` con:
```ts
const lottiDisponibili = Array.from(mixLotti.get(a.mixId!)?.keys() ?? [])
const lottoAttivo = mixLottoSel.get(a.mixId!) ?? lottiDisponibili[0] ?? ''
const info = mixLotti.get(a.mixId!)?.get(lottoAttivo)
```

### 4. Selettore `<select>` condizionale

Aggiungere nel JSX del blocco mix, subito dopo la riga del lotto (riga ~448):
```tsx
{lottiDisponibili.length > 1 && !isRmMx && (
  <select
    value={lottoAttivo}
    onClick={e => e.stopPropagation()}
    onChange={e => {
      e.stopPropagation()
      setMixLottoSel(prev => new Map(prev).set(a.mixId!, e.target.value))
    }}
    style={{
      fontSize: 9, fontFamily: 'IBM Plex Mono',
      border: `1px solid ${C.mix.border}`, borderRadius: 3,
      background: 'transparent', color: C.mix.text,
      marginTop: 2, padding: '1px 2px', cursor: 'pointer'
    }}
  >
    {lottiDisponibili.map(l => (
      <option key={l} value={l}>{l || '(no lotto)'}</option>
    ))}
  </select>
)}
```

## Verifica

1. Aprire uno Schema Calibrazione che abbia un mix con 2+ lotti disponibili in DB Composti
2. Verificare che il selettore appaia nel blocco mix
3. Cambiare lotto → scadenza/rivalidazione si aggiorna
4. Mix con un solo lotto → nessun selettore (comportamento invariato)
5. Il selettore non triggerà `onToggleMix` (stopPropagation)
