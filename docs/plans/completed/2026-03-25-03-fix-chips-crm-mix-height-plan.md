# Piano: Ridisegno layout chips SchemaCalibrazione.grid.tsx

## Contesto

Il layout delle chips nella griglia analiti/CRM ha problemi di sizing adattivo. L'utente ha definito regole precise su come devono comportarsi le righe e le chips in base al tipo di CRM (solo singoli, solo mix, entrambi). Il sistema attuale non gestisce correttamente il caso in cui la chips del mix sia più alta della somma delle righe che la ospitano.

## Regole di layout richieste

### Ordinamento analiti (già gestito, verificare)
1. **Solo singoli** — in cima
2. **Entrambi (mix + singoli)** — al centro
3. **Solo mix** — in fondo

### Calcolo altezze (il problema centrale)

**Altezza della chips CRM mix:**
- Si adatta al suo contenuto (chip componenti + header)
- Occupa verticalmente la somma delle righe degli analiti che appartengono al mix

**Altezza delle righe analita:**
- Per analiti con solo singoli: `max(1, nSingoli) * ROW`
- Per analiti con mix: decisa dal max tra (somma singoli) e (altezza chips mix / nAnaliti)
- **CASO CRITICO**: se la chips del mix è più grande della somma delle righe → le righe analita si espandono per riempire lo spazio, con il testo dell'analita centrato verticalmente

**Formula corretta:**
```
altezzaChipsMix = calcola dal contenuto (già fatto con mixPerRowH)
sommaRigheBase  = somma di max(1, nSngIds) * ROW per ogni analita del mix
altezzaEffettiva = max(sommaRigheBase, altezzaChipsMix)
altezzaPerRiga  = distribuzione proporzionale (default: equa)
```

**Problema attuale:** `mixPerRowH[mixId]` è calcolato come `minH / nAna` e poi usato in `rowHeight()` per ogni riga — questo divide l'altezza uniformemente ma **ignora che ogni analita può avere un numero diverso di singoli**. E soprattutto non garantisce che la somma delle righe ≥ altezza della chips.

## Approccio di implementazione

### File da modificare
- `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx` (linee 96-145)

### Strategia

Sostituire il calcolo `mixPerRowH` con un calcolo a due fasi:

**Fase 1: Calcola `mixChipsH[mixId]`** — altezza totale necessaria per la chips del mix (contenuto):
```typescript
// Formula attuale (linea 110) → portare al livello di mix, non per-riga:
const mixChipsH: Record<string, number> = {}
for (const [mixId, comps] of mixAllComps.entries()) {
  // ... stessa simulazione flex-wrap
  mixChipsH[mixId] = 62 + cr * 18 + 20  // totale (NON diviso per nAna)
}
```

**Fase 2: Calcola altezze righe per mix** — garantendo che la somma ≥ `mixChipsH[mixId]`:
```typescript
// Per ogni mix, calcola le altezze naturali di ogni riga analita:
//   natural[i] = max(1, a.sngIds.length) * ROW
// Se somma(natural) >= mixChipsH → OK, usa natural
// Se somma(natural) < mixChipsH  → scala ogni riga proporzionalmente
//                                   (o distribuisce il surplus equamente)

const mixRowHeights = new Map<string, number[]>() // mix_id → [h per ogni analita del mix]
for (const [mixId, anaArr] of mixAnaliti.entries()) {
  const chipH = mixChipsH[mixId] ?? 0
  const naturals = anaArr.map(nome => {
    const a = analiti.find(x => x.nome === nome)!
    return Math.max(1, a.sngIds.length) * ROW
  })
  const sumNat = naturals.reduce((s, h) => s + h, 0)
  if (sumNat >= chipH) {
    mixRowHeights.set(mixId, naturals)
  } else {
    // Scala proporzionalmente per riempire chipH
    const scale = chipH / sumNat
    mixRowHeights.set(mixId, naturals.map(h => Math.round(h * scale)))
  }
}
```

**Fase 3: `rowHeight(a)` usa `mixRowHeights`:**
```typescript
const rowHeight = (a: AnalitoItem): number => {
  if (!a.mixId) return Math.max(1, a.sngIds.length) * ROW
  const anaArr = mixAnaliti.get(a.mixId) ?? []
  const idx    = anaArr.indexOf(a.nome)
  const heights = mixRowHeights.get(a.mixId)
  if (heights && idx >= 0) return heights[idx]
  return Math.max(1, a.sngIds.length) * ROW
}
```

**Fase 4: `mixHeightPx[mixId]`** — già calcolato come somma delle righe nel loop `cumY`, quindi sarà automaticamente corretto (= `mixChipsH[mixId]` nel caso di espansione).

### Punti critici

- La cella analita usa già `display:'flex', alignItems:'center'` → il testo sarà centrato automaticamente anche con altezze maggiori. ✓
- I singoli usano `justifyContent:'center'` sul container → le cards singole saranno già centrate. ✓
- Non serve modificare il rendering JSX, solo il calcolo delle altezze.

### Caso edge: analiti con numero diverso di singoli nello stesso mix
- Es: analita A ha 2 singoli (naturale: 96px), analita B ha 0 singoli (naturale: 48px)
- Se la chips richiede 180px totali → somma naturale = 144px < 180px → scala tutto ×1.25 → A=120px, B=60px
- La proporzione originale viene preservata ✓

## Verifica

1. Aprire SchemaCalibrazione con un metodo che ha mix coprente pochi analiti (es. 1 analita con mix che ha tanti componenti)
2. Verificare che la chips del mix non sia troncata verticalmente
3. Verificare che la riga analita si espanda per contenere tutta la chips
4. Verificare che analiti con solo singoli non siano affetti
5. Verificare che il caso "mix + singoli sullo stesso analita" mostri sia la chips che le cards singole con altezze corrette
