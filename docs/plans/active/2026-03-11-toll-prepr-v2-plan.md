# Plan — PrepCalcTool: Peso equivalente + Valori effettivi reali

**Data:** 2026-03-11  
**Stato:** Approvato — pronto per esecuzione  
**File coinvolto:** `src/renderer/pages/composti/PrepCalcTool.tsx` (unico file da modificare)  
**Branch da creare:** `feat/prep-calc-real-values`

---

## Obiettivo

Migliorare il calcolatore di preparazione stock (`PrepCalcTool`) su due fronti:

1. **Modalità Volume** → aggiungere il campo densità (sempre visibile, auto-compilato dal dizionario) e mostrare il peso equivalente in grammi accanto al volume teorico
2. **Entrambe le modalità** → aggiungere una sezione "Valori effettivi" dove l'operatore inserisce quanto ha **realmente** aggiunto/pesato, così la concentrazione reale riflette la misura vera e non quella teorica

---

## Situazione attuale

### Modalità Volume — comportamento attuale

L'operatore inserisce: conc. target + massa pesata + purezza + solvente.  
Il tool mostra solo il **volume teorico in mL**.  
Non c'è il campo densità (assente in modalità volume).  
Non c'è il peso equivalente in grammi.  
La concentrazione reale mostrata = concentrazione target (ridondante, non aggiunge informazione).  
Non esiste nessun campo per inserire il volume effettivamente aggiunto.

### Modalità Pesata — comportamento attuale

L'operatore inserisce: massa solvente in g + densità.  
Il tool mostra il volume derivato in mL (già presente).  
Non esiste nessun campo per inserire la massa effettivamente pesata.

### Codice attuale — stato dei campi

```tsx
// Stati esistenti in PrepCalcTool.tsx
const [concTarget, setConcTarget] = useState('')
const [massaPesata, setMassaPesata] = useState('')
const [purezza, setPurezza] = useState(purezzeDefault?.toString() ?? '')
const [solvente, setSolvente] = useState('')
const [solventeCustom, setSolventeCustom] = useState('')
const [densita, setDensita] = useState('')          // <-- esiste ma usato SOLO in modalità pesata
const [modalita, setModalita] = useState<'volume' | 'pesata'>('volume')
const [massaSolvente, setMassaSolvente] = useState('') // <-- SOLO in modalità pesata
const [unitaConc, setUnitaConc] = useState<string>(UNITA_DEFAULT)
```

### Codice attuale — logica calcoli (useMemo)

```tsx
const calculations = useMemo(() => {
  const concTargetNum = parseFloat(concTarget) || 0
  const massaPesataNum = parseFloat(massaPesata) || 0
  const purezzaNum = parseFloat(purezza) || 0
  const densitaNum = parseFloat(densita) || 0
  const massaSolventeNum = parseFloat(massaSolvente) || 0

  const massaReale = (massaPesataNum * purezzaNum) / 100

  let volumeSolvente = 0
  let concReale = 0
  let isValid = false

  if (modalita === 'volume') {
    if (concTargetNum > 0 && massaReale > 0) {
      volumeSolvente = (massaReale / concTargetNum) * 1000
      concReale = (massaReale / volumeSolvente) * 1000  // <-- = concTarget, ridondante
      isValid = isFinite(concReale)
    }
  } else {
    if (densitaNum > 0 && massaSolventeNum > 0 && massaReale > 0) {
      volumeSolvente = massaSolventeNum / densitaNum
      concReale = (massaReale / volumeSolvente) * 1000
      isValid = isFinite(concReale)
    }
  }

  return { massaReale, volumeSolvente, concReale, isValid }
}, [concTarget, massaPesata, purezza, densita, modalita, massaSolvente])
```

### Codice attuale — sezione risultati nel JSX

