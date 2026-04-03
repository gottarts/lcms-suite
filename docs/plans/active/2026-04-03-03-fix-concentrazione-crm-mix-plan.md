# Piano: Fix concentrazione per-componente nel nuovo lotto CRM mix

## Context

Quando si crea un nuovo lotto per un CRM mix, la funzione `handleNewLotto` copia la concentrazione di **un solo analita** (quello su cui è stato cliccato) e la mette come valore comune per tutti i componenti. Ogni analita in un CRM mix ha però la propria concentrazione, quindi tutti i nuovi componenti vengono salvati con la concentrazione sbagliata.

**Flusso attuale errato:**
1. `handleNewLotto` prende `composto.concentrazione` (del singolo analita cliccato)
2. La mette in `mixTemplate.concentrazione` (valore unico)
3. Il form la usa come campo condiviso per tutti
4. Il backend salva la stessa concentrazione per ogni componente

**Flusso corretto:**
1. `handleNewLotto` carica tutti i componenti del mix (già lo fa per `_nomi`)
2. Passa anche `_concentrazioni: componenti.map(c => c.concentrazione)` nel template
3. Il form costruisce `componentiImportati` con `concentrazione` per-componente
4. Il backend usa la concentrazione per-componente (con fallback al valore comune)

---

## File critici da modificare

- **`src/renderer/pages/composti/CompostiPage.tsx`** — `handleNewLotto` (righe 799–823)
- **`src/renderer/pages/composti/MixPesticidiForm.tsx`** — interfaccia `ComponenteImportato`, props `mixTemplate`, `useEffect` di inizializzazione (righe 22–29, 35–56, 131–160)
- **`src/main/ipc/composti.ipc.ts`** — override per-componente nel loop insert (righe 558–589)

---

## Modifiche dettagliate

### 1. `CompostiPage.tsx` — `handleNewLotto`

Aggiungere `_concentrazioni` al template passando la concentrazione di ogni componente:

```typescript
_nomi:           componenti.map((c: any) => c.nome),
_concentrazioni: componenti.map((c: any) => c.concentrazione ?? null),  // <-- aggiunta
```

Rimuovere (o azzerare) `concentrazione` dal template per non pre-compilare un valore unico sbagliato:

```typescript
concentrazione: '',  // non copiare da un singolo componente
```

### 2. `MixPesticidiForm.tsx` — interfaccia `ComponenteImportato`

Aggiungere campo `concentrazione`:

```typescript
interface ComponenteImportato {
  nome: string
  forma_commerciale?: string | null
  lotto?: string | null
  scadenza_prodotto?: string | null
  data_apertura?: string | null
  produttore?: string | null
  concentrazione?: number | null  // <-- aggiunta
}
```

### 3. `MixPesticidiForm.tsx` — props `mixTemplate`

Aggiungere `_concentrazioni` alle props:

```typescript
mixTemplate?: {
  ...
  _nomi: string[]
  _concentrazioni: (number | null)[]  // <-- aggiunta
  _metodi_ids: string[]
} | null
```

### 4. `MixPesticidiForm.tsx` — `useEffect` inizializzazione

Quando `mixTemplate` è presente, costruire `componentiImportati` con le concentrazioni per-componente:

```typescript
if (mixTemplate) {
  setForm({ .../* come ora */, concentrazione: '' })
  setNomi(mixTemplate._nomi)
  // Costruisce componentiImportati con concentrazione per-componente
  if (mixTemplate._concentrazioni?.length > 0) {
    setComponentiImportati(
      mixTemplate._nomi.map((nome, i) => ({
        nome,
        concentrazione: mixTemplate._concentrazioni[i] ?? null,
      }))
    )
  } else {
    setComponentiImportati(null)
  }
  setImportedFields(new Set())
  ...
}
```

### 5. `composti.ipc.ts` — override per-componente

Nel loop che costruisce `row`, aggiungere l'override della concentrazione:

```typescript
const row = {
  ...common,
  nome: comp.nome,
  forma_commerciale: comp.forma_commerciale ?? common.forma_commerciale,
  mix:               comp.forma_commerciale ?? common.forma_commerciale,
  lotto:             comp.lotto             ?? common.lotto,
  scadenza_prodotto: comp.scadenza_prodotto ?? common.scadenza_prodotto,
  data_apertura:     comp.data_apertura     ?? common.data_apertura,
  produttore:        comp.produttore        ?? common.produttore,
  concentrazione:    comp.concentrazione    ?? common.concentrazione,  // <-- aggiunta
}
```

Aggiornare il tipo dell'array `componenti` per includere `concentrazione`:

```typescript
const componenti: Array<{
  nome: string
  forma_commerciale?: string | null
  lotto?: string | null
  scadenza_prodotto?: string | null
  data_apertura?: string | null
  produttore?: string | null
  concentrazione?: number | null  // <-- aggiunta
}> = ...
```

---

## Verifica

1. Aprire DB Composti, trovare un CRM mix con componenti a concentrazioni diverse
2. Cliccare "Nuovo lotto" su uno dei componenti
3. Verificare che il campo "Concentrazione" nel form sia vuoto (non pre-compilato col valore sbagliato)
4. Compilare lotto/date e salvare
5. Verificare nel DB che ogni componente del nuovo lotto abbia la propria concentrazione originale (copiata dal lotto precedente per quel componente specifico)
