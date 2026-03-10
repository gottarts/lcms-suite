# Plan — Storico: Preparazioni come eventi + Verifica Ordinamento
**Data:** 2026-03-10  
**Branch:** `master`  
**DB user_version attuale:** 8  

---

## Riepilogo

| ID | Tipo | File | Descrizione |
|----|------|------|-------------|
| TASK-1 | Verifica (no modifica) | `composti.ipc.ts` | Conferma ordinamento `data DESC` già corretto nel backend |
| TASK-2 | Feature | `CompostoPanel.tsx` | Preparazioni come eventi nella timeline storico, più recente in cima |

---

## Obiettivo

Il tab **Storico** del pannello laterale diventa un **audit trail** cronologico completo del composto.  
Attualmente mostra: Apertura flacone, Aperture fiale, Rivalidazioni, Dismissioni.  
Dopo questa modifica mostrerà anche le **Preparazioni** come eventi nella stessa lista, ordinate insieme per data **decrescente** (più recente in cima).

---

## TASK-1 — Verifica ordinamento (nessuna modifica da fare)

### Situazione attuale — già corretta

In `src/main/ipc/composti.ipc.ts`, handler `composti:get`:

```typescript
const storia = db.prepare(
  'SELECT * FROM composti_storia WHERE composto_id = ? ORDER BY data DESC'
).all(id)
```

`ORDER BY data DESC` è corretto: più recente in cima.  
**Non toccare questo file.**

### Possibile causa dei "comportamenti strani"

I problemi di ordinamento che hai visto probabilmente dipendono da uno di questi casi:

1. **Due eventi con la stessa data** — se due rivalidazioni hanno la stessa data, l'ordine tra di loro è imprevedibile senza un secondo campo di sort. La query attuale non ha un tiebreaker.
2. **Confronto tra date in formato italiano** — se qualche data è stata salvata in formato `DD/MM/YYYY` invece di `YYYY-MM-DD`, SQLite le ordina come stringhe e l'ordinamento è sbagliato. Da verificare sui dati reali.
3. **L'evento "Apertura flacone" è fuori dalla lista** — viene renderizzato separatamente e appare sempre in fondo al pannello (dopo tutti gli eventi della storia). Con il più recente in cima, l'apertura si troverà visivamente in basso — ma questo è by design, non un bug.

> ✅ Nessuna modifica da fare al backend per questa task.

---

## TASK-2 — Preparazioni come eventi nello storico

### Situazione attuale

Nel tab Storico di `CompostoPanel.tsx`, la struttura attuale è:

1. Pulsanti "Rivalidazione" e "Dismissione"
2. **Evento fisso "Apertura flacone"** (renderizzato per primo, separato dalla lista)
3. **Lista `composto.storia`** ordinata per data DESC (dal backend)

Le preparazioni esistono già in `composto.preparazioni` (array caricato da `composti:get`) ma non compaiono nello storico.

### Situazione dopo la modifica

Le preparazioni vengono incluse nella timeline come eventi. Regole:

- **Lista unica** con storia + preparazioni, ordinate per `data DESC` (più recente in cima)
- **Evento "Apertura flacone"** rimane **in fondo** alla lista (è il più vecchio per definizione — è la nascita del composto)
- Le preparazioni mostrano: badge verde "Preparazione", data, concentrazione + unità, operatore, stato, link "→ vedi preparazioni"
- Il link **"→ vedi preparazioni"** al click porta al tab Preparazioni **senza chiudere il pannello**

---

### File da modificare

**`src/renderer/pages/composti/CompostoPanel.tsx`** — unico file da modificare.

---

### Modifica A — Verificare e rendere disponibile `computeStatoPrep`

Prima di tutto, apri `src/renderer/pages/composti/PreparazioniTab.tsx` e cerca questa funzione:

```typescript
function computeStatoPrep(prep: any): string {
```

oppure:

```typescript
export function computeStatoPrep(prep: any): string {
```

**Caso 1 — La funzione c'è ma NON ha `export`:**  
Aggiungi `export` davanti:
```typescript
export function computeStatoPrep(prep: any): string {
```

**Caso 2 — La funzione NON c'è:**  
Non modificare `PreparazioniTab.tsx`. Invece, aggiungila direttamente in `CompostoPanel.tsx`, prima della riga `export function CompostoPanel(...)`:

