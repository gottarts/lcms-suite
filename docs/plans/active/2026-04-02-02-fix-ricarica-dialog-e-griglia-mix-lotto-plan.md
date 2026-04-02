# Piano: Fix RicaricaDialog — CRM mix scaduti + tasto Ricarica work importate

## Context

Due bug segnalati nello SchemaCalibrazione:
1. Il tasto "Ricarica ↻" su work importate (o qualsiasi work con CRM scaduti) non permette di selezionare il nuovo lotto — il bottone "Conferma e Ricarica" resta disabilitato.
2. Quando si seleziona un lotto per un CRM mix nel RicaricaDialog, la CRM mix sembra "cancellarsi" (il select si resetta al placeholder come se si fosse premuto la X).

Entrambi i bug sono in `RicaricaDialog.tsx` e hanno la stessa root cause.

---

## Root Cause

### Bug 1: `tuttiRisolti` rimane `false` dopo selezione CRM mix

**Logica attuale** (righe 89-94):
```typescript
const tuttiRisolti = daRisolvere.every(i => {
  if (i.stato === 'auto') return true
  if (i.stato === 'ambiguo') return scelte[i.source_id] != null
  return false
})
```

Questa logica lavora su `lotStatus` (ingredienti individuali). Per un CRM mix, ci sono N ingredienti con lo stesso `mix_id`. `handleMixScelta` popola `scelte` per ogni membro del gruppo cercando il sostituto con `s.mix_id === value`. Se un membro non trova il sostituto con quel `mix_id` esatto (possibile perché il backend cerca sostituti per `nome` individuale), `scelte[member.source_id]` resta undefined → `tuttiRisolti = false`.

### Bug 2: Select si resetta dopo selezione

`getMixSceltaAttuale` restituisce un valore (es. il `mix_id` del sostituto scelto). Se questo valore non corrisponde a nessuna `<option>` nel select (ad es. perché `getMixOpzioni` costruisce le opzioni dal primo membro ambiguo, non dal membro che ha trovato la scelta), il `<select>` nativo con `value` non valido si comporta in modo imprevedibile — visivamente il dropdown torna al placeholder, sembrando una "cancellazione".

---

## Fix Chirurgico — Solo `RicaricaDialog.tsx`

### 1. Spostare il calcolo di `tuttiRisolti` dopo `buildGroups` e farlo lavorare a livello di gruppi

**Attuale posizione**: righe 89-95 (prima di `buildGroups` a riga 169).

**Nuovo approccio**: calcolare `groups` prima, poi usarli per `tuttiRisolti`:

```typescript
const groups = buildGroups(lotStatus)
const groupsOk = groups.filter(g => g.stato === 'ok')
const groupsAuto = groups.filter(g => g.stato === 'auto')
const groupsAmbiguo = groups.filter(g => g.stato === 'ambiguo')
const groupsMancante = groups.filter(g => g.stato === 'mancante')

const daRisolvere = lotStatus.filter(i => i.stato !== 'ok')
const haMancanti = daRisolvere.some(i => i.stato === 'mancante')
const tuttiRisolti = daRisolvere.length > 0 &&
  groups.filter(g => g.stato !== 'ok' && g.stato !== 'mancante').every(g => {
    if (g.stato === 'auto') return true
    if (g.stato === 'ambiguo') {
      if (g.mix_id) return getMixSceltaAttuale(g) !== ''
      return scelte[g.members[0].source_id] != null
    }
    return false
  })
```

Nota: `getMixSceltaAttuale` e `getMixOpzioni` devono essere definite **prima** di questo blocco di calcolo (attualmente lo sono già alla riga 136-167). Verifica l'ordine nel file.

### 2. Aggiungere fallback in `handleMixScelta` per membri senza sostituto diretto

Quando `member.sostituti.find(s => s.mix_id === value)` non trova nulla, cercare il primo sostituto con qualsiasi `mix_id` non nullo (fallback conservativo):

```typescript
const handleMixScelta = (group: MixGroup, value: string) => {
  const newScelte: Record<number, number> = { ...scelte }
  const isSingle = value.startsWith('single:')
  const singleId = isSingle ? Number(value.slice(7)) : null

  for (const member of group.members) {
    let sostituto: any
    if (isSingle) {
      sostituto = member.sostituti.find((s: any) => s.id === singleId)
    } else {
      sostituto = member.sostituti.find((s: any) => s.mix_id === value)
      // Fallback: se il membro non ha sostituti con quel mix_id esatto,
      // prendi il primo sostituto con qualsiasi mix_id non nullo
      if (!sostituto) {
        sostituto = member.sostituti.find((s: any) => s.mix_id != null)
      }
    }
    if (sostituto) {
      newScelte[member.source_id] = sostituto.id
    }
  }
  setScelte(newScelte)
}
```

### 3. Aggiungere guard in `getMixSceltaAttuale` per valori non validi

Verificare che il valore restituito corrisponda a un'opzione valida nel dropdown, altrimenti restituire `''`:

```typescript
const getMixSceltaAttuale = (group: MixGroup): string => {
  const opzioni = getMixOpzioni(group)
  const valoriValidi = new Set(opzioni.map(o => o.mix_id ?? `single:${o.id}`))
  for (const member of group.members) {
    const chosenId = scelte[member.source_id]
    if (chosenId != null) {
      const sostituto = member.sostituti.find((s: any) => s.id === chosenId)
      if (sostituto) {
        const val = sostituto.mix_id ? sostituto.mix_id : `single:${sostituto.id}`
        if (valoriValidi.has(val)) return val
      }
    }
  }
  return ''
}
```

---

## File da modificare

- **`src/renderer/pages/work/RicaricaDialog.tsx`** — unico file modificato
  - Spostare `const groups = buildGroups(lotStatus)` e derivati prima del blocco `tuttiRisolti`
  - Riscrivere `tuttiRisolti` per lavorare a livello di gruppi
  - Aggiungere fallback in `handleMixScelta`
  - Aggiungere guard in `getMixSceltaAttuale`
  - Rimuovere il blocco `groups` duplicato (attualmente riga 169-173 che ora sarà già calcolato prima)

Nessuna modifica a `SchemaCalibrazione.tsx` o al backend.

---

## Verifica

1. Aprire SchemaCalibrazione con una work che ha CRM scaduti (incluso un CRM mix scaduto)
2. Cliccare "Ricarica ↻" → si apre RicaricaDialog
3. Se il CRM mix è in stato 'ambiguo': selezionare un lotto dal dropdown → il select deve mantenere la scelta (non resetparsi)
4. Il bottone "Conferma e Ricarica" deve abilitarsi dopo la selezione
5. Confermare → la work viene aggiornata correttamente
6. Ripetere con una work importata (stessa procedura)
