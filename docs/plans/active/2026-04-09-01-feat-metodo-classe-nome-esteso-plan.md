# Piano: Aggiunta classe_metodo e nome_esteso al Metodo

## Context

L'utente vuole arricchire l'anagrafica dei Metodi con due nuovi campi:
1. **`classe_metodo`** — classe merceologica/analitica del metodo (es. "Pesticidi", "Multiclasse"), suggerita dalle classi dei composti associati, ma sovrascrivibile manualmente. Usa le voci dell'anagrafica "Classi" come suggerimenti (stessa anagrafica usata in CompostiDB).
2. **`nome_esteso`** — alias leggibile del metodo (es. "Pesticidi acque superficiali"), campo testo libero senza anagrafica.

Il campo `matrice` esistente rimane invariato.

---

## File critici da modificare

| File | Cosa cambia |
|------|-------------|
| `src/main/migrations/021-metodo-classe-nome.sql` | Nuova migration: aggiunge le due colonne |
| `src/shared/types.ts` | `Metodo` interface: + `classe_metodo`, `nome_esteso` |
| `src/main/ipc/metodi.ipc.ts` | `create`, `update`, `merge`, `get-or-create`: include i nuovi campi nelle query |
| `src/renderer/pages/metodi/MetodoForm.tsx` | UI: + campo `nome_esteso` (Input), + campo `classe_metodo` (combobox con suggerimenti) |
| `src/renderer/pages/metodi/MetodiPage.tsx` | Tabella lista metodi: mostra `nome_esteso` e `classe_metodo` come colonne opzionali |

---

## Implementazione passo per passo

### Step 1 — Migration SQL
`src/main/migrations/021-metodo-classe-nome.sql`:
```sql
ALTER TABLE metodi ADD COLUMN classe_metodo TEXT;
ALTER TABLE metodi ADD COLUMN nome_esteso TEXT;
```

### Step 2 — TypeScript types
`src/shared/types.ts` — aggiungere a `Metodo`:
```ts
classe_metodo: string | null
nome_esteso: string | null
```

### Step 3 — Backend IPC `metodi.ipc.ts`

**`metodi:create`** — aggiornare `insertMetodo` per includere `classe_metodo`, `nome_esteso` nella INSERT e nel `@param`.

**`metodi:update`** — aggiornare `updateMetodo` per includere `classe_metodo`, `nome_esteso` nella UPDATE SET.

**`metodi:merge`** — aggiornare `updateMetodo` per includere i due campi.

**`metodi:get-or-create`** — nessuna modifica necessaria (INSERT minimal senza i nuovi campi, defaultano a NULL).

Aggiungere un nuovo handler **`metodi:compute-classe`** che, dato un `metodo_id`, calcola la classe suggerita:
```
1. SELECT DISTINCT c.classe FROM composti c JOIN composti_metodi cm ON cm.composto_id = c.id WHERE cm.metodo_id = ? AND c.classe IS NOT NULL
2. Se 0 classi → null
3. Se 1 classe unica → quella classe
4. Se ≥2 classi diverse → "Multiclasse"
```

### Step 4 — UI `MetodoForm.tsx`

Nella sezione "Identificazione":
1. Aggiungere campo **`nome_esteso`**: `<Input>` semplice (placeholder: "Nome esteso o alias leggibile").
2. Aggiungere campo **`classe_metodo`**: combobox con suggerimenti. Al caricamento del form (se `isEdit`):
   - Chiama `metodi:compute-classe` per suggerire il valore automatico
   - Carica le voci dell'anagrafica "Classi" tramite `anagrafiche:list` + filtro per nome "Classi"
   - Mostra un `<Input>` con datalist o dropdown di suggerimenti (stesso pattern degli autocomplete esistenti)
   - L'utente può accettare il suggerimento, scegliere da lista, o digitare liberamente

Aggiornare `handleSave` e `handleMergeConfirm` per includere i nuovi campi nel payload (già gestiti da `{ ...form }`).

Aggiornare lo stato iniziale per nuovo metodo:
```ts
classe_metodo: '', nome_esteso: '',
```

### Step 5 — Lista metodi `MetodiPage.tsx`
Leggere il file prima di modificare. Aggiungere `nome_esteso` come colonna visibile nella tabella (o sotto il nome) e `classe_metodo` come badge/tag, senza rimuovere nulla.

---

## Logica classe automatica

```
composti del metodo → classi distinte non-null
  0 classi → suggerimento: null (campo vuoto)
  1 classe → suggerimento: quella classe (es. "Pesticidi")
  ≥2 classi → suggerimento: "Multiclasse"
```

L'utente può sempre sovrascrivere manualmente. Il backend calcola solo la suggestion, non forza il valore.

---

## Verifica

1. Lanciare l'app — la migration 021 viene applicata automaticamente
2. Aprire un metodo con composti associati → `classe_metodo` suggerisce la classe corretta
3. Aprire un metodo con composti di classi miste → suggerisce "Multiclasse"
4. Modificare manualmente `classe_metodo` → valore salvato correttamente
5. `nome_esteso` appare nella lista metodi e si salva
6. Creare nuovo metodo → i campi sono null di default
7. Merge di due metodi → i campi vengono preservati dal form (no regressioni)
