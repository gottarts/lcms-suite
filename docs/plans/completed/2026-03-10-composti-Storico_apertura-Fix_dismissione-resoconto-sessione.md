# Resoconto sessione — 2026-03-10

---

## BUG-2A ✅ — Backend: aggiorna `data_dismissione` in `storia-add`

**File:** `src/main/ipc/composti.ipc.ts`

Aggiunto blocco `if (data.tipo === 'Dismissione')` prima del `return` nell'handler `composti:storia-add`. Se il composto ha `mix_id`, aggiorna `data_dismissione` su tutti i componenti del mix; altrimenti solo sul singolo.

---

## BUG-2B ✅ — Frontend: riga grigia + toggle "Mostra dismessi"

**File 1:** `src/renderer/components/shared/DataTable.tsx`
Aggiunta prop `rowClassName?: (row: T) => string` nell'interfaccia e nel render del `<TableRow>`.

**File 2:** `src/renderer/pages/composti/CompostiTable.tsx`
Passata `rowClassName` a `<DataTable>`: applica `opacity-40 text-muted-foreground` alle righe con stato `dismesso`.

**File 3:** `src/renderer/pages/composti/CompostiPage.tsx`
- Aggiunto `const [mostraDismessi, setMostraDismessi] = useState(false)` — **default `false`**: dismessi nascosti all'apertura, visibili solo attivando il toggle.
- Aggiunto filtro `if (!mostraDismessi)` in fondo al `useMemo filtered` con `mostraDismessi` nell'array dipendenze.
- Aggiunto checkbox "Mostra dismessi" nel JSX sotto i filtri.

**Variazione rispetto al piano:** il default era stato impostato a `true` nel piano, poi cambiato a `false` a richiesta. Rimosso anche un blocco residuo `if (filtroStato !== 'Dismesso')` che era rimasto per errore in cima al `useMemo` da una versione precedente del piano.

---

## FEAT-G ⬜ — Storico: evento apertura flacone

Non ancora fatto. Rimandato alla prossima sessione.

---

## Git — da fare

```bash
git add src/main/ipc/composti.ipc.ts
git add src/renderer/components/shared/DataTable.tsx
git add src/renderer/pages/composti/CompostiTable.tsx
git add src/renderer/pages/composti/CompostiPage.tsx

git commit -m "fix: dismissione aggiorna data_dismissione; riga grigia con toggle mostra/nascondi dismessi"
```