# Piano: Fix bug audit CRM — scadenza prep errata + badge "Prep Neat scadute" falso positivo

## Context

L'utente ha rilevato due discrepanze tra WorkPage e Audit CRM per la stessa prep Neat:

- **WorkPage** mostra: `prep #5 da lotto 91027 · Neat · scad. 10/05/2026`
- **Audit** mostra: `⚠ Prep Neat scadute` + `prep: 5 · 2026-04-08 · scad. 2026-04-05`

Ci sono **due bug separati ma collegati**.

---

## Bug #1 — `auditModel.ts`: la prep scaduta sovrascrive quella valida

### Causa

In `src/renderer/pages/dashboard/lib/auditModel.ts` righe 210–220:

```typescript
const scaduta = !!(ing.source_prep_scadenza && ing.source_prep_scadenza < input.data)
const existing = prepInfoByCompostoId.get(found.id)
if (!existing || (scaduta && !existing.scaduta)) {
  prepInfoByCompostoId.set(found.id, { ... })
}
```

La logica dice: *"se la nuova è scaduta e quella esistente non lo è, sovrascrivi"*. 

**Problema**: l'intento era "tieni la più problematica", ma la condizione è **invertita**. Se l'iterazione incontra prima la prep valida (scad. 2026-05-10) e poi una prep scaduta (scad. 2026-04-05 — magari una vecchia versione dello stesso ingrediente), la scaduta **sovrascrive** quella valida. Il risultato è che l'audit mostra la scadenza sbagliata e triggera il warning.

### Scenario concreto

Il work ha due ingredienti `source_type='prep'` per lo stesso composto (Terbutilazina D5 5mg):
- Ingrediente A: prep flacone 5, scad. 2026-05-10 (attiva, valida)
- Ingrediente B: prep flacone ?, scad. 2026-04-05 (scaduta — una prep più vecchia o dismessa)

L'audit itera entrambi. Prima mappa la prep valida. Poi, quando incontra la scaduta, la sovrascrive perché `scaduta && !existing.scaduta` è true.

### Fix

La logica corretta è: tenere la prep con la scadenza **più recente** (o che sia attiva alla data dell'audit), NON dare precedenza a quella scaduta. Il badge `ha_prep_scadute_at_data` viene già calcolato correttamente via SQL in `dashboard.ipc.ts` (riga 178–186), quindi la UI del badge è affidabile. 

Il display della prep nel badge CRM deve mostrare la prep **effettivamente in uso** alla data, non la più problematica. La condizione deve essere cambiata in: mantieni quella con scadenza più recente (o quella non scaduta se c'è).

Nuova logica:
```typescript
if (!existing || (!existing.scaduta && scaduta)) {
  // già sbagliata — non fare nulla se scaduta sovrascrive non-scaduta
}
// Logica corretta: tieni quella NON scaduta; a parità, tieni la più recente
if (!existing || (scaduta === existing.scaduta 
    ? (ing.source_prep_scadenza ?? '') > (existing.scadenza ?? '')
    : !scaduta)) {
  prepInfoByCompostoId.set(found.id, { ... })
}
```

Ovvero: **preferisci quella non scaduta; a parità di stato, tieni quella con scadenza più lontana (più recente)**.

---

## Bug #2 — `dashboard.ipc.ts`: `n_prep_scadute_at_data` conta prep dismesse

### Causa

In `src/main/ipc/dashboard.ipc.ts` righe 178–186, il conteggio `n_prep_scadute_at_data` include prep con `p.data_dismissione IS NULL OR p.data_dismissione > @data` — il che è corretto come filtro, ma il campo `ha_prep_scadute_at_data` viene poi usato per il badge `⚠ Prep Neat scadute`. 

Problema: se nel work ci sono ingredienti che puntano a prep vecchie (scadute e dismesse prima della data audit), il conteggio le include perché il filtro `p.data_dismissione IS NULL OR p.data_dismissione > @data` esclude solo quelle dismesse **dopo** la data, non quelle dismesse **prima**. 

Attesa: una prep dismessa prima della data audit NON dovrebbe contribuire al badge "scaduta".

### Fix

Aggiungere alla condizione `n_prep_scadute_at_data`: escludere prep dismesse prima della data audit.

La condizione esistente è già:
```sql
AND (p.data_dismissione IS NULL OR p.data_dismissione > @data)
```
Questo **è già corretto** — esclude prep dismesse prima di `@data`. Quindi questo filtro in realtà va bene.

Il problema reale potrebbe essere che nella work esistono ingredienti `source_type='prep'` che puntano a prep scadute **non dismesse**. Il badge è allora tecnicamente corretto SQL-side, ma l'utente vede la scadenza sbagliata nel badge CRM (a causa del Bug #1). 

**Conclusione**: il Bug #2 si risolve correggendo solo il Bug #1.

---

## File da modificare

1. **`src/renderer/pages/dashboard/lib/auditModel.ts`** — riga 212–219
   - Cambiare la logica di `prepInfoByCompostoId` per preferire la prep non scaduta (o con scadenza più recente)

---

## Step di implementazione

Modificare la condizione in `auditModel.ts` righe 212–219:

**Prima:**
```typescript
const existing = prepInfoByCompostoId.get(found.id)
if (!existing || (scaduta && !existing.scaduta)) {
  prepInfoByCompostoId.set(found.id, {
    flacone: ing.source_prep_flacone ?? null,
    data_prep: ing.source_prep_data_prep ?? null,
    scadenza: ing.source_prep_scadenza ?? null,
    scaduta,
  })
}
```

**Dopo:**
```typescript
const existing = prepInfoByCompostoId.get(found.id)
// Preferisci: (1) quella non scaduta sulla scaduta; (2) a parità, quella con scadenza più recente
const betterThanExisting = !existing
  || (!scaduta && existing.scaduta)
  || (scaduta === existing.scaduta && (ing.source_prep_scadenza ?? '') > (existing.scadenza ?? ''))
if (betterThanExisting) {
  prepInfoByCompostoId.set(found.id, {
    flacone: ing.source_prep_flacone ?? null,
    data_prep: ing.source_prep_data_prep ?? null,
    scadenza: ing.source_prep_scadenza ?? null,
    scaduta,
  })
}
```

---

## Verifica

- Riaprire audit CRM per il metodo e la data in questione (oggi 2026-04-16)
- Il badge CRM per Terbutilazina D5 5mg deve mostrare `scad. 2026-05-10` (allineato con WorkPage)
- Il badge `⚠ Prep Neat scadute` non deve più comparire falsamente
- Se ci sono prep davvero scadute alla data audit, il badge deve ancora comparire
