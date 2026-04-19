# Piano: Fix ha_prep_scadute_at_data — filtro per analiti del metodo auditato

## Context

Nel dialog/PDF di audit, il badge "⚠ Prep Neat scadute" (e il flag PREP SCAD nel PDF) si attiva
quando `ha_prep_scadute_at_data = true`. Questo valore viene calcolato dalla query SQL in
`dashboard.ipc.ts:178-186` contando **tutte** le prep scadute usate dalla work, indipendentemente
dal metodo auditato. Di conseguenza, una work mostra il flag anche quando le prep scadute coprono
solo analiti che non appartengono al metodo in esame.

La fix corretta è ricalcolare `ha_prep_scadute_at_data` nel frontend, dopo che è già stato
costruito l'array `coperti` (analiti del metodo con le loro prep). Solo così si sa se almeno una
prep scaduta copre un analita del metodo auditato.

## File da modificare

- `src/renderer/pages/dashboard/lib/auditModel.ts` — unico file da toccare

## Modifica

**Posizione:** riga 292, nel blocco che costruisce l'oggetto da pushare in `righe_work`.

**Logica attuale:**
```ts
ha_prep_scadute_at_data: !!wRaw.ha_prep_scadute_at_data,
```

**Nuova logica** — ricalcola dal basso, guardando solo gli analiti coperti:
```ts
ha_prep_scadute_at_data: coperti.some(a =>
  a.crm_ingredienti.some(c => c.prep_scaduta === true)
),
```

Questo usa esattamente i dati già calcolati: `coperti` contiene solo gli analiti del metodo
auditato, e ciascun `crm_ingrediente` ha `prep_scaduta` (booleano) già impostato correttamente
in `prepInfoByCompostoId` (righe 212-221).

## Nessuna modifica a

- Query SQL in `dashboard.ipc.ts` — `n_prep_scadute_at_data` può restare (non causa danni,
  è solo inutilizzato per questo calcolo)
- `AuditCrmSection.tsx`, `auditReport.ts` — consumano `ha_prep_scadute_at_data` già corretto

## Verifica

1. Aprire il dialog di audit per il metodo che mostra la work FFFF con "VALIDA PREP SCADUTE"
2. Verificare che il badge "⚠ Prep Neat scadute" scompaia (nessun analita della prep scaduta
   25DILE188A_finto appartiene al metodo auditato)
3. Creare una work di test con una prep scaduta il cui analita IS nel metodo → il badge deve
   comparire correttamente
