# Piano — 3 micro-task UX: WorkPage + AuditCrm

## Context

L'utente ha tre richieste di UX minori, tutte indipendenti tra loro:

1. **WorkPage — distinguere visivamente Work base vs Intermedie** (la gerarchia "worktree"). Oggi c'è solo un piccolo badge "Intermedia" in purple (riga 596-599 di WorkPage.tsx), ma nella lista fitta non è immediato. In SchemiCalibrazione invece le chips usano due colori netti: **arancione** (`#fdf6e8` / `#c49540` — Work base) e **viola** (`#f2effe` / `#9b86d6` — Intermedia), definiti in `SchemaCalibrazione.types.ts:106-115` come costante `C`. L'utente chiede di riusare lo stesso codice colore in WorkPage, pur consapevole che "i colori potrebbero creare confusione" → servirà un tocco leggero (bordo/sfondo tenue), non un colore invadente.

2. **WorkRow — riga descrittiva poco leggibile.** Oggi `infoCompatta` (WorkPage.tsx:506-513) produce stringhe tipo `"2 mg/L · 1 mL · MeOH"` e poi due badge separati `"6 mesi"` e `"Attiva · 17/10/2026"`. L'utente chiede etichette esplicite: "Concentrazione 2 mg/L · Volume 1 mL · MeOH", "Durata Work 6 mesi", "Attiva · Scade il 17/10/2026".

3. **AuditCrmSection — dropdown metodo mostra l'id.** In `AuditCrmSection.tsx:260` si vede `{m.id}{m.nome ? ` — ${m.nome}` : ''}`. L'utente vuole `{m.nome} — {m.nome_esteso}` (il campo `nome_esteso` esiste già in `Metodo` — `src/shared/types.ts:31`).

Outcome atteso: gerarchia Work leggibile a colpo d'occhio, riga informativa autoesplicativa, selettore metodo in audit allineato alle altre UI del progetto.

---

## File da modificare

- [src/renderer/pages/work/WorkPage.tsx](src/renderer/pages/work/WorkPage.tsx) — Task 1 + Task 2
- [src/renderer/pages/dashboard/sections/AuditCrmSection.tsx](src/renderer/pages/dashboard/sections/AuditCrmSection.tsx) — Task 3

File di sola lettura (riferimento colori):
- [src/renderer/pages/metodi/SchemaCalibrazione.types.ts](src/renderer/pages/metodi/SchemaCalibrazione.types.ts) — costante `C` già definita, righe 106-115

---

## Task 1 — Distinguere Work base vs Intermedie in WorkPage

