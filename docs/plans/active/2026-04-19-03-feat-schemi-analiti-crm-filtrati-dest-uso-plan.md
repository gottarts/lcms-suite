# Piano: Miglioramenti Metodi → Schemi (analiti filtrati per dest. uso + selezione automatica)

## Context
In Metodi → Schemi, gli analiti che non hanno CRM disponibile per la destinazione d'uso selezionata (es. Taratura) vengono resi visualmente "disabilitati" (opacity 0.4, bordo tratteggiato, colore muto) — lo stesso stile usato per analiti senza nessun CRM nel DB. Questo è fuorviante: il CRM esiste ma è filtrato. L'utente vuole:
1. Distinguere visivamente "filtrato per dest. uso" da "nessun CRM"
2. Aggiungere un link diretto al cambio filtro dest. uso sulla cella analita
3. Rinominare il dialog "Selezione automatica" → "Selezione automatica e riepilogo"
4. Aggiungere nel dialog AutoSelect un link a DB Composti con filtro nome analita

---

## File critici

- [SchemaCalibrazione.logic.ts](src/renderer/pages/metodi/SchemaCalibrazione.logic.ts) — `buildAnalitiData()` (linee 100-144), struttura `AnalitoItem`
- [SchemaCalibrazione.types.ts](src/renderer/pages/metodi/SchemaCalibrazione.types.ts) — interfaccia `AnalitoItem`, palette `C`
- [SchemaCalibrazione.grid.tsx](src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx) — rendering cella analita (linee 300-341)
- [SchemaCalibrazione.tsx](src/renderer/pages/metodi/SchemaCalibrazione.tsx) — filtro dest. uso (linee 407-436, 854-874), bottone "Selezione automatica" (linea 880)
- [AutoSelectDialog.tsx](src/renderer/pages/metodi/AutoSelectDialog.tsx) — dialog selezione automatica, titolo (linea 128)

---

## Implementazione

### 1. Distinguere analiti "filtrati per dest. uso" da "senza CRM"

**Problema:** `buildAnalitiData()` riceve solo i CRM già filtrati → non sa se l'analita ha CRM in altri filtri.

**Soluzione:** Passare anche i `crmItemsTotali` (tutti i CRM, pre-filtro dest. uso) a `buildAnalitiData()` e aggiungere un campo `crmFiltrati: boolean` in `AnalitoItem`.

**Passi:**

a) **`SchemaCalibrazione.types.ts`** — aggiungere campo a `AnalitoItem`:
```typescript
crmFiltrati?: boolean  // true = ha CRM ma non per questa dest. uso
```

b) **`SchemaCalibrazione.logic.ts`** — in `buildAnalitiData()`, ricevere opzionalmente `itemsTotali` e calcolare `crmFiltrati`:
```typescript
// Dopo aver calcolato senzaCrm per l'analita filtrato:
// se senzaCrm ma l'analita appare in itemsTotali (non filtrati) → crmFiltrati = true
const analitiCalc = analitiRows.map(row => {
  const nome = row.nome.toUpperCase()
  const mixId = mixMap.get(nome)?.[0] ?? null
  const sngIds = sngMap.get(nome) ?? []
  const senzaCrm = !mixId && sngIds.length === 0
  const crmFiltrati = senzaCrm && itemsTotali
    ? (mixMapTotali.has(nome) || sngMapTotali.has(nome))
    : false
  return { nome: row.nome, mixId, mixIds: ..., sngIds, isCon: ..., isIS: ..., crmFiltrati }
})
```

c) **`SchemaCalibrazione.tsx`** — nel `useMemo` che chiama `buildAnalitiData`, passare `crmItems` come `itemsTotali`:
```typescript
buildAnalitiData(filtered, analitiRows, filtroDestUso, crmItems /* totali */)
```

d) **`SchemaCalibrazione.grid.tsx`** — modificare lo stile della cella analita per `crmFiltrati`:
- Se `crmFiltrati`: stile normale (come analita con CRM), senza opacity/bordo tratteggiato
- Aggiungere badge/chip colorato con il colore del filtro dest. uso attivo (passato come prop)
- Il badge è cliccabile e chiama `onChangeFiltroDestUso` (callback passata alla griglia)

