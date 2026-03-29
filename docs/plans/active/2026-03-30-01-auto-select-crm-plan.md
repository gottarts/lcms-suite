# Piano: Dialog Selezione Automatica CRM (Mix + Singoli)

## Context

Attualmente lo SchemaCalibrazione chiede all'utente di scegliere manualmente uno scenario di copertura (ScenarDialog) e poi selezionare manualmente i singoli CRM uno per uno. La richiesta è un sistema separato che calcola autonomamente la combinazione ottimale di CRM (mix + singoli) che massimizza la copertura degli analiti, rispettando la regola di disgiunzione, e la presenta in un dialog di conferma prima di applicarla.

**Logica algoritmica:**
1. Tra i mix disponibili, seleziona il sottoinsieme disgiunto che massimizza la copertura (= Scenario 1, già calcolato da `generaScenari`)
2. Per ogni analita ancora non coperto dai mix, auto-seleziona il primo CRM singolo disponibile (`sngIds[0]`)
3. Il dialog mostra cosa verrà selezionato, cosa verrà escluso, e la copertura finale

---

## File da creare/modificare

| File | Operazione |
|------|-----------|
| `src/renderer/pages/metodi/AutoSelectDialog.tsx` | **Nuovo** — dialog di conferma selezione automatica |
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | **Modifica** — aggiungere pulsante in bottom bar + stato dialog + handler |

---

## 1. Nuovo componente: AutoSelectDialog.tsx

### Props

```typescript
interface AutoSelectDialogProps {
  analiti: AnalitoItem[]
  crmItems: CrmItem[]
  firmaToMixIds: Map<string, string[]>
  mixNomiMap: Map<string, Set<string>>
  removedMix: Set<string>          // stato corrente (potrebbe già esserci uno scenario scelto)
  onClose: () => void
  onApply: (mixIds: string[], sngIds: string[]) => void
}
```

### Calcolo interno (useMemo)

```typescript
const risultato = useMemo(() => {
  // 1. Costruisci composizioni (come ScenarDialog)
  const comps = buildMixComposizioni(analiti, crmItems, firmaToMixIds, mixNomiMap)
    .filter(c => c.mixIds.some(mid => !removedMix.has(mid)))

  // 2. Scenario 1 = mix ottimali (massima copertura disgiunta)
  const scenari = generaScenari(analiti, comps)
  const scenario1 = scenari[0] ?? null

  // 3. Analiti coperti dai mix scelti
  const coperteDaMix = new Set<string>()
  const mixScelti: Array<{ nomeDisplay: string; analiti: string[] }> = []
  if (scenario1) {
    for (const comp of scenario1.composizioni) {
      const lotto = comp.mixIds.find(mid => !removedMix.has(mid))
      if (lotto) {
        const listaAnaliti = [...comp.analiti]
        for (const n of listaAnaliti) coperteDaMix.add(n)
        mixScelti.push({ nomeDisplay: comp.nomeDisplay, analiti: listaAnaliti })
      }
    }
  }

  // 4. Per analiti non coperti da mix: seleziona primo singolo disponibile
  const singoleScelti: Array<{ sngId: string; nome: string }> = []
  const nonCopertiNemmeno: string[] = []
  for (const a of analiti) {
    if (coperteDaMix.has(a.nome)) continue
    if (a.sngIds.length > 0) {
      singoleScelti.push({ sngId: a.sngIds[0], nome: a.nome })
    } else {
      nonCopertiNemmeno.push(a.nome)
    }
  }

  // 5. CRM esclusi = mix non nello scenario + singoli non scelti (ma disponibili)
  const mixIdSceltiSet = new Set(scenario1?.composizioni.flatMap(c =>
    c.mixIds.filter(mid => !removedMix.has(mid)).slice(0, 1)
  ) ?? [])
  const mixEsclusi = crmItems
    .filter(c => c.mix_id && !mixIdSceltiSet.has(c.mix_id))
    .reduce<string[]>((acc, c) => {
      if (c.mix && !acc.includes(c.mix)) acc.push(c.mix)
      return acc
    }, [])
  const sngIdSceltiSet = new Set(singoleScelti.map(s => s.sngId))
  const sngEsclusi = crmItems
    .filter(c => !c.mix_id && !sngIdSceltiSet.has(String(c.id)) && !coperteDaMix.has(c.nome))
    .map(c => c.nome)

  const copertaTotale = (coperteDaMix.size + singoleScelti.length) / analiti.length

  return {
    mixScelti,
    singoleScelti,
    nonCopertiNemmeno,
    mixEsclusi,
    sngEsclusi,
    copertaTotale,
    mixIds: [...mixIdSceltiSet],
    sngIds: singoleScelti.map(s => s.sngId),
  }
}, [analiti, crmItems, firmaToMixIds, mixNomiMap, removedMix])
```