```typescript
function computeStatoPrep(prep: any): string {
  if (prep.stato === 'Dismessa') return 'Dismessa'
  if (prep.stato === 'Esaurita') return 'Esaurita'
  if (prep.scadenza && new Date(prep.scadenza) < new Date()) return 'Scaduta'
  return prep.stato ?? 'Attiva'
}
```

**Caso 3 — La funzione c'è ed è già `export`:**  
Aggiungi l'import in `CompostoPanel.tsx` (in cima al file, dopo gli altri import locali):

```typescript
import { computeStatoPrep } from './PreparazioniTab'
```

---

### Modifica B — Controllare le import di React in cima al file

Trovare in cima a `CompostoPanel.tsx` la riga:

```typescript
import { useState, useEffect } from 'react'
```

Se `useMemo` non è presente, aggiungilo:

```typescript
import { useState, useEffect, useMemo } from 'react'
```

---

### Modifica C — Aggiungere stato `activeTab` per controllare il tab corrente

Il pannello attualmente usa `<Tabs defaultValue={defaultTab ?? 'dettaglio'}>` — è "uncontrolled" (React gestisce internamente il tab attivo). Per permettere al link "→ vedi preparazioni" di cambiare programmaticamente il tab, dobbiamo passare a un Tabs "controlled".

Trovare nel corpo del componente le dichiarazioni degli stati esistenti (le righe con `useState`):

```typescript
const [composto, setComposto] = useState<any>(null)
const [ultimaRivalidazione, setUltimaRivalidazione] = useState<string | null>(null)
const [storiaForm, setStoriaForm] = useState<{ open: boolean; tipo: string }>({ open: false, tipo: '' })
const [storiaData, setStoriaData] = useState({...})
const [lottiValidi, setLottiValidi] = useState<any[]>([])
```

**Aggiungere dopo l'ultimo `useState`:**

```typescript
const [activeTab, setActiveTab] = useState<string>(defaultTab ?? 'dettaglio')
```

Poi trovare il `useEffect` per il caricamento:

```typescript
useEffect(() => { load() }, [compostoId])
```

**Aggiungere subito dopo** questo secondo `useEffect`:

```typescript
useEffect(() => {
  setActiveTab(defaultTab ?? 'dettaglio')
}, [defaultTab, compostoId])
```

Questo serve per resettare il tab corretto quando si cambia composto selezionato.

---

### Modifica D — Cambiare `<Tabs>` da uncontrolled a controlled

Trovare nell'JSX del componente (c'è un solo `<Tabs>` nel file):

```tsx
<Tabs defaultValue={defaultTab ?? 'dettaglio'}>
```

Sostituire con:

```tsx
<Tabs value={activeTab} onValueChange={setActiveTab}>
```

---

### Modifica E — Aggiungere il calcolo della timeline unificata

Questo calcolo deve stare **dentro il componente**, dopo tutti gli `useEffect` e prima del `return`. Trovare la riga `if (!composto) return null` e aggiungere il blocco **subito dopo**:

```typescript
if (!composto) return null

// ← AGGIUNGERE QUI:
// Timeline unificata: merge storia + preparazioni, ordinate per data DESC (più recente in cima)
const timelineEvents = (() => {
  const storiaEvents = (composto.storia ?? []).map((s: any) => ({
    _type: 'storia' as const,
    _sortDate: s.data ?? '',
    _sortId: s.id as number,
    data: s,
  }))

  const prepEvents = (composto.preparazioni ?? [])
    .filter((p: any) => p.data_prep)
    .map((p: any) => ({
      _type: 'prep' as const,
      _sortDate: p.data_prep as string,
      _sortId: -(p.id as number), // negativo per usare id come tiebreaker ma non mescolare con storia
      data: p,
    }))

  return [...storiaEvents, ...prepEvents].sort((a, b) => {
    if (b._sortDate < a._sortDate) return -1   // DESC: più recente in cima
    if (b._sortDate > a._sortDate) return 1
    return b._sortId - a._sortId               // tiebreaker: id più alto in cima
  })
})()
```

> ℹ️ Nota: non usiamo `useMemo` qui per semplicità — la funzione IIFE (la `(() => { ... })()`) si ricalcola ogni volta che il componente si re-renderizza, ma questo è accettabile dato che la lista è piccola.

---

### Modifica F — Sostituire il rendering degli eventi nello storico

