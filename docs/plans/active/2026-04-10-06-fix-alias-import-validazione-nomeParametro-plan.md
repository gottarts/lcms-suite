# Piano: Fix validazione AliasImportDialog — nomeParametro sufficiente per procedere

## Context

Nella dialog di import alias (`AliasImportDialog.tsx`), la validazione per passare dallo step `mapping` allo step `review` richiede obbligatoriamente la selezione di `aliasLims` o `aliasOqlab`. Questo blocca l'utente anche quando ha selezionato solo la colonna `nomeParametro`, che è semanticamente sufficiente (il match avviene per nome esatto/fuzzy, gli alias possono essere assenti).

## File critico

- [src/renderer/pages/metodi/AliasImportDialog.tsx](src/renderer/pages/metodi/AliasImportDialog.tsx)

## Modifiche da fare

### 1. Guard in `handleProceedToReview` (riga 191)

**Attuale:**
```typescript
if (!colMapping.aliasLims && !colMapping.aliasOqlab) return
```

**Nuovo:** blocca solo se NESSUN campo è selezionato:
```typescript
if (!colMapping.nomeParametro && !colMapping.aliasLims && !colMapping.aliasOqlab && !colMapping.aliasStrumento) return
```

### 2. Disabilitazione bottone "Avanti" (riga 552)

**Attuale:**
```typescript
disabled={!colMapping.aliasLims && !colMapping.aliasOqlab}
title={(!colMapping.aliasLims && !colMapping.aliasOqlab) ? 'Seleziona almeno Nome LIMS o Nome OQLab' : undefined}
```

**Nuovo:**
```typescript
disabled={!colMapping.nomeParametro && !colMapping.aliasLims && !colMapping.aliasOqlab && !colMapping.aliasStrumento}
title={(!colMapping.nomeParametro && !colMapping.aliasLims && !colMapping.aliasOqlab && !colMapping.aliasStrumento) ? 'Seleziona almeno una colonna per procedere' : undefined}
```

### 3. Warning UI (riga 706-710)

**Attuale:**
```tsx
{!colMapping.aliasLims && !colMapping.aliasOqlab && (
  <p className="text-xs text-yellow-700 dark:text-yellow-400">
    Seleziona almeno <strong>Nome LIMS</strong> o <strong>Nome OQLab</strong> per procedere.
  </p>
)}
```

**Nuovo:**
```tsx
{!colMapping.nomeParametro && !colMapping.aliasLims && !colMapping.aliasOqlab && !colMapping.aliasStrumento && (
  <p className="text-xs text-yellow-700 dark:text-yellow-400">
    Seleziona almeno una colonna per procedere.
  </p>
)}
```

## Logica di processing già corretta

Il corpo di `handleProceedToReview` (righe 193-270) gestisce già correttamente il caso `nomeParametro` senza alias: se `valParametro` è presente ma `valLims`/`valOqlab` sono null, effettua match esatto o fuzzy e assegna lo status `'new'` se non trovato. Nessuna modifica necessaria al processing.

## Verifica

1. Aprire `AliasImportDialog` su un metodo
2. Caricare un file con colonna nome parametro
3. Assegnare solo "Nome parametro interno", lasciare gli altri a "— non usare —"
4. Il bottone "Avanti" deve essere abilitato
5. La review deve mostrare le righe con status `auto`, `suggest`, o `new`