```tsx
{/* Risultati — attuale */}
<div className="text-xs bg-white/50 dark:bg-black/20 rounded p-2">
  <div>{modalita === 'volume' ? 'Aggiungere' : 'Pesare'}:</div>
  <div className="font-mono text-sm font-bold mt-1 flex items-center gap-3">
    <span>
      {modalita === 'volume' ? calculations.volumeSolvente.toFixed(2) : massaSolvente}
      {modalita === 'volume' ? 'mL' : 'g'}
    </span>
    {modalita === 'pesata' && calculations.volumeSolvente > 0 && (
      <span className="text-muted-foreground font-normal">
        → {calculations.volumeSolvente.toFixed(2)} mL
      </span>
    )}
  </div>
  <div className="text-xs text-muted-foreground mt-1">di {solventeDisplay}</div>
</div>

<div className="text-center bg-primary/10 rounded p-3 border border-primary/30">
  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
    Concentrazione reale
  </div>
  <div className="text-2xl font-bold text-primary font-mono">
    {calculations.concReale.toFixed(1)}
  </div>
  <div className="text-xs text-muted-foreground">{unitaConc}</div>
</div>
```

---

## Modifiche da apportare

### TASK 1 — Aggiungere campo densità sempre visibile (non più solo in modalità pesata)

**File:** `src/renderer/pages/composti/PrepCalcTool.tsx`

**Cosa cambia:** Il campo densità attualmente è nascosto nella sezione `{modalita === 'pesata' && ...}`. Va spostato nella sezione "Solvente e Unità" rendendolo sempre visibile, posizionato subito sotto la select del solvente. Si auto-compila dal dizionario solventi quando si seleziona un solvente noto (comportamento già esistente tramite `handleSolventeChange`), e rimane modificabile manualmente.

**Codice attuale** (campo densità dentro il blocco pesata, righe circa 95-115 del componente):

```tsx
{/* Input pesata (solo se modalita='pesata') */}
{modalita === 'pesata' && (
  <div className="grid grid-cols-2 gap-2">
    <div>
      <Label className="text-xs">Massa solvente (g)</Label>
      <Input
        type="number"
        step="0.1"
        value={massaSolvente}
        onChange={e => setMassaSolvente(e.target.value)}
        placeholder="es. 10.5"
      />
    </div>
    <div>
      <Label className="text-xs">Densità (g/cm³)</Label>
      <Input
        type="number"
        step="0.001"
        value={densita}
        onChange={e => setDensita(e.target.value)}
        placeholder="es. 0.786"
      />
    </div>
  </div>
)}
```

**Codice dopo la modifica** — il campo densità esce dal blocco pesata e va nella sezione solvente, il blocco pesata mantiene solo la massa:

```tsx
{/* Campo densità — SEMPRE VISIBILE, subito dopo la select solvente */}
<div>
  <Label className="text-xs">Densità solvente (g/cm³)</Label>
  <Input
    type="number"
    step="0.001"
    value={densita}
    onChange={e => setDensita(e.target.value)}
    placeholder="es. 0.786 — auto da solvente"
  />
</div>

{/* Input pesata (solo se modalita='pesata') — ora contiene SOLO la massa */}
{modalita === 'pesata' && (
  <div>
    <Label className="text-xs">Massa solvente teorica da pesare (g)</Label>
    <Input
      type="number"
      step="0.1"
      value={massaSolvente}
      onChange={e => setMassaSolvente(e.target.value)}
      placeholder="es. 10.5"
    />
  </div>
)}
```

---

### TASK 2 — Modalità Volume: aggiungere peso equivalente nel risultato teorico

**File:** `src/renderer/pages/composti/PrepCalcTool.tsx`

**Cosa cambia:** Nella sezione risultati teorici, in modalità volume, accanto al volume in mL mostrare il peso equivalente calcolato come `volume × densità`. Se la densità non è inserita, la riga del peso non appare.

**Logica da aggiungere nel `useMemo`** (dentro il blocco `if (modalita === 'volume')`):

```tsx
// Aggiungere a calculations il peso equivalente per modalità volume
let pesoEquivalente: number | null = null
if (modalita === 'volume' && densitaNum > 0 && volumeSolvente > 0) {
  pesoEquivalente = volumeSolvente * densitaNum
}

return { massaReale, volumeSolvente, concReale, isValid, pesoEquivalente }
```

