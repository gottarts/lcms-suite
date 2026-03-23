# Piano: CRM SchemaCalibrazione — sorgente per nome analita, mix completi

## Contesto

**Problema:** SchemaCalibrazione carica i CRM con `composti:list({ metodo_id })` → JOIN su `composti_metodi`. Quando un analita viene rimosso dal metodo, `metodo-analiti:remove` cancella anche i link `composti_metodi` → i CRM spariscono dallo schema.

**Logica desiderata:**
- **Analiti** = da `metodo_analiti` (righe della griglia, sottoinsieme dei CRM)
- **CRM** = tutti i composti il cui nome è un analita del metodo + **tutti i componenti di ogni mix che contiene almeno un analita**. Se un mix ha 1000 componenti e uno è un analita, tutto il mix deve apparire nello schema.
- I dettagli (work, drawer) devono mostrare il **contenuto reale** di ogni CRM/mix
- Lo schema non deve dipendere da `composti_metodi` per i CRM

**Esempio:** Metodo ha analiti X, Y, Z. Mix "BTEX" contiene X, Y, W, K. → Lo schema mostra il mix BTEX con tutti e 4 i componenti. X e Y sono analiti (hanno la loro riga), W e K appaiono come contenuto del mix nei dettagli.

## Approccio

Nuovo handler IPC `composti:list-for-schema` con query in due passi:
1. Trova tutti i singoli CRM il cui nome è un analita
2. Trova tutti i `mix_id` di mix che contengono almeno un analita → carica TUTTI i componenti di quei mix

## Modifiche

### 1. Nuovo IPC handler `composti:list-for-schema`
**File:** [composti.ipc.ts](src/main/ipc/composti.ipc.ts) — aggiungere dopo `composti:list` (riga ~98)

```typescript
ipcMain.handle('composti:list-for-schema', (_, metodoId: string) => {
  const db = getDb()
  // Nomi degli analiti del metodo (lowercase per match case-insensitive)
  const analitiNomi = db.prepare(
    'SELECT LOWER(nome) AS nome FROM metodo_analiti WHERE metodo_id = ?'
  ).all(metodoId).map((r: any) => r.nome as string)

  if (analitiNomi.length === 0) return []

  // Trova i mix_id di mix che contengono almeno un analita
  const placeholders = analitiNomi.map(() => '?').join(',')
  const mixIds = db.prepare(`
    SELECT DISTINCT mix_id FROM composti
    WHERE mix_id IS NOT NULL AND LOWER(nome) IN (${placeholders})
  `).all(...analitiNomi).map((r: any) => r.mix_id as string)

  // Query finale: singoli con nome analita + TUTTI i componenti dei mix trovati
  let sql = `
    SELECT c.*,
      (SELECT COUNT(*) FROM preparazioni
       WHERE composto_id = c.id AND stato = 'Attiva') AS prep_attive_count,
      (SELECT COUNT(*) FROM preparazioni
       WHERE composto_id = c.id AND stato = 'Attiva' AND scadenza < date('now')) AS prep_scadute_count,
      (SELECT GROUP_CONCAT(metodo_id) FROM composti_metodi
       WHERE composto_id = c.id) AS metodi_ids_raw
    FROM composti c
    WHERE `

  const params: string[] = []

  if (mixIds.length > 0) {
    const mixPh = mixIds.map(() => '?').join(',')
    sql += `(c.mix_id IS NULL AND LOWER(c.nome) IN (${placeholders}))
            OR (c.mix_id IN (${mixPh}))`
    params.push(...analitiNomi, ...mixIds)
  } else {
    sql += `c.mix_id IS NULL AND LOWER(c.nome) IN (${placeholders})`
    params.push(...analitiNomi)
  }

  sql += ' ORDER BY c.id ASC'
  return db.prepare(sql).all(...params)
})
```

**Logica:**
- Singoli (mix_id IS NULL): solo quelli il cui nome è un analita
- Mix: trova i mix_id che contengono almeno un analita → carica TUTTI i componenti del mix (anche non-analiti)

