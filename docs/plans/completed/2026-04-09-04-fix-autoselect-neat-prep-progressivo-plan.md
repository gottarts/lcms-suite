# Piano: Selezione automatica Neat con preparato a progressivo maggiore

## Context

La selezione automatica nello SchemaCalibrazione seleziona i CRM singoli (inclusi i Neat) aggiungendoli come `tipo: 'sng'`. Tuttavia, per i CRM di tipo Neat non viene selezionato automaticamente il preparato stock (prep). L'utente deve cliccare manualmente sul chip del preparato dopo l'auto-select.

Il comportamento corretto: quando l'auto-select sceglie un CRM Neat, deve anche selezionare automaticamente il suo preparato con progressivo più alto (il più recente).

---

## Analisi del codice

### Flusso attuale
1. `AutoSelectDialog.tsx` calcola `sngIds` (lista di ID CRM singoli da selezionare)
2. `handleAutoSelect` in `SchemaCalibrazione.tsx:1076` riceve `(mixIds, sngIds)` e chiama `setSelSrcs`
3. Per i singoli: `m.set(sngId, { id: sngId, nome: crm.nome, cv: crm.cv, tipo: 'sng' })` — tipo `'sng'`, senza prep

### Struttura dati Neat
- `CrmItem.prepStock?: PrepStockItem[]` — caricato in `SchemaCalibrazione.logic.ts`
- `PrepStockItem.progressivo: number | null` — numero ordinale crescente
- `prepKey = 'prep_${prep.id}'` — chiave usata in `selSrcs`
- La `SorgenteSel` per prep: `{ id: prepKey, nome: crmNome, cv, tipo: 'prep', prepId: prep.id, lotto, flacone, progressivo }`

---

## Soluzione

### File da modificare: `SchemaCalibrazione.tsx:1089-1092`

Nel `handleAutoSelect`, dopo aver trovato il CRM singolo, verificare se è Neat (`forma === 'neat'`):
- Se Neat con preparati: scegliere il preparato con `progressivo` più alto (o fallback al primo della lista se progressivo è null), e aggiungerlo come `tipo: 'prep'` invece di `tipo: 'sng'`
- Se Neat senza preparati: aggiungere come `tipo: 'sng'` (comportamento attuale, non c'è un preparato da selezionare)
- Se non Neat: comportamento attuale (`tipo: 'sng'`)

### Codice da modificare

**Prima** (linee 1089-1092):
```typescript
for (const sngId of sngIds) {
  const crm = crmItems.find(c => String(c.id) === sngId)
  if (crm) m.set(sngId, { id: sngId, nome: crm.nome, cv: crm.cv, tipo: 'sng' })
}
```

**Dopo**:
```typescript
for (const sngId of sngIds) {
  const crm = crmItems.find(c => String(c.id) === sngId)
  if (!crm) continue
  const isNeat = String(crm.forma ?? '').toLowerCase() === 'neat'
  const preps = crm.prepStock ?? []
  if (isNeat && preps.length > 0) {
    // Seleziona il preparato con progressivo maggiore
    const prep = preps.reduce((best, p) =>
      (p.progressivo ?? 0) > (best.progressivo ?? 0) ? p : best
    )
    const cv = (prep.concReale ?? prep.concTarget ?? (prep.conc != null ? Number(prep.conc) : 0)) || 0
    const prepKey = `prep_${prep.id}`
    m.set(prepKey, { id: prepKey, nome: crm.nome, cv, tipo: 'prep', prepId: prep.id, lotto: crm.lotto ?? null, flacone: prep.flacone ?? null, progressivo: prep.progressivo ?? null })
  } else {
    m.set(sngId, { id: sngId, nome: crm.nome, cv: crm.cv, tipo: 'sng' })
  }
}
```

---

## File critici

- `src/renderer/pages/metodi/SchemaCalibrazione.tsx` — `handleAutoSelect` linee 1076-1096 (unico file da modificare)

---

## Verifica

1. Aprire SchemaCalibrazione per un metodo con almeno un CRM Neat che ha preparati stock
2. Cliccare "Selezione automatica"
3. Confermare con "Applica"
4. Verificare che nel drawer laterale appaia il preparato Neat con `prep #N da lotto X · Neat` (non come semplice CRM singolo)
5. Se il Neat ha più preparati, verificare che sia selezionato quello con progressivo maggiore
6. Se il Neat non ha preparati, verificare che venga aggiunto comunque come singolo (nessuna regressione)
