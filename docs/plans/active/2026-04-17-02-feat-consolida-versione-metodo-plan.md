# Piano: Consolida Versione Metodo Analiti

## Context

Il sistema di versionamento analiti (`metodo_analiti_versioni`, introdotto nella sessione precedente) crea uno snapshot JSON completo per ogni singola mutazione (add, remove, update, bulk-accreditato, bulk-alias). Durante la messa a punto di un metodo, l'operatore può fare decine di piccole modifiche generando troppe versioni intermedie inutili ai fini dell'audit.

Serve un'operazione **"Consolida versione"** che:
- Elimini tutte le versioni intermedie dall'ultimo consolidamento
- Lasci solo i punti fermi (consolidamenti precedenti + seed iniziale)
- Avvisi chiaramente l'operatore che le versioni eliminate non saranno più auditabili

**Workflow operatore:**
1. Modifiche al metodo (aggiungi/togli analiti, aggiorna alias, ecc.)
2. Click "Consolida versione" → warning → conferma
3. Versioni intermedie eliminate, nuovo snapshot consolidato creato
4. Ripetere

## Implementazione

### 1. Backend — `metodo-analiti:consolida`

**File:** `src/main/ipc/metodo-analiti.ipc.ts`

```typescript
ipcMain.handle('metodo-analiti:consolida', (_, metodoId: string) => {
  const db = getDb()
  db.transaction(() => {
    db.prepare(`
      DELETE FROM metodo_analiti_versioni
      WHERE metodo_id = ?
        AND motivo NOT IN ('consolida', 'migration-seed')
    `).run(metodoId)
    snapshotMetodoAnaliti(db, metodoId, 'consolida')
  })()
  return { ok: true }
})
```

**Logica DELETE:** elimina tutte le versioni con motivo diverso da `'consolida'` e `'migration-seed'`. La storia risultante è: seed + catena di consolidamenti. L'audit trova sempre il consolidamento più recente <= data audit.

### 2. Frontend API — `src/renderer/lib/api.ts`

```typescript
consolida: (metodoId: string) =>
  api.invoke('metodo-analiti:consolida', metodoId) as Promise<{ ok: boolean }>,
```

### 3. Frontend UI — `src/renderer/pages/metodi/MetodoDrawer.tsx`

- Stato `showConsolidaConfirm` (boolean)
- Pulsante "Consolida versione" (arancione, icona `PackageCheck`) accanto al toggle "Versioni precedenti"
- Visibile solo quando `versioni.some(v => motivo !== 'consolida' && motivo !== 'migration-seed')`
- `ConfirmDialog` variant `danger` con messaggio esplicito sulla perdita di auditabilità
- Versioni consolidate/seed: bordo verde, badge "consolidata"

### Nessuna migrazione necessaria

Il campo `motivo` esisteva già. Il nuovo valore `'consolida'` si aggiunge ai valori esistenti senza modifiche allo schema.

## File modificati

| File | Cosa |
|------|------|
| `src/main/ipc/metodo-analiti.ipc.ts` | Nuovo handler `metodo-analiti:consolida` |
| `src/renderer/lib/api.ts` | `consolida()` in `metodoAnalitiApi` |
| `src/renderer/pages/metodi/MetodoDrawer.tsx` | Pulsante + ConfirmDialog + badge consolidata |
