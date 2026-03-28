# Resoconto — Piano Work & Schema Calibrazione
**Sessione: 20 marzo 2026 — LC-MS/MS Suite**

---

## Fasi pianificate e stato

| Fase | Descrizione | Stato |
|------|-------------|-------|
| **Fase 1** | DB + Backend (migration SQL, IPC handler, tipi, api.ts) | ✅ Completata |
| **Fase 2** | Pagina Work (lista, drawer, form, route, sidebar) | ✅ Completata |
| **Fase 3** | Schema Calibrazione (griglia, step bar, form Work, drawer dettaglio) | ✅ Completata — file presenti nel progetto |
| **Fase 4** | Tracciabilità | ⏳ Non pianificata — sessione separata |

---

## File presenti nel progetto

### Fase 2 — Pagina Work
| File | Stato |
|------|-------|
| `src/renderer/pages/work/WorkPage.tsx` | ✅ Lista con cards, ricerca, contatore |
| `src/renderer/pages/work/WorkDrawer.tsx` | ✅ Drawer dettaglio |
| `src/renderer/pages/work/WorkForm.tsx` | ✅ Form creazione/modifica |
| `src/renderer/App.tsx` | ✅ Route `/work` aggiunta |
| `src/renderer/components/layout/Sidebar.tsx` | ✅ Voce "Work" in sidebar |
| `src/renderer/lib/api.ts` | ✅ `workApi` completo |

### Fase 3 — Schema Calibrazione (suddiviso in 4 file)
| File | Contenuto |
|------|-----------|
| `SchemaCalibrazione_types.ts` | Tipi TypeScript e costanti colori |
| `SchemaCalibrazione_logic.ts` | Logica calcoli, classificazione analiti, stato |
| `SchemaCalibrazione_grid.tsx` | Griglia colonne/analiti con codifica colori |
| `SchemaCalibrazione.tsx` | Componente principale, step bar, form Work |

---

## Punti aperti e da verificare

### 1. Git — commit mancanti
Il piano prevede un commit dopo ogni fase. Non risulta documentato nessun commit per Fase 2 e Fase 3.

```bash
# Verificare lo stato attuale
git status
git log --oneline -10
```

Commit previsti dal piano:
```bash
git commit -m "feat: Fase 2 - Pagina Work"
git commit -m "feat: Fase 3 - Schema Calibrazione"
```

---

### 2. Task pendenti da sessione precedente (G-5 e G-6)

#### G-5 — Nuovi composti inseriti in coda
**File:** `src/main/ipc/composti.ipc.ts`

Trovare:
```ts
sql += ' GROUP BY c.id ORDER BY c.nome'
```
Sostituire con:
```ts
sql += ' GROUP BY c.id ORDER BY c.id ASC'
```

#### G-6 — Reset ordinamento al terzo click
**File:** `src/renderer/components/shared/DataTable.tsx`

La funzione `handleSort` deve ciclare tre stati: `asc` → `desc` → nessun ordinamento (reset).

---

### 3. Schema Calibrazione — collegamento dati reali
Verificare che la griglia legga i CRM dal DB via IPC `composti:list` filtrata per `metodo_id`, escludendo i dismessi (`data_dismissione IS NULL`). Se sono ancora presenti dati mock/statici, vanno sostituiti.

---

### 4. Drawer dettaglio Work nello Schema
Il piano descrive un drawer con:
- Catena di tracciabilità (albero ricorsivo dai CRM originali)
- Tabella volumi di prelievo
- Lista composti con concentrazione calcolata

Verificare che sia implementato e funzionante.

---

### 5. Migration 012 — verifica DB
Controllare che la migration `012-work.sql` sia stata applicata correttamente.

```bash
# Nel terminale dell'app Electron, oppure aprendo il DB con un tool:
PRAGMA user_version;
# Atteso: 12 o superiore
```

---

## Prossimi passi

1. Eseguire `git status` per capire cosa è già committato
2. Verificare i task G-5 e G-6 ancora pendenti
3. Testare lo Schema Calibrazione con dati reali (metodo con composti associati)
4. Pianificare la **Fase 4 — Tracciabilità** in una sessione separata

---

*Resoconto redatto il 2026-03-20*