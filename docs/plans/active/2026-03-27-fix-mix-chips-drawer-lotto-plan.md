# Piano: Uniformare visualizzazione nome + lotto MIX nelle chips e nei drawer

## Contesto

Alcune MIX mostrano solo il nome commerciale (quando `crm.mix` è popolato), altre mostrano solo un identificatore simile a un lotto (quando `crm.mix` è null e il fallback è `mix_id`). In nessun caso viene mostrato il campo `lotto` separato per le MIX.

L'obiettivo è mostrare **sempre** nome commerciale + lotto per le MIX, in modo uniforme in:
1. Chips (card MIX nella griglia di SchemaCalibrazione)
2. Drawer ChainNode (sezione tracciabilità in DrawerDettaglioWork di SchemaCalibrazione e WorkDrawer di WorkPage)

**Vincolo**: SchemaCalibrazione e WorkPage devono avere la stessa forma. I composti singoli non cambiano.

## Analisi dati disponibili

- **SchemaCalibrazione grid**: `info = CrmItem` (da `mixInfo.get(mixId)`) → `info.mix` (nome), `info.lotto` disponibili
- **Drawer SchemaCalibrazione**: `crmItems` in scope nel ChainNode (closure) → `crmItems.find(c => c.mix_id === src.id)?.lotto`
- **Drawer WorkDrawer**: `crmItems` in scope (buildCrmItems) → `.lotto = ing.source_lotto ?? null`

Il campo `lotto` è disponibile in entrambi i contesti.

## Cambiamenti

### 1. `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx` — MIX card (righe ~432-439)

Aggiungere visualizzazione lotto dopo la riga produttore:

```tsx
// dopo info?.produttore
{info?.lotto && (
  <div style={{ fontSize:9, color:C.page.t2, marginTop:1,
                fontFamily:'IBM Plex Mono, monospace' }}>
    {info.lotto}
  </div>
)}
```

### 2. `src/renderer/pages/metodi/SchemaCalibrazione.tsx` — ChainNode (righe ~415-434)

Per sorgenti di tipo `mix`, aggiungere riga lotto sotto `src.nome`:

```tsx
<div style={{ fontFamily:'IBM Plex Mono, monospace' }}>{src.nome}</div>
{src.tipo === 'mix' && (() => {
  const lotto = crmItems.find(c => c.mix_id === src.id)?.lotto
  return lotto
    ? <div style={{ fontSize:9, color:C.page.t2,
                    fontFamily:'IBM Plex Mono, monospace' }}>{lotto}</div>
    : null
})()}
<div style={{ fontSize:10, color:C.page.th }}>
  {/* cv info già presente */}
</div>
```

### 3. `src/renderer/pages/work/WorkDrawer.tsx` — ChainNode (righe ~297-314)

Identico al punto 2 (stessa struttura).

## File critici

- `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx` (riga ~432)
- `src/renderer/pages/metodi/SchemaCalibrazione.tsx` (riga ~415)
- `src/renderer/pages/work/WorkDrawer.tsx` (riga ~297)

## Verifica

- Aprire SchemaCalibrazione su un metodo con MIX → verificare che le card MIX mostrino nome commerciale + lotto
- Cliccare su una work che usa una MIX → nel drawer, sezione tracciabilità, il nodo MIX deve mostrare nome + lotto
- Fare lo stesso in WorkPage → drawer identico a SchemaCalibrazione
- I composti singoli restano invariati
