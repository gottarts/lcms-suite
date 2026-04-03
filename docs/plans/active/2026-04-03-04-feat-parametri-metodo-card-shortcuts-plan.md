# Piano: Tabella Parametri Metodo + Scorciatoie Card

## Context

Gli analiti del metodo sono attualmente una lista semplice in fondo al form di modifica, senza colonne aggiuntive e senza accesso rapido. La richiesta è duplice:
1. **Scorporare la gestione analiti** dal form modifica e trasformarla in una vista dedicata (`ParametriMetodoPage`) accessibile via pulsante nel drawer e nella card.
2. **Aggiungere scorciatoie alle card** (stile WorkCard): pulsante "Schema ↗" e pulsante "Parametri ↗".

I nuovi campi richiesti per ogni parametro: **accreditato** (spunta booleana) e **alias_strumento** (testo libero).

---

## Approccio

### 1. Migrazione DB — `018-metodo-analiti-extra-fields.sql`

Aggiunge le colonne alla tabella esistente:
```sql
ALTER TABLE metodo_analiti ADD COLUMN accreditato INTEGER NOT NULL DEFAULT 0;
ALTER TABLE metodo_analiti ADD COLUMN alias_strumento TEXT;
```

**File:** `src/main/migrations/018-metodo-analiti-extra-fields.sql`

---

### 2. IPC backend — aggiornare `metodo-analiti.ipc.ts`

- `metodo-analiti:list` → restituisce anche `accreditato`, `alias_strumento`
- Aggiungere `metodo-analiti:update` → aggiorna `accreditato` e/o `alias_strumento` per un singolo analita (by `id`)

**File:** `src/main/ipc/metodo-analiti.ipc.ts`

---

### 3. API renderer — aggiornare `api.ts`

Aggiungere `metodoAnalitiApi.update(id, patch)` che chiama `metodo-analiti:update`.

**File:** `src/renderer/lib/api.ts`

---

### 4. Nuovo componente `ParametriMetodoPage.tsx`

**File:** `src/renderer/pages/metodi/ParametriMetodoPage.tsx`

Componente full-page (come `SchemaCalibrazione`) montato in `MetodiPage` quando `parametriMetodoId` è settato.

**Struttura UI:**
- Header: nome metodo + pulsante "← Torna al metodo"
- Toolbar: input + autocomplete (catalogo o libero) + pulsante "Aggiungi" — logica identica a quella di MetodoForm
- Tabella con colonne:
  - **Nome** (testo, font-mono)
  - **Accreditato** (checkbox, aggiorna immediatamente via `metodoAnalitiApi.update`)
  - **Alias strumento** (input inline editabile, salva on blur o Enter)
  - **Rimuovi** (pulsante X, con conferma visiva se nessun item selezionato; altrimenti "Rimuovi selezionati")
- Riga header della tabella con checkbox "seleziona tutti"
- Pulsante "Rimuovi selezionati (n)" nel toolbar se ci sono selezioni

**Logica:**
- Carica analiti via `metodoAnalitiApi.list(metodoId)` (ora con nuovi campi)
- Add/remove uguale a MetodoForm (riusa `metodoAnalitiApi.add/remove`)
- Update accreditato/alias: chiama `metodoAnalitiApi.update(id, patch)` inline

---

### 5. Aggiornare `MetodiPage.tsx`

Aggiungere stato `parametriMetodoId: string | null` e il rendering condizionale:
```tsx
if (parametriMetodoId) {
  return <ParametriMetodoPage
    metodoId={parametriMetodoId}
    metodoNome={metodi.find(m => m.id === parametriMetodoId)?.nome ?? ''}
    onClose={() => setParametriMetodoId(null)}
  />
}
```

Passare `onOpenParametri` a `MetodoCard` e `MetodoDrawer`.

**File:** `src/renderer/pages/metodi/MetodiPage.tsx`

---

### 6. Aggiornare `MetodoCard.tsx`

Aggiungere pulsanti scorciatoia in stile WorkCard:
- Pulsante **"Schema ↗"** → chiama `onGoSchema`
- Pulsante **"Parametri ↗"** → chiama `onGoParametri`

Entrambi con `stopPropagation`. Stile identico a WorkCard: `h-6 text-[10px] px-2 flex-1 variant="outline"`.

Props nuove: `onGoSchema?: () => void`, `onGoParametri?: () => void`.

**File:** `src/renderer/pages/metodi/MetodoCard.tsx`

---

### 7. Aggiornare `MetodoDrawer.tsx`

Aggiungere pulsante "Parametri" affianco a "Schema calibrazione" nella barra azioni.

Prop nuova: `onOpenParametri: (id: string) => void`.

**File:** `src/renderer/pages/metodi/MetodoDrawer.tsx`

---

### 8. Rimuovere la sezione analiti da `MetodoForm.tsx`

La sezione `{isEdit && ...}` con lista analiti e input aggiunta va rimossa (la funzionalità è spostata in `ParametriMetodoPage`). Il form rimane snello e focalizzato sui campi strutturali del metodo.

**File:** `src/renderer/pages/metodi/MetodoForm.tsx`

---

## File critici modificati

| File | Tipo modifica |
|------|---------------|
| `src/main/migrations/018-metodo-analiti-extra-fields.sql` | Nuovo |
| `src/main/ipc/metodo-analiti.ipc.ts` | Modifica (list + nuovo update) |
| `src/renderer/lib/api.ts` | Modifica (aggiunta update) |
| `src/renderer/pages/metodi/ParametriMetodoPage.tsx` | Nuovo componente |
| `src/renderer/pages/metodi/MetodiPage.tsx` | Modifica (stato + rendering) |
| `src/renderer/pages/metodi/MetodoCard.tsx` | Modifica (pulsanti shortcut) |
| `src/renderer/pages/metodi/MetodoDrawer.tsx` | Modifica (pulsante Parametri) |
| `src/renderer/pages/metodi/MetodoForm.tsx` | Modifica (rimozione sezione analiti) |

---

## Verifica

1. Avviare l'app — la migrazione 018 viene applicata automaticamente
2. Aprire MetodiPage → le card mostrano i pulsanti "Schema ↗" e "Parametri ↗"
3. Click "Parametri ↗" → apre ParametriMetodoPage con la tabella analiti
4. Aggiungere un analita dal catalogo e uno libero
5. Spuntare "Accreditato" → si salva immediatamente
6. Inserire alias strumento → si salva on blur
7. Selezionare più righe → "Rimuovi selezionati (n)" appare e funziona
8. Click "Schema ↗" dalla card → apre SchemaCalibrazione come prima
9. Aprire il drawer → il pulsante "Parametri" apre la tabella
10. Aprire form modifica → la sezione analiti non c'è più
