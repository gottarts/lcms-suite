# Fix: calcolo Work — diluizione per mix con concentrazioni eterogenee

## Contesto

Quando una mix CRM ha composti con concentrazioni **diverse internamente** (es. 0.99, 1.00, 1.01 mg/L), il sistema la tratta come omogenea e usa la modalità "concentrazione target". Ma una mix è un prodotto unico — non si possono separare i composti per portarli alla stessa concentrazione. L'unica operazione corretta è **diluire** la mix per un fattore (÷N).

**Bug visibile**: le concentrazioni nei COMPOSTI mostrano i valori originali del CRM invece di quelli diluiti.

## Catena del bug

1. `toggleMix` (SchemaCalibrazione.tsx:660) — prende `cv` dal primo composto, non controlla se i composti nella mix hanno concentrazioni diverse
2. `getConcInfo` (logic.ts:123) — vede `cv > 0` → ritorna `omogenea: true`
3. `calcolaVols` / `ModalCreaWork` — `hasVar = false` → usa modalità concentrazione (sbagliata)
4. `getCompsFromWork` (logic.ts:198) — `w.conc` null in customMode → `dilFactor = 1` → COMPOSTI con concentrazioni originali

## File da modificare

1. `src/renderer/pages/metodi/SchemaCalibrazione.tsx` — `toggleMix`
2. `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts` — `getConcInfo` + `getCompsFromWork`

## Step 1 — `toggleMix` in SchemaCalibrazione.tsx (righe 654-664)

Controllare se tutti i composti nella mix hanno la stessa concentrazione. Se no, segnalare `concVariabile: true`.

```typescript
// PRIMA (riga 658-660):
const crm = crmItems.find(c => c.mix_id === mixId)
m.set(mixId, { id: mixId, nome: crm?.mix ?? mixId, cv: crm?.cv ?? 0, tipo: 'mix' })

// DOPO:
const comps = crmItems.filter(c => c.mix_id === mixId)
const crm = comps[0]
const cvSet = new Set(comps.map(c => c.cv))
const eterogenea = cvSet.size > 1
m.set(mixId, {
    id: mixId,
    nome: crm?.mix ?? mixId,
    cv: crm?.cv ?? 0,
    tipo: 'mix',
    concVariabile: eterogenea,
})
```

Quando `cvSet.size > 1`, i composti hanno concentrazioni diverse → la mix è eterogenea → diluzione obbligatoria.

## Step 2 — `getConcInfo` in SchemaCalibrazione.logic.ts (righe 119-136)

Rispettare il flag `concVariabile` su SorgenteSel.

```typescript
// PRIMA (righe 123-125):
if (s.tipo === 'sng' || s.tipo === 'mix') {
    if (s.cv > 0) return { omogenea: true, cv: s.cv, label: `${s.cv} mg/L` }
    return { omogenea: false, cv: 0, label: 'variabile' }
}

// DOPO:
if (s.tipo === 'sng' || s.tipo === 'mix') {
    if (s.concVariabile) return { omogenea: false, cv: s.cv, label: 'variabile' }
    if (s.cv > 0) return { omogenea: true, cv: s.cv, label: `${s.cv} mg/L` }
    return { omogenea: false, cv: 0, label: 'variabile' }
}
```

Effetto a cascata (nessun altro codice da cambiare):
- `calcolaVols`: `hasVar = true` → modalità diluizione
- `ModalCreaWork`: label "Fattore diluizione (÷N)", placeholder "÷N", step "1"
- `concNominale = null`, `concVariabile = true`

## Step 3 — `getCompsFromWork` in SchemaCalibrazione.logic.ts (righe 196-198)

Usare i dati per-ingrediente da `w.vols[i]` quando `w.conc` è null. Questo fix è necessario sia per mix eterogenee (dilution mode) che per customMode con mix omogenee.

```typescript
// PRIMA (righe 196-198):
const result: CompostoInWork[] = []
for (const src of w.srcs) {
    const dilFactor = w.conc && src.cv ? w.conc / src.cv : 1

// DOPO:
const result: CompostoInWork[] = []
for (let i = 0; i < w.srcs.length; i++) {
    const src = w.srcs[i]
    const ing = w.vols[i]
    let dilFactor: number
    if (ing?.modo === 'dil' && ing.dilFactor) {
        dilFactor = 1 / ing.dilFactor   // ÷10 → conc finale = conc_sorgente × 0.1
    } else if (ing?.modo === 'conc' && ing.concTarget && src.cv) {
        dilFactor = ing.concTarget / src.cv
    } else if (w.conc && src.cv) {
        dilFactor = w.conc / src.cv     // fallback originale
    } else {
        dilFactor = 1
    }
```

Casi coperti:
- `modo='dil'`: `concFinale = concComposto / N` (es. ÷10 → × 0.1)
- `modo='conc'` + customMode: `concFinale = concComposto × (target / cvMix)`
- Fallback con `w.conc`: comportamento originale invariato

## Cosa NON cambia

- `calcolaVols` — funziona automaticamente via `getConcInfo` che ora rileva mix eterogenee
- `ModalCreaWork` — labels/placeholders si aggiornano automaticamente via `hasVar`
- `SorgenteSel` interface — ha già `concVariabile?: boolean` (opzionale)
- Tipi `Ingrediente`, `WorkInSchema` — invariati
- Schema DB — nessuna migrazione
- `salvaWorkNelDb` — già salva `modo_calcolo`, `dilFactor`, `concTarget`

## Scenari di test

| Scenario | Risultato atteso |
|----------|-----------------|
| Mix con composti tutti a 1.00 mg/L | `omogenea: true` → modalità concentrazione (invariato) |
| Mix con composti a 0.99, 1.00, 1.01 mg/L | `omogenea: false` → modalità diluizione (FIX) |
| Mix eterogenea, ÷10, vol 1 mL | Tutti i composti diluiti ÷10 nei COMPOSTI (FIX) |
| CustomMode + mix omogenee + target 0.4 | COMPOSTI mostrano ~0.4 mg/L, non originali (FIX) |
| Singolo CRM non-mix | `omogenea: true` → concentrazione (invariato) |

## Verifica

1. Aprire SchemaCalibrazione con mix che hanno composti a concentrazioni diverse (es. 25DILC190A)
2. Selezionare la mix → form deve mostrare "Fattore diluizione (÷N)" e "variabile" in italic
3. Inserire ÷2.5, vol 1 mL → volumi = 0.400 mL
4. Salvare → DrawerDettaglio → COMPOSTI devono mostrare concentrazioni diluite (non originali)
5. Verificare anche con mix omogenee: deve continuare a funzionare con concentrazione target
