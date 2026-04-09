# Piano: Deduplicazione case-insensitive in metodo_analiti

## Context

Quando due composti differiscono solo per maiuscole/minuscole (es. "Atrazina" e "ATRAZINA") e vengono collegati allo stesso metodo, la tabella `metodo_analiti` crea duplicati. Il vincolo `UNIQUE(metodo_id, nome)` in SQLite è **case-sensitive** per default, quindi "Atrazina" e "ATRAZINA" sono trattati come valori distinti.

Il problema ha 3 livelli:
1. Il vincolo UNIQUE nella tabella è case-sensitive → non blocca i duplicati
2. Le query `INSERT OR IGNORE` passano il nome esatto → inseriscono nomi identici ma con case diverso
3. La logica degli "analiti manuali" in `metodi:update` fa un confronto case-sensitive (`!nomiDaNuoviComposti.has(n)`) che può lasciare duplicati dopo un'operazione di re-link

## Approccio: normalizzazione del nome a livello backend (UPPER)

**Strategia**: prima di ogni INSERT in `metodo_analiti`, usare `UPPER(nome)` come forma canonica. Tutti i nomi vengono normalizzati a maiuscolo. Questo garantisce:
- Nessun duplicato case-insensitive
- Il vincolo UNIQUE esistente funziona correttamente
- Nessuna migrazione schema necessaria

> Alternativa scartata — `COLLATE NOCASE` nello schema: richiederebbe una migration che ricrea la tabella (ALTER TABLE non supporta COLLATE), troppo invasivo.

> Alternativa scartata — `EXISTS (SELECT 1 WHERE LOWER(nome)=LOWER(?))` prima di ogni INSERT: più query per ogni inserimento, più complesso da mantenere, non risolve il problema degli analiti manuali.

## File da modificare

### 1. `src/main/ipc/composti.ipc.ts`

**Tre punti** dove si inserisce in `metodo_analiti`:

- **Riga 250** (`composti:create`): `insertAnalita.run(mid, row.nome)` → `insertAnalita.run(mid, (row.nome as string).toUpperCase())`
- **Riga 429** (`composti:update`, ramo mix): `insertAnalitaUpd.run(mid, altro.nome as string)` → `insertAnalitaUpd.run(mid, (altro.nome as string).toUpperCase())`
- **Riga 442** (`composti:update`): `insertAnalitaUpd.run(mid, row.nome as string)` → `insertAnalitaUpd.run(mid, (row.nome as string).toUpperCase())`

**Nota**: le query di DELETE usano già `LOWER(nome)` e sono quindi già case-insensitive — non cambiarle.

### 2. `src/main/ipc/metodi.ipc.ts`

**Tre punti**:

- **Riga 69** (`metodi:create`): `insertAnalita.run(data.id, c.nome)` → `insertAnalita.run(data.id, c.nome.toUpperCase())`
- **Riga 141** (`metodi:update`): `insertAnalitaUpd.run(id, c.nome)` → `insertAnalitaUpd.run(id, c.nome.toUpperCase())`
- **Riga 145** (`metodi:update`, analiti manuali): `insertAnalitaUpd.run(id, nome)` → `insertAnalitaUpd.run(id, nome.toUpperCase())`
- **Riga 205** (`metodi:merge`): `insertAnalitaMerge.run(destId, c.nome)` → `insertAnalitaMerge.run(destId, c.nome.toUpperCase())`

**Logica analiti manuali** (righe 125-132): il filtro `!nomiDaNuoviComposti.has(n)` è case-sensitive. Va cambiato per confrontare in UPPER:
```typescript
// Prima:
const nomiDaNuoviComposti = new Set<string>()
for (const cid of compostiIds) {
  const c = getNomeCompostoUpd.get(cid) as { nome: string } | undefined
  if (c?.nome) nomiDaNuoviComposti.add(c.nome)
}
const analitiManuali = analitiEsistenti.filter(n => !nomiDaNuoviComposti.has(n))

// Dopo:
const nomiDaNuoviComposti = new Set<string>()
for (const cid of compostiIds) {
  const c = getNomeCompostoUpd.get(cid) as { nome: string } | undefined
  if (c?.nome) nomiDaNuoviComposti.add(c.nome.toUpperCase())
}
const analitiManuali = analitiEsistenti.filter(n => !nomiDaNuoviComposti.has(n.toUpperCase()))
```

### 3. `src/main/ipc/metodo-analiti.ipc.ts`

**Un punto**:

- **Riga 47** (`metodo-analiti:add`): `insert.run(metodoId, trimmed)` → `insert.run(metodoId, trimmed.toUpperCase())`

### 4. Migration per i dati esistenti

Aggiungere una migration SQLite che normalizza i nomi già presenti in `metodo_analiti` a UPPER e rimuove i duplicati che potrebbero già esistere nel DB.

File da creare: `src/main/migrations/022-metodo-analiti-uppercase.sql`

```sql
-- Normalizza i nomi in metodo_analiti a UPPER e rimuove duplicati case-insensitive
-- Mantiene il record con id più basso per ogni (metodo_id, UPPER(nome)) duplicato

DELETE FROM metodo_analiti
WHERE id NOT IN (
  SELECT MIN(id)
  FROM metodo_analiti
  GROUP BY metodo_id, UPPER(nome)
);

UPDATE metodo_analiti SET nome = UPPER(nome);
```

## Verifica

1. Creare due composti con nomi identici tranne maiuscole (es. "Atrazina" e "ATRAZINA") con lo stesso metodo → la tabella parametri del metodo deve mostrare un solo record
2. Modificare uno dei due composti cambiando il metodo (rimuovere e riaggiungere) → nessun duplicato
3. Aprire la SchemaCalibrazione del metodo → i parametri devono essere deduplicati
4. Verificare che gli analiti aggiunti manualmente in MetodoPage restino dopo un update del metodo