Questa è la modifica più estesa. Nel `TabsContent value="storico"`, trovare e sostituire il blocco che inizia con l'evento "Apertura flacone" e finisce con il messaggio "Nessun evento registrato".

**Blocco attuale da sostituire** (tutto questo blocco, dall'`{composto.data_apertura && ...}` fino alla `<p>Nessun evento registrato</p>`):

```tsx
            {composto.data_apertura && (
             <div className="flex items-start gap-2 py-2 border-b opacity-75">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground w-20 shrink-0 pt-0.5">
              Apertura
              </span>
              <div className="flex-1">
               <div className="text-xs font-medium">
                 {composto.mix_id
                   ? `Apertura mix ${composto.mix}`
                   : 'Apertura flacone'}
               </div>
              <div className="text-[11px] text-muted-foreground">
               {formatDate(composto.data_apertura)}
              {composto.operatore_apertura && ` — ${composto.operatore_apertura}`}
             </div>
            </div>
           </div>
          )}
            {composto.storia?.length ?
              composto.storia.map((s: any) => (
                <div key={s.id} className="p-3 border rounded-md text-sm space-y-1.5">
                  ...tutto il map...
                </div>
              )) : <p className="text-xs text-muted-foreground">Nessun evento registrato</p>}
```

**Blocco nuovo da inserire al posto:**

```tsx
            {/* Timeline unificata: storia + preparazioni, più recente in cima */}
            {timelineEvents.length > 0 ? (
              timelineEvents.map((evt, idx) => {
                if (evt._type === 'prep') {
                  const p = evt.data
                  const statoPrep = computeStatoPrep(p)
                  const statoColor =
                    statoPrep === 'Attiva'    ? 'text-green-700' :
                    statoPrep === 'Scaduta'   ? 'text-red-600'   :
                    statoPrep === 'Esaurita'  ? 'text-amber-600' :
                    statoPrep === 'Dismessa'  ? 'text-muted-foreground' :
                    'text-muted-foreground'
                  return (
                    <div key={`prep-${p.id}`} className="p-3 border rounded-md text-sm space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs border-green-600 text-green-700">
                          Preparazione
                        </Badge>
                        <span className="text-xs text-muted-foreground">{formatDate(p.data_prep)}</span>
                        <span className={`text-xs font-medium ml-auto ${statoColor}`}>{statoPrep}</span>
                      </div>
                      {(p.concentrazione) && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">Concentrazione: </span>
                          <span className="font-mono">{p.concentrazione} {p.unita_conc ?? 'mg/L'}</span>
                        </div>
                      )}
                      {p.solvente && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">Solvente: </span>
                          <span>{p.solvente}</span>
                        </div>
                      )}
                      {p.operatore && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">Operatore: </span>
                          <span>{p.operatore}</span>
                        </div>
                      )}
                      {p.scadenza && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">Scadenza prep.: </span>
                          <span className="font-mono">{formatDate(p.scadenza)}</span>
                        </div>
                      )}
                      {p.note && (
                        <p className="text-xs text-muted-foreground">{p.note}</p>
                      )}
                      <button
                        className="text-[11px] text-blue-600 hover:underline mt-1 block"
                        onClick={() => setActiveTab('preparazioni')}
                      >
                        → vedi preparazioni
                      </button>
                    </div>
                  )
                }

                // Evento storia (Rivalidazione, Dismissione, apertura_fiala)
                const s = evt.data
                return (
                  <div key={`storia-${s.id}`} className="p-3 border rounded-md text-sm space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={s.tipo === 'Rivalidazione' ? 'default' : s.tipo === 'apertura_fiala' ? 'outline' : 'destructive'}
                        className="text-xs"
                      >
                        {s.tipo === 'apertura_fiala' ? `Fiala ${s.fiala_numero} aperta` : s.tipo}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formatDate(s.data)}</span>
                    </div>
                    {s.n_registro_qc && (
                      <div className="text-xs">
                        <span className="text-muted-foreground">N° Registro QC: </span>
                        <span className="font-mono">{s.n_registro_qc}</span>
                      </div>
                    )}
                    {s.batch_analitico && (
                      <div className="text-xs">
                        <span className="text-muted-foreground">Batch: </span>
                        <span className="font-mono">{s.batch_analitico}</span>
                      </div>
                    )}
                    {s.lotto_crm_valido && (
                      <div className="text-xs">
                        <span className="text-muted-foreground">Lotto CRM: </span>
                        <span className="font-mono">{s.lotto_crm_valido}</span>
                      </div>
                    )}
                    {s.nuova_scadenza && (
                      <div className="text-xs">
                        <span className="text-muted-foreground">Scadenza estesa al: </span>
                        <span className="font-mono font-medium text-blue-700">{formatDate(s.nuova_scadenza)}</span>
                      </div>
                    )}
                    {s.note && (
                      <p className="text-xs text-muted-foreground">{s.note}</p>
                    )}
                  </div>
                )
              })
            ) : (
              <p className="text-xs text-muted-foreground">Nessun evento registrato</p>
            )}

            {/* Apertura flacone: sempre in fondo (è l'evento più vecchio per definizione) */}
            {composto.data_apertura && (
              <div className="flex items-start gap-2 py-2 border-t opacity-75 mt-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground w-20 shrink-0 pt-0.5">
                  Apertura
                </span>
                <div className="flex-1">
                  <div className="text-xs font-medium">
                    {composto.mix_id
                      ? `Apertura mix ${composto.mix}`
                      : 'Apertura flacone'}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatDate(composto.data_apertura)}
                    {composto.operatore_apertura && ` — ${composto.operatore_apertura}`}
                  </div>
                </div>
              </div>
            )}
```

> ℹ️ **Nota sul cambio posizione dell'evento "Apertura":** con il più recente in cima, l'apertura del flacone (che è sempre il più vecchio) si sposta **in fondo** alla lista. Il separatore è cambiato da `border-b` a `border-t` per adattarsi alla nuova posizione visiva.

---

## Ordine di esecuzione

```
1. Modifica A  →  PreparazioniTab.tsx  →  verifica/aggiunge export computeStatoPrep
2. Modifica B  →  CompostoPanel.tsx    →  aggiunge useMemo alle import React
3. Modifica C  →  CompostoPanel.tsx    →  aggiunge useState activeTab + useEffect
4. Modifica D  →  CompostoPanel.tsx    →  cambia Tabs da defaultValue a value/onValueChange
5. Modifica E  →  CompostoPanel.tsx    →  aggiunge calcolo timelineEvents dopo "if (!composto) return null"
6. Modifica F  →  CompostoPanel.tsx    →  sostituisce rendering eventi nel TabsContent storico
```

---

## Test dopo le modifiche

**Test 1 — Preparazioni compaiono nello storico**
1. Apri un composto `Neat` con almeno una preparazione
2. Tab Storico → deve comparire almeno un evento con badge verde "Preparazione"
3. ✅ Atteso: data prep, concentrazione, link "→ vedi preparazioni" visibili

**Test 2 — Ordinamento più recente in cima**
1. Composto con una preparazione vecchia e una rivalidazione recente
2. Tab Storico → la rivalidazione deve apparire prima (in cima), la preparazione più vecchia dopo
3. ✅ Atteso: ordine corretto DESC

**Test 3 — Evento Apertura sempre in fondo**
1. Qualsiasi composto con `data_apertura`
2. Tab Storico → l'evento "Apertura flacone" deve essere l'ultimo della lista (in basso)
3. ✅ Atteso: apertura in fondo con separatore `border-t`

**Test 4 — Link "→ vedi preparazioni"**
1. Nel tab Storico, clicca "→ vedi preparazioni" su un evento preparazione
2. ✅ Atteso: il pannello laterale passa al tab "Preparazioni" senza chiudersi

**Test 5 — Composti Solution/MIX (senza preparazioni)**
1. Apri un composto non Neat
2. Tab Storico → nessun evento "Preparazione" deve comparire
3. ✅ Atteso: solo storia eventi + apertura flacone in fondo

**Test 6 — Composto senza nulla**
1. Composto nuovo senza storia, preparazioni, né data apertura
2. Tab Storico → "Nessun evento registrato"
3. ✅ Atteso: nessun crash

---

## Git — commit dopo verifica funzionamento

```bash
git add src/renderer/pages/composti/CompostoPanel.tsx
git add src/renderer/pages/composti/PreparazioniTab.tsx   # solo se hai modificato questo file

git commit -m "feat(storico): preparazioni in timeline + apertura in fondo + tab switch da link"

git push
```

---

*Piano redatto il 2026-03-10 — ordinamento DESC (più recente in cima), apertura flacone in fondo.*