# Piano: WorkPage — 3 feature/fix

**Data:** 2026-03-28

## Context

Miglioramenti alla pagina Work e al WorkDrawer richiesti dall'utente:
1. Bottone "Vai a schema" nel banner CRM scaduti del drawer
2. Sezione "Metodi associati" spostata in alto nel drawer, con nome metodo
3. Vista archivio work (toggle attive/archiviate in WorkPage)

---

## Feature 1 — Bottone "Vai a schema" nel banner CRM scaduti

**File:** `src/renderer/pages/work/WorkDrawer.tsx` (linee 401–409)

L'hook `onVaiASchema` è già definito nell'interfaccia (riga 19) e già passato da WorkPage (riga 114) con navigazione a `/metodi`.

**Modifica:**
Nel banner CRM scaduti, aggiungere sotto il testo un bottone "Vai a schema":
- Se `work.metodi_ids.length === 1` → chiama direttamente `onVaiASchema(work.metodi_ids[0])`
- Se `work.metodi_ids.length > 1` → mostra un piccolo Popover con lista dei metodi (usando `metodiNomi[mid]` come label) per scegliere quale schema aprire
- Se `work.metodi_ids` è vuoto o undefined → bottone non mostrato

Usare `Popover` + `PopoverTrigger` + `PopoverContent` (già disponibili in shadcn/ui nel progetto).

---

## Feature 2 — Metodi associati: in alto + nome metodo

**File:** `src/renderer/pages/work/WorkDrawer.tsx` (linee 724–739)

**Spostamento:** Togliere il blocco `{/* Metodi associati */}` dalla fine e inserirlo subito dopo il blocco action buttons (riga ~362), prima dei banner bloccata/CRM scaduti. Diventa la prima sezione informativa del drawer.

**Mostrare il nome:** Sostituire `{mid}` con `{metodiNomi?.[mid] ?? mid}` nei badge. Questo usa il nome leggibile se disponibile, altrimenti fallback sull'ID.

---

## Feature 3 — Vista archivio work in WorkPage

### 3a — Nuovo IPC handler

**File:** `src/main/ipc/work.ipc.ts`

Aggiungere `ipcMain.handle('work:list-archivio', ...)` con query analoga a `work:list` ma con `WHERE w.archiviato = 1`. Restituisce le stesse colonne + `archiviato_at`, `archiviato_motivo`, `sostituito_da_id`.

### 3b — Aggiungere `listArchivio` a workApi

**File:** `src/renderer/lib/api.ts` (dopo riga 99)

```ts
listArchivio: () => api.invoke('work:list-archivio') as Promise<any[]>,
```

### 3c — Toggle in WorkPage

**File:** `src/renderer/pages/work/WorkPage.tsx`

- Aggiungere stato `mostraArchivio: boolean` (default `false`)
- Bottone toggle nella toolbar (accanto a "Nuova Work"): `Attive` / `Archiviate`
- Quando `mostraArchivio = true`, caricare con `workApi.listArchivio()` invece di `workApi.list()`
- Nelle card archiviate, mostrare `archiviato_at` e `archiviato_motivo` al posto dello stato lab
- Nascondere "Nuova Work" quando in modalità archivio

---

## File critici

| File | Modifiche |
|------|-----------|
| `src/renderer/pages/work/WorkDrawer.tsx` | Feature 1 (banner) + Feature 2 (metodi in alto) |
| `src/main/ipc/work.ipc.ts` | Feature 3a (nuovo handler list-archivio) |
| `src/renderer/lib/api.ts` | Feature 3b (listArchivio) |
| `src/renderer/pages/work/WorkPage.tsx` | Feature 3c (toggle archivio) |

---

## Verifica

1. Aprire un WorkDrawer con `ha_crm_scaduti = true` → banner mostra bottone "Vai a schema"
2. Work con 1 metodo → click naviga direttamente allo schema
3. Work con più metodi → click apre picker con nomi metodi
4. "Metodi associati" appare in cima al drawer con nomi leggibili
5. Toggle "Archiviate" in WorkPage mostra le work archiviate con motivo
6. Toggle "Attive" ripristina la lista normale
