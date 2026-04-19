# Piano: Due modifiche SchemaCalibrazione

## Context
Due fix minori alla griglia dello SchemaCalibrazione:
1. Allargare le colonne della griglia (meno spazio vuoto a destra)
2. Mostrare avviso "SCADUTA" in rosso per le CRM scadute, sia mix che singole

---

## Modifica 1 — Larghezze colonne

**File:** [SchemaCalibrazione.grid.tsx](src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx)

Le colonne sono definite in due posti:

### Header (riga 267-269):
```
{ w:190, label:'Analiti', ... }
{ w:270, label:'CRM Mix', ... }
{ w:260, label:'Singoli / Neat', ... }
```
Totale attuale: 720px

### Placeholder cella analita (riga 316): `width:190`
### Placeholder mix (riga 343): `width:270`
### Cella singoli (riga 347): `width:260`
### Card mix assoluta (riga 531): `left:190, width:270`

**Cambiamenti proposti** (aumentare tutte le colonne proporzionalmente):
- Analiti: 190 → 210
- CRM Mix: 270 → 300  
- Singoli/Neat: 260 → 290
- Totale: 720 → 800px

Aggiornare anche:
- `LAYOUT.CHIP_AREA`: 236 → 266 (era 254px card − 18px padding → ora 282px − 18px)
- `left:190` nella card mix → `left:210`

---

## Modifica 2 — Avviso SCADUTA (testo rosso)

**File:** [SchemaCalibrazione.grid.tsx](src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx)

La data di oggi va calcolata una volta sola con `useMemo` all'inizio del componente `GrigliaAnalitiCrm`:
```js
const oggi = useMemo(() => new Date().toISOString().slice(0, 10), [])
```

### Card singoli non-Neat (riga 494-498):
```jsx
{crm.scadenza_prodotto && (
  <div style={{ fontSize:9, color: C.page.th, fontFamily:'IBM Plex Mono, monospace' }}>
    scad. {crm.scadenza_prodotto}
  </div>
)}
```
Diventa:
```jsx
{crm.scadenza_prodotto && (
  <div style={{ fontSize:9, color: crm.scadenza_prodotto < oggi ? '#dc2626' : C.page.th, fontFamily:'IBM Plex Mono, monospace' }}>
    scad. {crm.scadenza_prodotto}{crm.scadenza_prodotto < oggi ? '  ⚠ SCADUTA' : ''}
  </div>
)}
```

### Card mix (riga 617-620):
```jsx
<div style={{ fontSize:10, color:C.page.th, marginTop:2, fontFamily:'IBM Plex Mono, monospace' }}>
  {(mixCvSets.get(a.mixId)?.size ?? 0) <= 1 && info?.cv ? `${info.cv} mg/L` : ''}
  {info?.scadenza_prodotto ? ` · scad. ${info.scadenza_prodotto}` : ''}
</div>
```
Diventa (split in due righe separate):
```jsx
<div style={{ fontSize:10, color:C.page.th, marginTop:2, fontFamily:'IBM Plex Mono, monospace' }}>
  {(mixCvSets.get(a.mixId)?.size ?? 0) <= 1 && info?.cv ? `${info.cv} mg/L` : ''}
</div>
{info?.scadenza_prodotto && (
  <div style={{ fontSize:10, color: info.scadenza_prodotto < oggi ? '#dc2626' : C.page.th, marginTop:1, fontFamily:'IBM Plex Mono, monospace' }}>
    scad. {info.scadenza_prodotto}{info.scadenza_prodotto < oggi ? '  ⚠ SCADUTA' : ''}
  </div>
)}
```

---

## File da modificare
- [src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx](src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx)

## Verifica
1. Avviare l'app ed aprire lo Schema Calibrazione di un metodo
2. Verificare che la griglia sia più larga e le colonne più spaziose
3. Verificare che CRM con `scadenza_prodotto` passata mostri testo rosso "⚠ SCADUTA"
4. Verificare che CRM valide (scadenza futura) mostrino ancora grigio normale
5. Verificare che le CRM rivalidate mostrino ancora "Rivalidato · scad. est." in arancione