**JSX attuale** (blocco risultato teorico):

```tsx
<div className="font-mono text-sm font-bold mt-1 flex items-center gap-3">
  <span>
    {modalita === 'volume' ? calculations.volumeSolvente.toFixed(2) : massaSolvente}
    {modalita === 'volume' ? ' mL' : ' g'}
  </span>
  {modalita === 'pesata' && calculations.volumeSolvente > 0 && (
    <span className="text-muted-foreground font-normal">
      → {calculations.volumeSolvente.toFixed(2)} mL
    </span>
  )}
</div>
```

**JSX dopo la modifica:**

```tsx
<div className="font-mono text-sm font-bold mt-1 flex items-center gap-3">
  <span>
    {modalita === 'volume' ? calculations.volumeSolvente.toFixed(2) : massaSolvente}
    {modalita === 'volume' ? ' mL' : ' g'}
  </span>
  {/* Modalità pesata: mostra volume derivato */}
  {modalita === 'pesata' && calculations.volumeSolvente > 0 && (
    <span className="text-muted-foreground font-normal">
      → {calculations.volumeSolvente.toFixed(2)} mL
    </span>
  )}
  {/* Modalità volume: mostra peso equivalente — NUOVO */}
  {modalita === 'volume' && calculations.pesoEquivalente !== null && (
    <span className="text-muted-foreground font-normal">
      ≈ {calculations.pesoEquivalente.toFixed(2)} g
    </span>
  )}
</div>
```

---

### TASK 3 — Aggiungere sezione "Valori effettivi" con campo reale e concentrazione reale calcolata

**File:** `src/renderer/pages/composti/PrepCalcTool.tsx`

**Cosa cambia:** Sotto la sezione del risultato teorico, aggiungere una nuova sezione separata visivamente. Contiene un campo dove l'operatore inserisce il valore **effettivamente** aggiunto (volume in mL se modalità volume, grammi se modalità pesata). La concentrazione reale viene calcolata da questo valore. Se il campo è vuoto, si usa il valore teorico.

**Nuovi stati da aggiungere:**

```tsx
// Aggiungere dopo gli stati esistenti
const [volumeEffettivo, setVolumeEffettivo] = useState('')   // mL reali (modalità volume)
const [massaEffettiva, setMassaEffettiva] = useState('')     // g reali (modalità pesata)
```

**Logica da aggiungere nel `useMemo`:**

```tsx
// Dopo il calcolo di concReale esistente, aggiungere:

// Calcolo concentrazione reale da valori effettivi
const volumeEffettivoNum = parseFloat(volumeEffettivo) || 0
const massaEffettivaNum = parseFloat(massaEffettiva) || 0

let concRealeEffettiva: number | null = null
let volumeRealeUsato: number = volumeSolvente // default = teorico

if (modalita === 'volume' && volumeEffettivoNum > 0 && massaReale > 0) {
  volumeRealeUsato = volumeEffettivoNum
  concRealeEffettiva = (massaReale / volumeEffettivoNum) * 1000
} else if (modalita === 'pesata' && massaEffettivaNum > 0 && densitaNum > 0 && massaReale > 0) {
  volumeRealeUsato = massaEffettivaNum / densitaNum
  concRealeEffettiva = (massaReale / volumeRealeUsato) * 1000
}

// Il valore finale da passare a onConfirm
const concFinale = concRealeEffettiva ?? concReale
const volumeFinale = volumeRealeUsato

return {
  massaReale, volumeSolvente, concReale, isValid, pesoEquivalente,
  concRealeEffettiva, concFinale, volumeFinale
}
```

**JSX da aggiungere** — nuova sezione sotto il risultato teorico, sopra il footer con i bottoni:

