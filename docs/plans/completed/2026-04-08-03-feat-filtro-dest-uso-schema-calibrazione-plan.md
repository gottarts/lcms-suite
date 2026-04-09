# Piano: Filtro Destinazione d'Uso nello Schema di Calibrazione

## Context

Nello schema di calibrazione, gli analiti target (Taratura, QC) e gli Internal Standard (IS) appaiono mescolati nella stessa griglia, creando confusione. Ogni CRM nel database ha un campo `destinazione_uso` che specifica "Taratura", "Controllo qualità", "Taratura+Controllo qualità" o "Standard Interno". Obiettivo: aggiungere un selettore nella toolbar dello schema che filtra quali CRM e analiti sono visibili, mostrando solo quelli coerenti con la destinazione scelta. Questo consente anche di vedere solo i lotti IS quando si lavora sullo schema IS.

## Approccio

Aggiungere uno **stato locale `filtroDestUso`** in `SchemaCalibrazione.tsx` con tre modalità:
- `"taratura"` → mostra CRM con `destinazione_uso IN ('Taratura', 'Taratura+Controllo qualità')`
- `"qc"` → mostra CRM con `destinazione_uso IN ('Controllo qualità', 'Taratura+Controllo qualità')`
- `"is"` → mostra CRM con `destinazione_uso` = 'Standard Interno'

Il filtro agisce **dopo** il fetch dei dati, nel layer di `buildAnalitiData` o nel componente, escludendo i CRM non corrispondenti prima di costruire l'array `AnalitoItem[]`. Gli analiti senza CRM disponibili per la modalità corrente vengono nascosti o marcati come "non disponibili".

## File Critici da Modificare

1. **`src/renderer/pages/metodi/SchemaCalibrazione.types.ts`**
   - Aggiungere il tipo `DestUso = 'taratura' | 'qc' | 'is'` (o string union)
   - Aggiungere `destinazione_uso?: string` a `CrmItem` (oggi il campo viene consumato solo per calcolare `isIS` e poi scartato)

2. **`src/renderer/pages/metodi/SchemaCalibrazione.logic.ts`**
   - In `buildAnalitiData` (linee ~100-200): esporre `destinazione_uso` su `CrmItem` invece di scartarlo dopo il calcolo `isIS`
   - Aggiungere parametro opzionale `filtroDestUso?: string` a `buildAnalitiData`; usarlo per filtrare i CRM prima di costruire la mappa analiti

3. **`src/renderer/pages/metodi/SchemaCalibrazione.tsx`**
   - Aggiungere state: `const [filtroDestUso, setFiltroDestUso] = useState<string>('taratura')`
   - Passare `filtroDestUso` a `buildAnalitiData` ogni volta che viene chiamato (o al `useMemo`/`useEffect` che lo chiama)
   - Aggiungere nella **bottom bar** (linee ~1204-1249) un selettore UI (ToggleButtonGroup o ButtonGroup di MUI) con le tre opzioni: "Taratura", "QC", "IS"

## Logica di Filtro

```typescript
// In buildAnalitiData, prima di costruire i CrmItem:
function matchesFiltro(destinazione_uso: string | null, filtro: string): boolean {
  const d = (destinazione_uso ?? '').toLowerCase()
  if (filtro === 'taratura') return d.includes('taratura')
  if (filtro === 'qc') return d.includes('controllo') || d.includes('taratura')
  if (filtro === 'is') return d.includes('intern') || d.includes(' is')
  return true // nessun filtro
}
```

I CRM che non passano il filtro vengono esclusi prima di popolare mixIds/sngIds degli AnalitoItem. Gli analiti che risultano senza CRM dopo il filtro vengono comunque mostrati ma con indicazione "nessun CRM disponibile" (comportamento già esistente per analiti senza CRM).

## Posizione UI del Selettore

Bottom bar di SchemaCalibrazione.tsx, a sinistra di `[Ricomincia zero]`, come label + ButtonGroup:

```
[ Taratura ]  [ QC ]  [ IS ]   |  [Ricomincia zero]  [Sel. automatica]  N sorgenti | + Crea
```

Colori suggeriti: usare la palette esistente (`C.mix`, `C.sng`, `C.inter`) per dare identità visiva alle tre modalità.

## Considerazioni

- `filtroDestUso` non viene salvato nel `schema_json` persistente: è una vista locale, lo schema sottostante rimane unico.
- **Il filtro agisce SOLO sui CRM (lotti sorgente)**, non sulle colonne Work. Le Work create (intermedie e finali) rimangono sempre tutte visibili perché possono essere usate come sorgenti in qualsiasi modalità.
- Se un utente ha già selezionato CRM in modalità "Taratura" e passa a "IS", i work già creati rimangono visibili e usabili: solo la lista CRM disponibili cambia.
- Il valore default sarà `'taratura'` (la modalità più comune).
- Tecnicamente: `buildAnalitiData` filtra i `CrmItem` per `destinazione_uso` prima di costruire `mixIds`/`sngIds`; i `WorkInSchema` (colonne work) non sono toccati dal filtro.

## Verifica

1. Aprire uno schema con analiti e IS presenti
2. Selezionare "Taratura" → verificare che i CRM IS non compaiano
3. Selezionare "IS" → verificare che solo IS appaiano con i loro lotti
4. Selezionare "QC" → verificare che i lotti QC e Taratura+QC siano visibili
5. Creare un work in modalità "IS" → verificare che usi solo CRM IS come sorgenti
