# Piano: Link DB Composti dalla colonna Analiti dello Schema Calibrazione

## Context

Nella griglia dello Schema Calibrazione, la colonna "Analiti" mostra le card dei singoli analiti ma non ha un link diretto al DB Composti. L'utente vuole poter cliccare (o avere un pulsante ↗) sulla card di ogni analita per aprire CompostiPage pre-filtrata per quell'analita, con la logica:
- Se l'analita ha CRM attivi (non dismessi) → apri CompostiPage senza `mostraDismessi`
- Se l'analita ha solo CRM dismessi o nessun CRM → apri CompostiPage con `mostraDismessi: true`

Il meccanismo di navigazione con `location.state` esiste già e funziona:
```typescript
navigate('/composti', { state: { searchFilter: nome, mostraDismessi: true } })
```

## Analisi dello stato attuale

**`AnalitoItem`** (SchemaCalibrazione.types.ts:60) ha:
- `nome`, `mixId`, `sngIds`, `isCon`, `isIS`
- Non ha info sui CRM dismessi: la logica in `useSchemaData` (logic.ts:38-44) filtra via i dismessi prima di costruire `AnalitoItem`

**`senzaCrm`** (grid.tsx:~116) = `!a.mixId && a.sngIds.length === 0` — indica analiti senza CRM *attivi* disponibili. Questo è il proxy che ci serve: se un analita è `senzaCrm`, probabilmente ha solo CRM dismessi (o nessuno), quindi apriamo con `mostraDismessi: true`.

**Comportamento atteso:**
- `senzaCrm === false` → analita ha CRM attivi → `navigate('/composti', { state: { searchFilter: a.nome } })`
- `senzaCrm === true` → nessun CRM attivo → `navigate('/composti', { state: { searchFilter: a.nome, mostraDismessi: true } })`

> Nota: non distinguiamo "solo dismessi" da "nessun CRM in assoluto" perché i dismessi sono già filtrati via in logic.ts. Quindi `senzaCrm` cattura entrambi i casi con la logica corretta (se non c'è nulla di attivo, è utile mostrare i dismessi).

## File da modificare

- **`src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx`** — unico file da toccare

## Implementazione

### Modifica in `GrigliaAnalitiCrm`

**1. Aggiornare `goToComposto`** per accettare il flag `mostraDismessi`:

```typescript
const goToComposto = (nome: string, mostraDismessi: boolean) => {
  onClose()
  navigate('/composti', { state: { searchFilter: nome, mostraDismessi } })
}
```

**2. Aggiungere pulsante ↗ nella cella Analita**, affiancato al testo. Il `senzaCrm` è già calcolato per ogni riga nel ciclo (riga 234).

```tsx
<div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:4 }}>
  <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', minWidth:0 }}>
    {a.nome}{a.isIS ? ' [IS]' : ''}{senzaCrm ? ' ·' : ''}
  </span>
  <button
    onClick={e => { e.stopPropagation(); goToComposto(a.nome, senzaCrm) }}
    title="Apri nel DB Composti"
    style={{ flexShrink:0, background:'none', border:'none', cursor:'pointer',
             padding:'0 1px', fontSize:10, opacity:0.55, color:'inherit', lineHeight:1 }}
  >↗</button>
</div>
```

**3. Chiamate esistenti** a `goToComposto` (da CRM singoli e mix) aggiornate con `false` come secondo argomento.

## Verifica

1. Build del progetto
2. Aprire Schema Calibrazione con analiti con CRM attivi → cliccare ↗ → DB Composti con ricerca preimpostata, no dismessi
3. Analiti senza CRM attivi → cliccare ↗ → DB Composti con `mostraDismessi: true`
4. Verificare che click ↗ non trigger altre interazioni della card