```tsx
// Nella cella analita:
const isSenzaVero = senzaCrm && !a.crmFiltrati
// Stile solo se senzaVero
style={{
  opacity: isSenzaVero ? 0.4 : (a.isIS ? 0.68 : 1),
  border: `1px ${isSenzaVero ? 'dashed' : ...} ...`,
  ...
}}
// Badge filtrato (se a.crmFiltrati):
{a.crmFiltrati && (
  <button onClick={() => onChangeFiltroDestUso?.(/* altra destinazione */)}
    title="CRM disponibile in altra destinazione d'uso — clicca per cambiare filtro"
    style={{ background: coloreDestUsoAlt, ... }}>
    dest-label
  </button>
)}
```

**Raggruppamento:** Gli analiti con `crmFiltrati=true` rimangono nella sezione `senzaCrm` (fondo lista) ma con stile distinto. Aggiungere separatore visivo tra "senza CRM veri" e "CRM filtrati" nella griglia.

**Nota implementativa:** Il badge deve mostrare *quale* filtro contiene il CRM. Serve calcolare per ogni analita `crmFiltrati` in quale/i destinazioni ha CRM — aggiungere campo `destUsoCrm?: DestUso[]` in `AnalitoItem`. Questo richiede un secondo giro su `itemsTotali` non filtrati.

---

### 2. Rinominare bottone "Selezione automatica"

**`SchemaCalibrazione.tsx` linea 880:**
```typescript
// da:
'Selezione automatica'
// a:
'Selezione automatica e riepilogo'
```

**`AutoSelectDialog.tsx` linea 128:**
```typescript
// da:
'Selezione automatica CRM'
// a:
'Selezione automatica e riepilogo'
```

---

### 3. Link DB Composti nel dialog AutoSelectDialog

**Su tutti gli analiti del dialog** (mix selezionati, singoli selezionati, non coperti): ogni chip/nome analita è cliccabile per aprire DB Composti filtrato per quel nome. Non aggiungere icona `↗` visibile — il link si evidenzia solo all'hover (cursore `pointer`, background leggero o underline).

Aggiungere prop `onGoToComposto?: (nome: string) => void` a `AutoSelectDialogProps`.

In `SchemaCalibrazione.tsx`, passare la funzione `goToComposto`:
```tsx
<AutoSelectDialog
  ...
  onGoToComposto={(nome) => { setDialogs(d => ({ ...d, autoSelect: false })); goToComposto(nome, false) }}
/>
```

Stile hover sui chip analita:
```tsx
// chip analita (es. nella sezione Mix selezionati):
<span
  onClick={() => onGoToComposto?.(nomeAnalita)}
  style={{ cursor: onGoToComposto ? 'pointer' : 'default', ... }}
  onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
  onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
>
  {nomeAnalita}
</span>
```

Applicare lo stesso pattern a: chip analiti nei mix selezionati, chip analiti nei singoli selezionati, nomi nella sezione non coperti.

---

## Dettaglio modifiche per file

| File | Righe interessate | Tipo modifica |
|------|-------------------|---------------|
| `SchemaCalibrazione.types.ts` | `AnalitoItem` interface | Aggiungere `crmFiltrati?: boolean`, `destUsoCrm?: DestUso[]` |
| `SchemaCalibrazione.logic.ts` | `buildAnalitiData()` | Riceve `itemsTotali?`, calcola `crmFiltrati` e `destUsoCrm` |
| `SchemaCalibrazione.tsx` | linea 434, 880 | Passa `crmItems` come totali; rinomina bottone |
| `SchemaCalibrazione.grid.tsx` | linee 316-340 | Stile distinto per `crmFiltrati`; badge cliccabile; prop `filtroDestUso` + `onChangeFiltroDestUso` |
| `AutoSelectDialog.tsx` | linee 128, props | Rinomina titolo; aggiunge prop `onGoToComposto` + bottoni ↗ |

---

## Verifiche

1. Cambiare filtro da Taratura → QC e verificare che gli analiti con CRM solo per QC diventino attivi
2. Verificare che analiti senza CRM in nessuna dest. uso restino con stile disabilitato (opacity 0.4)
3. Cliccare badge colorato su analita "filtrato" → verifica cambio filtro dest. uso
4. Aprire dialog "Selezione automatica e riepilogo" → verifica titolo aggiornato
5. Cliccare ↗ su analita non coperto nel dialog → verifica navigazione a DB Composti con filtro nome
