# Bugfix — Filtro Metodo non funziona nella tabella principale

**Data:** 2026-03-13  
**File modificati:** `src/main/ipc/composti.ipc.ts`, `src/renderer/pages/composti/CompostiPage.tsx`  
**Branch:** `master`

---

## Causa del bug

La query `composti:list` (backend) caricava tutti i campi del composto ma **non includeva i metodi associati**. I `metodi_ids` venivano caricati solo in `composti:get`, chiamato esclusivamente quando si apre il pannello laterale di un singolo composto.

Di conseguenza, nella tabella principale ogni composto aveva `metodi_ids = undefined`, e il filtro nel renderer non trovava mai nulla.

---

## Fix 1 — Backend: aggiungere `metodi_ids_raw` alla query list

**File:** `src/main/ipc/composti.ipc.ts`

Nella query `composti:list`, aggiungere una sottoquery che recupera i metodi associati come stringa CSV.

### Prima (riga ~17)

```typescript
  (SELECT MAX(nuova_scadenza) FROM composti_storia
   WHERE composto_id = c.id AND tipo = 'Rivalidazione' AND nuova_scadenza IS NOT NULL) AS ultima_rivalidazione
FROM composti c
```

### Dopo

```typescript
  (SELECT MAX(nuova_scadenza) FROM composti_storia
   WHERE composto_id = c.id AND tipo = 'Rivalidazione' AND nuova_scadenza IS NOT NULL) AS ultima_rivalidazione,
  (SELECT GROUP_CONCAT(metodo_id) FROM composti_metodi WHERE composto_id = c.id) AS metodi_ids_raw
FROM composti c
```

> ✅ Aggiunta virgola dopo `ultima_rivalidazione` e la riga con `GROUP_CONCAT`.

---

## Fix 2 — Renderer: convertire `metodi_ids_raw` in array

**File:** `src/renderer/pages/composti/CompostiPage.tsx`

`GROUP_CONCAT` restituisce una stringa tipo `"met_abc,met_xyz"`. Il filtro si aspetta un array `["met_abc", "met_xyz"]`. Bisogna convertire al momento del caricamento.

### Prima (riga ~160)

```typescript
const load = () => compostiApi.list().then(setComposti)
```

### Dopo

```typescript
const load = () => compostiApi.list().then(rows =>
  setComposti(rows.map((c: any) => ({
    ...c,
    metodi_ids: c.metodi_ids_raw
      ? c.metodi_ids_raw.split(',')
      : [],
  })))
)
```

---

## Verifica

1. Avviare l'app con `npm run dev`
2. Andare nella pagina **Reference Standards**
3. Aprire il filtro **Metodo** e selezionare un metodo
4. Verificare che la tabella mostri solo i composti associati a quel metodo

---

## Commit

```bash
git add src/main/ipc/composti.ipc.ts
git add src/renderer/pages/composti/CompostiPage.tsx
git commit -m "fix(composti): filtro metodo — aggiunto metodi_ids_raw alla query list e conversione in array nel renderer"
```