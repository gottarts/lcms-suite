# Piano: Extra analiti fuori schema in Work + chiarimento archivio

## Context

Quando si usa una work che include Mix o singoli CRM con composti non presenti nella lista analiti dello schema corrente, `ricostruisciWorkInSchema` salta silenziosamente quegli ingredienti (`if (!crm) continue`). Nella **vista SchemaCalibrazione** (chips sorgenti + DrawerDettaglioWork) quei composti scompaiono completamente.

L'utente vuole che questi "extra" (presenti nella work ma fuori schema) siano visibili e visivamente distinti.

**WorkDrawer in WorkPage** non ha questo problema: usa `buildCrmItems(workChain)` che legge `work_ingredienti` direttamente → mostra già tutti i composti. Nessuna modifica necessaria lì.

---

## Chiarimento archivio (risposta alla domanda)

La work è **parzialmente congelata**:
- `work_ingredienti` persiste: volumi, fattori di diluizione, conc_target, `lotto_usato` → rimangono
- La concentrazione del composto in stock (`source_cv`) viene **fetchata live** dal JOIN con `composti` ad ogni `work:get`
- Nel workflow normale i composti vengono **dismissi** (soft-delete), non fisicamente eliminati → la work archiviata rimane leggibile con tutti i dati

Risposta pratica: **sì, la work archiviata è "congelata"** nei suoi parametri operativi. Solo se si eliminasse fisicamente una riga da `composti` (cosa che non avviene nel workflow normale) si perderebbero nome e concentrazione di quell'ingrediente.

---

## Feature: mostrare analiti extra fuori schema

### Dove avviene il filtro

In `ricostruisciWorkInSchema` ([SchemaCalibrazione.logic.ts:360](src/renderer/pages/metodi/SchemaCalibrazione.logic.ts#L360)):
```typescript
const crm = crmItems.find(c => c.id === ing.source_id)
if (!crm) continue  // ← qui i composti non in schema vengono persi
```

`crmItems` viene da `composti:list-for-schema`: restituisce tutti i componenti di mix che contengono **almeno un** analita del metodo, più i singoli con nome in lista analiti. Se un mix ha zero analiti del metodo corrente, nessun suo componente finisce in `crmItems`.

### Dati disponibili per gli "extra"

L'IPC `work:get` joina `work_ingredienti` con `composti`, quindi ogni `ing` ha già:
- `source_nome`, `source_cv`, `source_mix_id`, `source_mix_nome`
- `volume_prelievo_ml`, `fattore_diluizione`, `conc_target_mgL`, `modo_calcolo`

Concentrazione nella work calcolabile:
- modo `dil`: `concInWork = source_cv / fattore_diluizione`
- modo `conc`: `concInWork = conc_target_mgL`
- fallback: `concInWork = source_cv`

---

## Modifiche pianificate

### 1. `src/renderer/pages/metodi/SchemaCalibrazione.types.ts`

Aggiungere a `WorkInSchema` (linea 38, dopo `vols`):
```typescript
extraSrcs?: Array<{ id: string; nome: string; tipo: 'mix' | 'sng' }>
```

Serve solo per i chip nella card (persistiti in schema_json all'import). Le concentrazioni nel drawer vengono calcolate dinamicamente (vedi punto 3).

### 2. `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts` — `ricostruisciWorkInSchema`

Invece del `continue` al punto `if (!crm)`, raccogliere gli extra:
- Per ingredienti con `source_mix_id`: raggruppare per mix (seenExtraMix), aggiungere una voce a `extraSrcs`
- Per singoli: aggiungere direttamente a `extraSrcs`
- Restituire `WorkInSchema` con `extraSrcs` popolato

### 3. `src/renderer/pages/metodi/SchemaCalibrazione.tsx` — `DrawerDettaglioWork`

**Compound list (sezione "extra")**:
- Aggiungere `useState<any>(null)` per `dbWork`
- Al mount (quando `work?.dbId` cambia), fetchare `workApi.get(work.dbId)` e storarlo
- Calcolare gli extra composti confrontando `dbWork.ingredienti` con gli `id` già coperti da `crmItems`
- Mostrarli dopo la lista normale con sfondo ambra `#fffbeb`, bordo `#f59e0b`, label "Non in questo schema"

```tsx
// Sezione extra nel drawer
{extraComps.length > 0 && (
  <>
    <Separator />
    <div style={{ fontSize:10, fontWeight:700, color:'#92400e', ... }}>
      Non in questo schema ({extraComps.length})
    </div>
    {extraComps.map((c, i) => (
      <div key={i} style={{ background:'#fffbeb', borderBottom:'1px solid #fde68a', ... }}>
        <div style={{ fontWeight:500, color:'#92400e' }}>⚠ {c.nome}</div>
        <div style={{ fontSize:10, color:'#b45309' }}>{c.srcNome}</div>
        <div style={{ fontFamily:'IBM Plex Mono', color:'#92400e' }}>
          {c.concInWork.toFixed(4)} {c.unita}
        </div>
      </div>
    ))}
  </>
)}
```

**Catena tracciabilità**:
- Dopo i nodi normali, mostrare `work.extraSrcs` con marker `▲` ambra invece del cerchio colorato
- Etichetta "(fuori schema)"

### 4. `src/renderer/pages/metodi/SchemaCalibrazione.tsx` — Work card chips (linea 281–289)

Dopo i chip normali delle sorgenti:
```tsx
{(w.extraSrcs ?? []).map(s => (
  <span key={s.id} style={{
    fontSize:9, fontFamily:'IBM Plex Mono, monospace',
    background:'#fef3c7', color:'#92400e',
    border:'1px solid #f59e0b',
    borderRadius:4, padding:'2px 6px',
  }} title="Presente nella work ma non in questo schema">
    ⚠ {s.nome}
  </span>
))}
```

---

## File da modificare

| File | Modifica |
|------|----------|
| `src/renderer/pages/metodi/SchemaCalibrazione.types.ts` | Aggiunge `extraSrcs` a `WorkInSchema` |
| `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts` | `ricostruisciWorkInSchema`: raccoglie extraSrcs invece di skippare |
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | (a) chip extra nella card; (b) sezione extra + chain nel drawer |

**NON si modifica**: `WorkDrawer.tsx`, `WorkPage.tsx`, `ImportaWorkDialog.tsx`, `work.ipc.ts`.

---

## Nota comportamento

- **Schemi esistenti** salvati prima di questa fix: `extraSrcs` sarà `undefined` → i chip extra non appariranno fino al prossimo re-import della work. Nessuna regressione (prima non venivano mostrati nemmeno).
- **Drawer**: usa fetch dinamico → mostra extra anche per schemi già salvati, senza bisogno di re-import.

---

## Verifica

1. Schema con analiti A, B. Work che usa Mix M1 (A,B) + Mix M2 (C,D con M2 non in lista analiti).
2. Dopo import: work card mostra chip normali per M1 + chip ambra ⚠ per M2.
3. Aprire DrawerDettaglioWork → sezione "Non in questo schema" mostra C, D con concentrazioni calcolate.
4. Catena tracciabilità mostra M2 con marcatore ⚠ amber.
5. In WorkPage → WorkDrawer: mostra tutti i composti (A,B,C,D) come prima, nessuna regressione.
