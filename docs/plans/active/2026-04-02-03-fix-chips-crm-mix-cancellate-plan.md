# Fix: Chips CRM Mix appaiono "cancellate" dopo reload o aggiunta work

## Context

Le chips dei CRM mix nello Schema Calibrazione appaiono con opacity 0.28 + line-through ("cancellate") anche quando dovrebbero essere attive. Il bug si manifesta:
- Dopo aver ricaricato la pagina con un lotto non-default selezionato
- Dopo aver aggiunto/importato una work che porta un mix con un lotto diverso

**Root cause:** `mixLottoSel` (Map che dice quale lotto è attivo per ogni firma mix) è uno `useState` locale a `GrigliaAnalitiCrm`, inizializzato sempre vuoto. Non viene mai ripristinato dal `removedMix` salvato nel DB.

Scenario:
1. Mix con lotti A e B. Default: A. Utente seleziona B → `removedMix = {A}`, salvato nel DB.
2. Reload → `removedMix` viene ripristinato da DB con `{A}`, ma `mixLottoSel` riparte vuoto.
3. `mixIdAttivo = mixLottoSel.get(firmaId) ?? firmaId = firmaId = lotto_A` (il default).
4. `removedMix.has(lotto_A) = true` → chip lotto_A appare cancellata.

**Il lotto attivo è implicito in `removedMix`**: per ogni firma, il lotto attivo è quello che NON è in `removedMix`.

## Piano

### Approccio: derivare `mixLottoSel` da `removedMix` nel componente padre

Invece di stato locale (che si perde al reload), calcolare `mixLottoSel` come `useMemo` derivato da `removedMix` + `analiti`, passarlo come prop alla griglia, e rimuovere lo stato locale del componente figlio.

---

### File 1: `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx`

**1a. Aggiungere prop `mixLottoSel` all'interfaccia GrigliaProps (riga 22–36):**
```typescript
// Dopo onChangeMixLotto:
mixLottoSel?: Map<string, string>   // lotto attivo per firma, derivato da removedMix
```

**1b. Aggiungere `mixLottoSel` al destructuring (riga 38–42):**
```typescript
export function GrigliaAnalitiCrm({
  analiti, crmItems, selSrcs, removedMix,
  onToggleMix, onToggleSng, onClose, registerCardRef, gridBodyRef,
  onOpenScenar, onChangeMixLotto, mixLottoSel: mixLottoSelProp,
}: GrigliaProps) {
```

**1c. Sostituire lo stato locale `useState` (riga 76) con variabile derivata dalla prop:**
```typescript
// RIMUOVERE:
const [mixLottoSel, setMixLottoSel] = useState<Map<string, string>>(new Map())

// AGGIUNGERE:
const mixLottoSel = mixLottoSelProp ?? new Map<string, string>()
```

**1d. Rimuovere `setMixLottoSel` dall'onChange del select (righe 434–439):**
```typescript
// RIMUOVERE questa riga nell'onChange:
setMixLottoSel(prev => new Map(prev).set(a.mixId!, newId))
// Rimane solo:
onChangeMixLotto?.(a.mixId!, oldId, newId)
```
Il ciclo `onChangeMixLotto → setRemovedMix → useMemo → prop → re-render` è sincrono in React, nessun lag visibile.

---

### File 2: `src/renderer/pages/metodi/SchemaCalibrazione.tsx`

**2a. Aggiungere `useMemo` dopo riga 816** (dopo il blocco che calcola `analiti` e `crmItemsFiltrati`):
```typescript
// ── Deriva mixLottoSel da removedMix ─────────────────────────────────────────
// Il lotto attivo di ogni firma è quello NON escluso da removedMix
const mixLottoSel = useMemo(() => {
  const m = new Map<string, string>()
  for (const a of analiti) {
    if (!a.mixId || !a.mixIds || a.mixIds.length <= 1) continue
    if (m.has(a.mixId)) continue
    const attivo = a.mixIds.find(mid => !removedMix.has(mid))
    if (attivo && attivo !== a.mixId) m.set(a.mixId, attivo)
  }
  return m
}, [analiti, removedMix])
```

**2b. Passare `mixLottoSel` a `GrigliaAnalitiCrm` (riga 1137, dopo `onChangeMixLotto`):**
```tsx
<GrigliaAnalitiCrm
  ...
  onChangeMixLotto={handleChangeMixLotto}
  mixLottoSel={mixLottoSel}   // aggiungere
/>
```

---

## Tabella correttezza useMemo

| Scenario | `removedMix` | `mixIds` | `mixLottoSel` risultante |
|---|---|---|---|
| Primo caricamento, nessuno scenario | `{}` | `[A, B]` | `{}` (A è default, nessun mapping) |
| Dopo aver scelto lotto B (post-reload) | `{A}` | `[A, B]` | `{firmaId → B}` ✓ |
| Dopo aver scelto lotto A (post-reload) | `{B}` | `[A, B]` | `{}` (A è default) ✓ |
| Mix completamente escluso | `{A, B}` | `[A, B]` | `{}` (non importa) ✓ |

---

## Verifica

1. Aprire Schema Calibrazione con un mix che ha 2+ lotti
2. Selezionare un lotto non-default dal dropdown → chip appare attiva
3. Ricaricare la pagina → chip deve ancora apparire attiva (non cancellata)
4. Aggiungere/importare una work → chips CRM non devono cambiare aspetto