### UI del dialog

Layout:
- **Header:** "Selezione automatica CRM" + sottotitolo copertura (es. "13/14 analiti — 93%")
- **Body scrollabile:**
  - Sezione "Mix selezionati" — lista con chip analiti per mix
  - Sezione "Singoli selezionati" — lista con nome analita
  - Sezione "Non coperti" (se presenti) — chip grigi
  - Sezione "Esclusi" — chip rossi/neutri per mix e singoli esclusi
- **Footer:** `[Annulla]` + `[Applica]`

### handleApply

```typescript
const handleApply = () => {
  onApply(risultato.mixIds, risultato.sngIds)
}
```

---

## 2. Modifiche a SchemaCalibrazione.tsx

### 2a. Stato dialog

```typescript
const [autoSelectOpen, setAutoSelectOpen] = useState(false)
```

### 2b. Pulsante in bottom bar (linee 1098-1139)

Aggiungere nella sezione sinistra della bottom bar (accanto a "Ricomincia da zero"):

```tsx
<button onClick={() => setAutoSelectOpen(true)} style={{
  padding:'5px 12px', borderRadius:8, border:`1px solid ${C.mix.border}`,
  background:C.page.sur, cursor:'pointer', fontSize:11,
  fontWeight:500, color:C.mix.text,
}}>Selezione automatica</button>
```

### 2c. Handler onApply

```typescript
const handleAutoSelect = useCallback((mixIds: string[], sngIds: string[]) => {
  // 1. Applica lo scenario mix (come handleApplyScenario)
  handleApplyScenario(mixIds)

  // 2. Aggiunge i singoli a selSrcs
  setSelSrcs(prev => {
    const m = new Map(prev)
    for (const sngId of sngIds) {
      const crm = crmItems.find(c => String(c.id) === sngId)
      if (crm) m.set(sngId, { id: sngId, nome: crm.nome, cv: crm.cv, tipo: 'sng' })
    }
    return m
  })

  setAutoSelectOpen(false)
}, [handleApplyScenario, crmItems])
```

### 2d. Rendering dialog

```tsx
{autoSelectOpen && (
  <AutoSelectDialog
    analiti={analitiAll}
    crmItems={crmItems}
    firmaToMixIds={firmaToMixIds}
    mixNomiMap={mixNomiMap}
    removedMix={removedMix}
    onClose={() => setAutoSelectOpen(false)}
    onApply={handleAutoSelect}
  />
)}
```

---

## Regole rispettate

- **Disgiunzione:** ereditata da `generaScenari` / Scenario 1
- **Mix > singolo:** i singoli vengono scelti solo per analiti NON coperti dai mix
- **Nessun duplicato analita:** per costruzione — mix disgiunti tra loro, singolo solo se analita non in mix
- **Scope isolato:** nessuna modifica a ScenarDialog, SchemaCalibrazione.scenari.ts, o altri moduli

---

## Verifica

1. Aprire SchemaCalibrazione con analiti e CRM (mix + singoli) presenti
2. Nella bottom bar compare il pulsante "Selezione automatica"
3. Cliccare → il dialog mostra mix selezionati, singoli integrativi, non coperti, esclusi
4. Cliccare "Applica" → `selSrcs` viene popolato con i mix e singoli calcolati; `removedMix` aggiornato
5. Cliccare "Annulla" → nessuna modifica
6. Verificare che analiti coperti da mix non abbiano anche il singolo selezionato
7. Verificare che analiti non coperti da mix abbiano il singolo selezionato (se disponibile)