**File:** [src/renderer/pages/work/WorkPage.tsx:530-614](src/renderer/pages/work/WorkPage.tsx#L530-L614) (header di `WorkRow`)

**Problema reale:** il badge "Intermedia" attuale (riga 596-599) esiste ma **non si vede** — l'header della WorkRow è affollato (pulsante Prepara, fino a 4 badge alert, info compatta, 2 badge validità/stato, badge metodi, pulsanti azione) e il badge piccolo in viola pallido si perde nel flex wrap o viene spinto fuori su viewport stretti.

**Approccio combinato (due segnali ridondanti e forti):**

### 1a — Bordo sinistro 3px colorato (scelta confermata dall'utente)

Modifica sul `<div>` esterno della riga ([WorkPage.tsx:531](src/renderer/pages/work/WorkPage.tsx#L531)):

```tsx
<div
  className="border rounded-md overflow-hidden"
  style={{ borderLeft: `3px solid ${isIntermedia ? '#9b86d6' : '#c49540'}` }}
>
```

- `isIntermedia === true` → bordo viola (`#9b86d6` — da `C.inter.border` in SchemaCalibrazione.types.ts)
- `isIntermedia === false` (Work base) → bordo arancione (`#c49540` — da `C.work.border`)

Non importare `C` da SchemaCalibrazione.types.ts per evitare coupling tra moduli — usare i literal hex con commento che indica la provenienza.

### 1b — Rinforzo del badge "Intermedia"

Attualmente (riga 596-599):
```tsx
{isIntermedia && (
  <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 border-purple-300 text-purple-700 bg-purple-50">
    Intermedia
  </Badge>
)}
```

Problemi:
- Badge viola pallido, poco contrastato.
- Posizionato verso la fine dell'header, dopo molti altri badge alert — si perde.
- Solo per le intermedie: le Work base non hanno nessun indicatore esplicito (oltre all'assenza del badge).

Modifica — spostare un **indicatore sempre presente** subito dopo il nome della Work (riga 539), prima del pulsante Prepara:

```tsx
<div className="font-medium text-sm min-w-0 truncate">{work.nome}</div>
<Badge
  variant="outline"
  className="text-[10px] px-1.5 py-0 shrink-0 font-medium"
  style={
    isIntermedia
      ? { borderColor: '#9b86d6', color: '#5a3fa0', backgroundColor: '#f2effe' }
      : { borderColor: '#c49540', color: '#6b4f1a', backgroundColor: '#fdf6e8' }
  }
>
  {isIntermedia ? 'Intermedia' : 'Work'}
</Badge>
```

E **rimuovere** il badge "Intermedia" originale alle righe 596-599 (ora sostituito dal nuovo subito dopo il nome).

**Risultato:**
- Ogni riga ha un bordo colorato sinistro (accent stripe).
- Ogni riga ha un badge colorato `Work` o `Intermedia` immediatamente dopo il nome — posizione garantita, non spinta via dai badge alert sulla destra.
- Colori allineati alla palette `C` di SchemaCalibrazione.

**Accessibilità:** il testo del badge ("Work"/"Intermedia") resta il segnale primario; il colore è un rinforzo.

---

## Task 2 — Riga descrittiva WorkRow con etichette esplicite

**File:** [src/renderer/pages/work/WorkPage.tsx:506-513](src/renderer/pages/work/WorkPage.tsx#L506-L513) + [601-614](src/renderer/pages/work/WorkPage.tsx#L601-L614)

### 2a — `infoCompatta` (righe 506-513)

Prima:
```ts
const infoCompatta = [
  work.concentrazione != null && !work.conc_variabile
    ? `${work.concentrazione} ${work.unita_conc ?? 'mg/L'}`
    : work.conc_variabile ? 'variabile' : null,
  work.volume_ml ? `${work.volume_ml} mL` : null,
  work.solvente ?? null,
  work.operatore ? `Op: ${work.operatore}` : null,
].filter(Boolean).join(' · ')
```

Dopo (scelta utente: solvente nudo):
```ts
const infoCompatta = [
  work.concentrazione != null && !work.conc_variabile
    ? `Concentrazione ${work.concentrazione} ${work.unita_conc ?? 'mg/L'}`
    : work.conc_variabile ? 'Concentrazione variabile' : null,
  work.volume_ml ? `Volume ${work.volume_ml} mL` : null,
  work.solvente ?? null,
  work.operatore ? `Op: ${work.operatore}` : null,
].filter(Boolean).join(' · ')
```

Inoltre: il `max-w-[260px]` attuale sul `<span>` (riga 575) ora rischia troncamento eccessivo — passare a `max-w-[420px]` per far stare la stringa più lunga su schermi large.

### 2b — Badge validità (righe 601-609)

Prima:
```tsx
<Badge …>{work.validita_mesi} mesi</Badge>
```

Dopo:
```tsx
<Badge …>Durata {work.validita_mesi} mesi</Badge>
```

(Il ramo `else` "al momento" resta com'è — è già esplicito.)

### 2c — Badge stato con "Scade il"

Prima (riga 612):
```tsx
{statoBadge.label}{scadenzaLabel && (statoLab === 'attiva' || statoLab === 'in_scadenza') ? ` · ${scadenzaLabel}` : ''}
```

Dopo:
```tsx
{statoBadge.label}{scadenzaLabel && (statoLab === 'attiva' || statoLab === 'in_scadenza') ? ` · Scade il ${scadenzaLabel}` : ''}
```

Risultato finale atteso per una riga:
- `Concentrazione 2 mg/L · Volume 1 mL · MeOH`
- Badge: `Durata 6 mesi` `Attiva · Scade il 17/10/2026`

---

## Task 3 — AuditCrm: dropdown metodo con nome esteso

**File:** [src/renderer/pages/dashboard/sections/AuditCrmSection.tsx:258-262](src/renderer/pages/dashboard/sections/AuditCrmSection.tsx#L258-L262)

Prima:
```tsx
{metodi.map(m => (
  <SelectItem key={m.id} value={m.id}>
    {m.id}{m.nome ? ` — ${m.nome}` : ''}
  </SelectItem>
))}
```

Dopo:
```tsx
{metodi.map(m => (
  <SelectItem key={m.id} value={m.id}>
    {m.nome}{m.nome_esteso ? ` — ${m.nome_esteso}` : ''}
  </SelectItem>
))}
```

**Verifica pre-modifica:** controllare che il tipo di `metodi` esposti a questa sezione contenga effettivamente `nome_esteso`. In `src/shared/types.ts:31` `nome_esteso: string | null` esiste sul tipo `Metodo`. Se la sezione usa un subset custom (es. `{ id, nome }` soltanto), occorrerà estendere la query/shape al caricamento — leggere la funzione che popola `metodi` nel componente per confermare.

---

## Verifica end-to-end

1. **Build/typecheck:**
   ```
   npm run typecheck   # o equivalente nel progetto (vedere package.json)
   ```

2. **Avvio app Electron e smoke test:**
   ```
   npm run dev
   ```
   - **Task 1:** aprire WorkPage → verificare che Work base hanno bordo sinistro arancione, le Intermedie bordo viola. Badge "Intermedia" deve restare visibile.
   - **Task 2:** una riga Work con concentrazione/volume/solvente deve mostrare "Concentrazione … · Volume … · Solvente …"; badge "Durata X mesi"; badge stato "Attiva · Scade il dd/mm/yyyy".
   - **Task 3:** aprire Dashboard → sezione Audit CRM → dropdown "Metodo" deve mostrare "NomeMetodo — Nome esteso del metodo" invece dell'id progressivo.

3. **Regressioni da controllare:**
   - WorkRow: hover e click sul body non alterati (il `borderLeft` inline non dovrebbe interferire con `bg-muted/30 hover:bg-muted/50`).
   - Troncamento `max-w` della info compatta su viewport medi — verificare su finestra ridimensionata.
   - Metodi senza `nome_esteso`: il fallback `{m.nome}` senza trattino deve restare leggibile.

---

## Scelte confermate dall'utente

- **Task 1:** accent stripe — bordo sinistro 3px arancione (Work base) / viola (Intermedia). Badge "Intermedia" mantenuto.
- **Task 2:** solvente nudo ("MeOH") senza etichetta, come da richiesta letterale.