### 2. API frontend
**File:** [api.ts](src/renderer/lib/api.ts) — aggiungere a `compostiApi` (dopo riga 39)

```typescript
listForSchema: (metodoId: string) =>
  api.invoke('composti:list-for-schema', metodoId) as Promise<any[]>,
```

### 3. useSchemaData() — cambiare sorgente CRM
**File:** [SchemaCalibrazione.logic.ts](src/renderer/pages/metodi/SchemaCalibrazione.logic.ts) — righe 31-33

Da:
```typescript
const rows: any[] = await (window as any).electronAPI.invoke(
  'composti:list', { metodo_id: metodoId }
)
```
A:
```typescript
const rows: any[] = await (window as any).electronAPI.invoke(
  'composti:list-for-schema', metodoId
)
```

Il resto del hook (filtro dismessi/scaduti, mapping CrmItem, costruzione AnalitoItem) funziona senza modifiche perché:
- I singoli CRM hanno nome = analita → match con `sngMap`
- I mix hanno componenti con nome = analita → match con `mixMap`
- I componenti non-analita del mix finiscono in `crmItems` ma non hanno riga in `analiti` → sono disponibili per `getCompsFromWork()` quando si calcolano i dettagli reali

### 4. MetodoDrawer — "Analiti del metodo"
**File:** [MetodoDrawer.tsx](src/renderer/pages/metodi/MetodoDrawer.tsx)

Cambiamento: caricare da `metodoAnalitiApi.list(metodoId)` invece di `compostiApi.list({ metodo_id })`.

- Import: aggiungere `metodoAnalitiApi` da `@/lib/api`
- State: `analiti: {id: number; nome: string}[]` al posto di `composti: any[]`
- useEffect: `metodoAnalitiApi.list(metodoId)` — nessun bisogno di controllare `metodo.composti_ids` prima
- Rimuovere `compostiPerNome` useMemo (non serve più raggruppamento lotti)
- Header: "Analiti del metodo (N)" invece di "Composti associati (N sostanze, M lotti)"
- Badge: un badge per analita, mantiene click → navigazione a `/composti` con `searchFilter`

## File modificati (4 totali)

| File | Modifica | Rischio |
|------|----------|---------|
| [composti.ipc.ts](src/main/ipc/composti.ipc.ts) | Nuovo handler `composti:list-for-schema` | Basso — handler nuovo |
| [api.ts](src/renderer/lib/api.ts) | Aggiunta `listForSchema` a `compostiApi` | Basso — additivo |
| [SchemaCalibrazione.logic.ts](src/renderer/pages/metodi/SchemaCalibrazione.logic.ts) | 1 riga: cambio invoke | Basso — stessa forma dati |
| [MetodoDrawer.tsx](src/renderer/pages/metodi/MetodoDrawer.tsx) | Sorgente dati analiti, label aggiornata | Medio — UI isolata |

## Cosa NON cambia

- `composti:list` — invariato (usato da MetodoForm, CompostiPage, ecc.)
- `metodo-analiti:remove` — invariato (pulizia `composti_metodi` è corretta per DB Composti)
- `metodi:update` — invariato
- `getCompsFromWork()` — invariato (riceve `crmItems` che ora include tutti i componenti mix)
- Work già create — invariate nel `schema_json`
- `GrigliaAnalitiCrm` — invariata (riceve `analiti` e `crmItems` come props)

## Verifica

1. Aprire SchemaCalibrazione di un metodo con CRM mix e singoli
2. Verificare che tutti i CRM appaiano — inclusi componenti non-analita dei mix
3. Rimuovere un analita dal metodo (da MetodoForm)
4. Riaprire SchemaCalibrazione — il CRM/mix che contiene l'analita rimosso scompare SOLO se nessun altro analita del metodo è contenuto in quel mix
5. Aggiungere un composto in DB Composti con nome di un analita del metodo ma SENZA linkarlo via `composti_metodi` → deve apparire come CRM nello schema
6. Creare una work da un mix con componenti non-analita → verificare che i dettagli work mostrino tutti i componenti reali
7. MetodoDrawer mostra "Analiti del metodo (N)" con i nomi corretti da `metodo_analiti`
