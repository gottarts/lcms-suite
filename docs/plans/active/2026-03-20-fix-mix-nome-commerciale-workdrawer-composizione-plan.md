# Piano: Fix Mix nome commerciale + Composizione WorkDrawer

## Context

Due problemi distinti di visualizzazione:

1. **SchemaCalibrazione** — le Mix nelle card Work e nella catena di tracciabilità mostrano il `mix_id` (es. "M001") invece del nome commerciale (es. "Mix Pesticidi"). Questo perché in `toggleMix` il campo `nome` viene impostato su `mixId` invece che su `crm?.mix`.

2. **WorkPage/WorkDrawer** — la sezione "Sorgenti" mostra una lista piatta di ingredienti con info tecniche (prelievo, target, diluizione). L'utente vuole sostituirla con la "Composizione" (composto + concentrazione + filtro), esattamente come il pannello "Composti" nel drawer di SchemaCalibrazione. Questo elimina l'incoerenza grafica.

## Modifiche

### 1. Fix mix_id → nome commerciale in SchemaCalibrazione.tsx

**File:** `src/renderer/pages/metodi/SchemaCalibrazione.tsx`

**Riga 656** — nella funzione `toggleMix`, cambiare il `nome` usato nella `SorgenteSel`:

```ts
// PRIMA:
m.set(mixId, { id: mixId, nome: mixId, cv: crm?.cv ?? 0, tipo: 'mix' })

// DOPO:
m.set(mixId, { id: mixId, nome: crm?.mix ?? mixId, cv: crm?.cv ?? 0, tipo: 'mix' })
```

Questo fa sì che:
- Le chips sorgenti nella card Work mostrino il nome commerciale (es. "Mix Pesticidi")
- La tabella volumi mini mostri il nome commerciale
- La catena di tracciabilità mostri il nome commerciale nei nodi CRM foglia
- `srcPath` nella lista composti mostri il nome commerciale

### 2. Sostituire "Sorgenti" con "Composizione" in WorkDrawer.tsx

**File:** `src/renderer/pages/work/WorkDrawer.tsx`

Sostituire l'intera sezione "Ingredienti / Sorgenti" (righe 277-299) con una sezione "Composizione" che mostra composto + concentrazione + filtro, simile alla lista composti del drawer di SchemaCalibrazione.

Il WorkDrawer già carica `work.ingredienti` dal DB (via `work:get`). Ogni ingrediente ha:
- `source_nome`: nome del composto/work sorgente (JOIN in work.ipc.ts)
- `conc_target_mgL`: concentrazione target
- `modo_calcolo`: 'conc' o 'dil'
- `fattore_diluizione`: fattore di diluizione

**Nuovo rendering (in stile Shadcn, armonizzato con il resto di WorkDrawer):**

```tsx
{/* Composizione */}
{work.ingredienti && work.ingredienti.length > 0 && (
  <>
    <Separator />
    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
      Composizione ({work.ingredienti.length})
    </div>
    <div className="space-y-1">
      {work.ingredienti.map((ing: any, i: number) => (
        <div key={i} className="flex justify-between items-center py-1 border-b last:border-0 text-sm">
          <div>
            <span className="font-medium">{ing.source_nome ?? `ID ${ing.source_id}`}</span>
            {ing.modo_calcolo && (
              <span className="text-xs text-muted-foreground ml-1">
                ({ing.source_type === 'crm' ? 'CRM' : 'Work'})
              </span>
            )}
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            {ing.conc_target_mgL != null
              ? `${ing.conc_target_mgL} mg/L`
              : ing.fattore_diluizione != null
                ? `÷${ing.fattore_diluizione}`
                : '—'}
          </span>
        </div>
      ))}
    </div>
  </>
)}
```

**Nota:** Non aggiungere filtro testuale come in SchemaCalibrazione (la lista è già compatta e il WorkDrawer ha un design diverso basato su Shadcn). L'armonizzazione qui è di stile e contenuto informativo, non di copia identica del componente.

## File da modificare

- `src/renderer/pages/metodi/SchemaCalibrazione.tsx` — riga 656 (fix nome mix)
- `src/renderer/pages/work/WorkDrawer.tsx` — righe 277-299 (sostituisci sezione sorgenti)

## Verifica

1. Aprire SchemaCalibrazione su un metodo con Mix → le card Work mostrano il nome commerciale del mix nelle chips e nella tabella volumi
2. Aprire il drawer dettaglio di una Work con sorgente Mix → la catena tracciabilità mostra il nome commerciale nel nodo foglia
3. Aprire WorkPage → cliccare su una Work → il pannello laterale mostra "Composizione" con composto + concentrazione/diluizione (non "Sorgenti" con prelievi)