```tsx
{/* Sezione valori effettivi — NUOVO */}
{calculations.isValid && (
  <div className="border rounded-md p-3 space-y-3 border-dashed border-muted-foreground/40">
    <div className="text-xs font-semibold text-foreground">
      Valori effettivi <span className="font-normal text-muted-foreground">(opzionale)</span>
    </div>
    <div className="text-xs text-muted-foreground">
      Inserisci quanto hai realmente {modalita === 'volume' ? 'aggiunto' : 'pesato'}.
      Se vuoto, viene usato il valore teorico.
    </div>

    {modalita === 'volume' && (
      <div>
        <Label className="text-xs">Volume effettivo aggiunto (mL)</Label>
        <Input
          type="number"
          step="0.01"
          value={volumeEffettivo}
          onChange={e => setVolumeEffettivo(e.target.value)}
          placeholder={`teorico: ${calculations.volumeSolvente.toFixed(2)} mL`}
        />
      </div>
    )}

    {modalita === 'pesata' && (
      <div>
        <Label className="text-xs">Massa effettiva pesata (g)</Label>
        <Input
          type="number"
          step="0.001"
          value={massaEffettiva}
          onChange={e => setMassaEffettiva(e.target.value)}
          placeholder={`teorico: ${massaSolvente || '—'} g`}
        />
      </div>
    )}

    {/* Concentrazione reale — appare sempre, aggiornata in tempo reale */}
    <div className="text-center bg-primary/10 rounded p-3 border border-primary/30">
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
        Concentrazione reale
      </div>
      <div className="text-2xl font-bold text-primary font-mono">
        {calculations.concFinale.toFixed(1)}
      </div>
      <div className="text-xs text-muted-foreground">{unitaConc}</div>
      {calculations.concRealeEffettiva !== null && (
        <div className="text-xs text-muted-foreground mt-1">
          (da valore effettivo inserito)
        </div>
      )}
    </div>
  </div>
)}
```

> **Nota:** Il blocco `<div className="text-center bg-primary/10 ...">` che attualmente è separato nella sezione risultati teorici va **rimosso** da lì e sostituito da questa nuova sezione unificata.

---

### TASK 4 — Aggiornare `handleConfirm` per usare i valori effettivi

**File:** `src/renderer/pages/composti/PrepCalcTool.tsx`

**Cosa cambia:** La funzione `handleConfirm` deve passare `concFinale` e `volumeFinale` invece di `concReale` e `volumeSolvente`. La nota auto-generata deve indicare se si tratta di valore teorico o effettivo.

**Codice attuale:**

```tsx
const handleConfirm = () => {
  if (!calculations.isValid || !solventeDisplay) return

  const concTargetNum = parseFloat(concTarget) || 0

  onConfirm({
    concentrazione: calculations.concReale,
    unita_conc: unitaConc,
    solvente: solventeDisplay,
    note: `[Calc] Pesata: ${massaPesata} mg, purezza: ${purezza}%, ` +
      (modalita === 'volume'
        ? `aggiunto ${calculations.volumeSolvente.toFixed(2)} mL ${solventeDisplay}`
        : `pesato ${massaSolvente} g ${solventeDisplay} (d=${densita})`) +
      ` → Conc. reale: ${calculations.concReale.toFixed(1)} ${unitaConc}`,
    volume_solvente: calculations.volumeSolvente,
    massa_pesata: parseFloat(massaPesata) || 0,
    purezza_usata: parseFloat(purezza) || 0,
    densita_solvente: densitaDisplay,
    modalita_aggiunta: modalita,
    concentrazione_reale: calculations.concReale,
    concentrazione_target: concTargetNum,
  })
}
```

**Codice dopo la modifica:**

