# Task per agente — Modulo Composti
> Esegui **un task alla volta**. Dopo ogni task l'utente testa manualmente prima di procedere.  
> Leggi sempre i file referenziati prima di modificare. Non eseguire `git add` o `git commit`.

---

## TASK 1 — Fix doppia unità `mg/L mg/L` nel display preparazione

**Branch da creare prima di iniziare:**
```bash
git checkout master
git checkout -b fix/prep-double-unit
```

**Cosa fare:**  
Apri `src/renderer/pages/composti/PreparazioniTab.tsx`.

Cerca dove viene visualizzata la concentrazione della preparazione (probabile `{prep.concentrazione} mg/L` o simile). Controlla se `prep.concentrazione` contiene già l'unità come stringa (es. `"5 mg/L"`). Se sì, rimuovi il suffisso `mg/L` hardcoded nel JSX in modo che l'unità appaia una sola volta. Se `prep.concentrazione` è un numero puro, lascia l'unità nel JSX e non toccare niente.

**Verifica:** nel pannello preparazioni, la concentrazione deve mostrare `5 mg/L` e non `5 mg/L mg/L`.

---

## TASK 2 — Modalità Pesata: aggiungi volume solvente derivato in mL

**Branch da creare prima di iniziare:**
```bash
git checkout master
git checkout -b feat/pesata-show-derived-volume
```

**Cosa fare:**  
Apri `src/renderer/pages/composti/PrepCalcTool.tsx`.

Nel blocco risultati della modalità "Per pesata (g)", subito sotto il testo che mostra la massa in `g` e il nome del solvente, aggiungi una riga che mostri il volume derivato calcolato come `massa / densità`, con unità `mL`. Usa lo stesso stile visivo delle altre info secondarie (testo piccolo, colore muted). La formula è: `volume_mL = massa_solvente_g / densita_g_cm3`.

Non modificare la logica di calcolo esistente, solo aggiungere la riga di display.

**Verifica:** in modalità pesata, sotto `1.00 g di Acqua` deve comparire `→ 1.00 mL` (o equivalente formattato).

---

## TASK 3 — Fix form Mix e form Composto: campi, forma e colonna tabella

**Branch da creare prima di iniziare:**
```bash
git checkout master
git checkout -b fix/mix-form-fields
```

**Questo task tocca 3 file in ordine.**

### 3A — `MixPesticidiForm.tsx`
- Rimuovi il campo Select "Forma" dal JSX e dallo stato
- Nel payload di `handleSave` passa `forma: 'mix'` come valore fisso
- Aggiorna `reset()` di conseguenza
- Aggiungi `codice_interno: ''` allo stato e al `reset()`
- Nel JSX aggiungi un campo Input "Codice Interno" (`col-span-2`) subito dopo il campo "Nome mix (Forma Commerciale)"
- Includilo nel payload di `handleSave`

### 3B — `CompostoForm.tsx`
- Nel campo Select "Forma", rimuovi l'opzione `Stock`
- Lascia solo `Neat` e `Solution`

### 3C — `CompostiTable.tsx`
- Nella colonna "Forma", per i composti che hanno `mix_id` non nullo, mostra il testo `mix` invece del valore grezzo del campo `forma`

**Verifica:**
- Nel form Mix non appare più il campo Forma, il codice interno è presente
- Nel form Composto la Select Forma ha solo Neat e Solution
- Nella tabella, i composti creati da mix mostrano "mix" nella colonna Forma

---

## TASK 4 — Rimuovi titolo non informativo dalla card preparazione

**Branch da creare prima di iniziare:**
```bash
git checkout master
git checkout -b fix/prep-card-remove-title
```

**Cosa fare:**  
Apri `src/renderer/pages/composti/PreparazioniTab.tsx`.

Trova il punto dove ogni card/riga preparazione renderizza un titolo o header che mostra cose come `"Solido — #?"` oppure forma + identificatore. Rimuovi quel nodo JSX (il titolo/header della card). Mantieni tutto il resto: campi dati, badge stato, pulsanti azioni.

