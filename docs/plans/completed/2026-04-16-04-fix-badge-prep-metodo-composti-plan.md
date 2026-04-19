---
# Piano: Fix badge prep count + metodo badge → MetodiPage
Date: 2026-04-16

## Context

Due problemi nel DB Composti:

1. **Badge "prep" mostra solo preparazioni attive** (`prep_attive_count`) — dovrebbe mostrare il totale di tutte le preparazioni (attive + dismesse/esaurite + scadute).

2. **Badge metodo in CompostoPanel apre MetodoDrawer** (drawer annidato) — l'utente vuole invece navigare direttamente a MetodiPage con il filtro sul metodo selezionato.

---

## Fix 1 — Badge prep: conteggio totale

### File da modificare

- `src/main/ipc/composti.ipc.ts` — aggiungere campo `prep_totale_count`
- `src/renderer/pages/composti/CompostiTable.tsx` — usare `prep_totale_count` nel badge

### Modifiche

**`composti.ipc.ts`** — aggiungere subquery accanto alle esistenti (dopo `prep_scadute_count`):

```sql
(SELECT COUNT(*) FROM preparazioni
 WHERE composto_id = c.id)
 AS prep_totale_count,
```

**`CompostiTable.tsx`** — nel badge prep, cambiare da:

```tsx
prep {row.prep_attive_count ?? 0}
```

a:

```tsx
prep {row.prep_totale_count ?? 0}
```

---

## Fix 2 — Badge metodo: navigazione a MetodiPage con filtro

### Problema attuale

In `src/renderer/pages/composti/CompostoPanel.tsx` (linea ~267), il click su un badge metodo chiama `setSelectedMetodoId(String(m.id))`, che apre il `MetodoDrawer`. L'utente vuole invece navigare a MetodiPage con il metodo già filtrato.

### Strategia

- Sostituire il comportamento del click: invece di `setSelectedMetodoId`, chiamare `navigate('/metodi', { state: { filtroMetodoId: id } })`.
- In `MetodiPage.tsx`, leggere `filtroMetodoId` da `location.state` e impostare la `search` sul nome del metodo corrispondente (aspettando che la lista `metodi` sia caricata).
- Rimuovere o lasciare inattivo il `MetodoDrawer` se non più usato dal panel (verificare altri punti di uso prima di rimuovere).

### File da modificare

- `src/renderer/pages/composti/CompostoPanel.tsx` — cambiare onClick del badge metodo
- `src/renderer/pages/metodi/MetodiPage.tsx` — leggere `filtroMetodoId` da state

### Modifiche dettagliate

**`CompostoPanel.tsx`** (linea ~267)

Aggiungere `useNavigate` se non già presente, poi cambiare:

```tsx
// Prima:
onClick={() => setSelectedMetodoId(String(m.id))}

// Dopo:
onClick={() => navigate('/metodi', { state: { filtroMetodoId: String(m.id) } })}
```

Verificare se `MetodoDrawer` è ancora usato altrove nel file — se non lo è, rimuovere il render del drawer (linee 503-510) e la variabile `selectedMetodoId`.

**`MetodiPage.tsx`** (linee ~30-34)

Aggiungere gestione di `filtroMetodoId` nell'`useEffect` che si attiva quando `metodi` è caricato:

```typescript
// Aggiungere al tipo dello state:
const state = location.state as { schemaMetodoId?: string; filtroMetodoId?: string } | null

// In un useEffect che dipende da [metodi]:
if (state?.filtroMetodoId && metodi.length > 0) {
  const metodo = metodi.find(m => m.id === state.filtroMetodoId)
  if (metodo) setSearch(metodo.nome)
  window.history.replaceState({}, '')
}
```

---

## Verifica

1. Badge "prep X" in DB Composti mostra il totale di tutte le preparazioni (attive + dismesse + scadute).
2. Click su un badge metodo nel panel di un composto → naviga a MetodiPage con la lista filtrata sul metodo.
3. Il filtro viene pulito dalla history state (nessun loop al refresh).
4. `schemaMetodoId` continua a funzionare (nessuna regressione).