```tsx
const handleConfirm = () => {
  if (!calculations.isValid || !solventeDisplay) return

  const concTargetNum = parseFloat(concTarget) || 0
  const haValoreEffettivo = calculations.concRealeEffettiva !== null

  // Descrizione del valore usato per la nota
  const descValore = modalita === 'volume'
    ? (haValoreEffettivo
        ? `aggiunto effettivo: ${volumeEffettivo} mL (teorico: ${calculations.volumeSolvente.toFixed(2)} mL)`
        : `aggiunto ${calculations.volumeSolvente.toFixed(2)} mL`)
    : (haValoreEffettivo
        ? `pesato effettivo: ${massaEffettiva} g (teorico: ${massaSolvente} g)`
        : `pesato ${massaSolvente} g (d=${densita})`)

  onConfirm({
    concentrazione: calculations.concFinale,
    unita_conc: unitaConc,
    solvente: solventeDisplay,
    note: `[Calc] Pesata: ${massaPesata} mg, purezza: ${purezza}%, ` +
      `${descValore} ${solventeDisplay}` +
      ` → Conc. reale: ${calculations.concFinale.toFixed(1)} ${unitaConc}`,
    volume_solvente: calculations.volumeFinale,
    massa_pesata: parseFloat(massaPesata) || 0,
    purezza_usata: parseFloat(purezza) || 0,
    densita_solvente: parseFloat(densita) || null,
    modalita_aggiunta: modalita,
    concentrazione_reale: calculations.concFinale,
    concentrazione_target: concTargetNum,
  })
}
```

---

### TASK 5 — Reset dei nuovi campi all'apertura del dialog

**File:** `src/renderer/pages/composti/PrepCalcTool.tsx`

**Cosa cambia:** I due nuovi stati `volumeEffettivo` e `massaEffettiva` devono essere azzerati ogni volta che il dialog si apre, insieme agli altri campi. Il reset avviene già tramite `useEffect` sull'apertura del dialog (o va aggiunto se non presente).

Verificare se esiste un `useEffect` con dipendenza `[open]`. Se sì, aggiungere il reset dei due nuovi stati:

```tsx
useEffect(() => {
  if (open) {
    // ... reset campi esistenti ...
    setVolumeEffettivo('')   // NUOVO
    setMassaEffettiva('')    // NUOVO
  }
}, [open])
```

Se il `useEffect` non esiste, crearlo con tutti i reset.

---

## Ordine di esecuzione

| # | Task | Rischio | Note |
|---|------|---------|------|
| 1 | Campo densità sempre visibile | Basso | Spostamento UI, nessuna logica nuova |
| 2 | Peso equivalente in modalità volume | Basso | Solo display, aggiunta a `useMemo` |
| 3 | Sezione valori effettivi + conc. reale | Medio | Nuovi stati + nuova logica nel `useMemo` |
| 4 | Aggiornamento `handleConfirm` | Medio | Dipende dal Task 3 |
| 5 | Reset nuovi campi | Basso | Dipende dal Task 3 |

> Eseguire i task nell'ordine indicato. Testare manualmente dopo ogni task prima di procedere.

---

## Branch Git

```bash
# Prima di iniziare
git checkout main
git pull
git checkout -b feat/prep-calc-real-values
```

```bash
# Commit finale (solo dopo verifica manuale completa)
git add src/renderer/pages/composti/PrepCalcTool.tsx
git commit -m "feat(ui): PrepCalcTool — peso equivalente + valori effettivi reali"
```

---

## Verifica finale

Dopo tutti i task, testare i seguenti scenari:

1. **Modalità volume, solvente da dizionario** → la densità si auto-compila, il peso equivalente appare nel risultato teorico
2. **Modalità volume, solvente custom senza densità** → il peso equivalente non appare, nessun errore
3. **Modalità volume, inserendo volume effettivo** → la conc. reale cambia rispetto al teorico
4. **Modalità volume, campo volume effettivo vuoto** → la conc. reale usa il valore teorico
5. **Modalità pesata, inserendo massa effettiva** → la conc. reale si aggiorna
6. **Modalità pesata, campo massa effettiva vuoto** → si usa il valore teorico
7. **Bottone "Usa questi valori"** → i valori passati al form principale sono quelli effettivi se inseriti, teorici altrimenti
8. **Chiudere e riaprire il dialog** → tutti i campi azzerati