**Verifica:** nel pannello preparazioni, le card non devono avere più il titolo in cima. I dati (concentrazione, data, operatore, ecc.) devono essere tutti ancora visibili.

---

## TASK 5 — Stato preparazione calcolato automaticamente alla scadenza

**Branch da creare prima di iniziare:**
```bash
git checkout master
git checkout -b feat/prep-stato-calcolato
```

**Cosa fare:**  
Apri `src/renderer/pages/composti/PreparazioniTab.tsx`.

**Passo A:** aggiungi in cima al file (o in un file separato `preparazioni.utils.ts` da importare) questa funzione helper:

```ts
function computeStatoPrep(prep: Preparazione): string {
  if (prep.stato === 'dismessa') return 'dismessa'
  if (prep.stato === 'esaurita') return 'esaurita'
  if (prep.scadenza && new Date(prep.scadenza) < new Date()) return 'scaduta'
  return prep.stato ?? 'attiva'
}
```

**Passo B:** in tutto il file, sostituisci ogni uso diretto di `prep.stato` usato per visualizzare lo stato o per determinare il colore/variante del badge con `computeStatoPrep(prep)`. Non sostituire negli handler di modifica/salvataggio, solo nei punti di rendering.

Il DB non viene toccato. `prep.stato` nel DB rimane invariato.

**Verifica:** una preparazione con `stato = 'attiva'` ma `scadenza` nel passato deve mostrare il badge `Scaduta` (rosso), non `Attiva` (verde).

---

## TASK 6 — Badge contatore preparazioni e alert scadute nella tabella principale

**Branch da creare prima di iniziare:**
```bash
git checkout master
git checkout -b feat/composti-prep-count-badge
```

**Questo task ha 3 sotto-passi da fare in ordine.**

### 6A — Modifica la query IPC
Apri `src/main/ipc/composti.ipc.ts`, handler `composti:list`.

Modifica la query SQL per aggiungere due campi aggregati tramite LEFT JOIN con `preparazioni`:

```sql
SELECT c.*,
  COUNT(CASE WHEN p.stato = 'attiva' THEN 1 END) AS prep_attive_count,
  COUNT(CASE WHEN p.stato = 'attiva' AND p.scadenza < date('now') THEN 1 END) AS prep_scadute_count
FROM composti c
LEFT JOIN preparazioni p ON p.composto_id = c.id
GROUP BY c.id
```

Adatta la sintassi alla query esistente (potrebbe già avere JOIN o WHERE — integra senza rompere i filtri esistenti).

### 6B — Aggiorna il tipo TypeScript
Apri `src/shared/types.ts`, interfaccia `Composto` (o il tipo equivalente).

Aggiungi i due campi opzionali:
```ts
prep_attive_count?: number
prep_scadute_count?: number
```

### 6C — Aggiorna la UI nella tabella
Apri `src/renderer/pages/composti/CompostiTable.tsx`.

Nella cella della colonna Nome (o in una colonna adatta), dopo il nome del composto aggiungi:
- un badge/pill `X prep.` (stile outline/neutro) se `prep_attive_count > 0`
- un badge/icona di allerta (stile rosso/destructive) se `prep_scadute_count > 0`

Guarda come sono fatti gli altri badge già presenti nella tabella e usa lo stesso componente e stile.

**Verifica:** nella tabella principale, i composti con preparazioni devono mostrare il contatore. Se una preparazione è scaduta (data passata, stato attiva nel DB), deve comparire il badge di allerta rosso.

---

## Note operative

- Ogni branch parte sempre da `main` aggiornato.
- Se trovi nomi di handler, componenti o campi leggermente diversi da quelli indicati, adatta senza cambiare la logica descritta e segnalalo.
- Non modificare file non elencati nel task.
- In caso di dubbio su un comportamento esistente, preferisci la modifica minima.