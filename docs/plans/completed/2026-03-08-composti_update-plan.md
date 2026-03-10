# Piano di Sviluppo — Modulo Composti
**Data:** 2026-03-08  
**Modulo:** `composti` — Standard DB  
**Stato DB user_version:** 6 (migration 006 applicata — FEAT-B)

---

## Contesto

Questo piano raccoglie le feature e i refactor richiesti per il modulo Composti (`/composti`) dell'applicazione LCMS Suite (Electron + React + SQLite). Le modifiche riguardano la tabella principale, il pannello laterale, la gestione multi-fiala, la pulizia del data model, i filtri e le statistiche.

---

## Panoramica Feature

| ID | Feature | Priorità | Stato |
|----|---------|----------|-------|
| FEAT-A | Rimozione campo `matrice` ovunque | Alta | ✅ completata |
| FEAT-B | Unità di misura flessibili per concentrazione | Alta | ✅ completata |
| FEAT-C | Sezione Preparazioni nella sidebar solo per Neat | Alta | ✅ completata |
| FEAT-D | Filtri avanzati e ricerca estesa nella tabella | Media | ✅ completata |
| FEAT-E | Selettore multi-fiala con storico aperture | Media | 🔄 in corso |
| FEAT-F | Statistiche riepilogative sopra la tabella | Bassa | ⏳ da fare |

---

## FEAT-A — Rimozione campo `matrice` ✅

Rimosso da `CompostiTable.tsx`, `CompostoPanel.tsx`, `CompostoForm.tsx`. Campo mantenuto nel DB e nel tipo TypeScript con commento `@deprecated`.

---

## FEAT-B — Unità di misura flessibili per concentrazione ✅

Migration 006 applicata. Campo `unita_conc` aggiunto a `composti` e `preparazioni`. File `src/renderer/lib/unita.ts` creato con costanti e `parseConcentrazione()`. Select unità in `CompostoForm`, `MixPesticidiForm`, `PrepCalcTool`. Display aggiornato in `CompostoPanel` e `PreparazioniTab`.

> ℹ️ Il fix doppia unità `mg/L mg/L` (sessione 07-03) è già in produzione in `PreparazioniTab.tsx`.

---

## FEAT-C — Sezione Preparazioni solo per Neat ✅

Tab *Preparazioni* in `CompostoPanel.tsx` nascosto condizionalmente per `forma !== 'Neat'`. `defaultValue` dei Tabs impostato a `"dettaglio"`.

---

## FEAT-D — Filtri avanzati e ricerca estesa ✅

Ricerca testuale estesa a tutti i campi stringa: `nome`, `codice_interno`, `classe`, `produttore`, `lotto`, `ubicazione`, `solvente`, `forma_commerciale`, `destinazione_uso`, `forma`, `formula`, `fiala`, `operatore_apertura`, `stoccaggio`, `accreditamento_crm`.

Filtri aggiunti: **Stato** (con mapping corretto verso `computeStato()`), **Work Solution** (dinamico per contenuto stringa). Contatore Visualizzati/Totali. Badge filtri attivi rimovibili.

> ⚠️ Il filtro Work Solution mostra le opzioni dinamicamente dai valori unici di `work_standard` presenti nel DB — non filtra per presenza/assenza ma per contenuto esatto della stringa (es. `"Work_Pesticidi_A"`).

---

## FEAT-E — Selettore multi-fiala con storico aperture 🔄

### Obiettivo
Il campo `fiala` esistente contiene il numero totale di fiale di un composto (es. `"4"`). Aggiungere un indicatore visivo a pallini nella tabella principale che mostra quante fiale sono state aperte. Al click su un pallino vuoto si registra l'apertura con data, operatore e note.

### Chiarimenti rispetto al piano originale
- Il campo `fiala` **resta invariato** — contiene già il numero totale di fiale come stringa
- **Non serve** aggiungere `numero_fiale` al DB — si usa `fiala` (convertito a intero) come totale
- Serve aggiungere solo `fiala_numero` a `composti_storia` per tracciare quale fiala è stata aperta
- Migration necessaria: **007** (la 006 è occupata da FEAT-B)

### Migration DB

Creare `src/main/migrations/007-apertura-fiale.sql`:

```sql
ALTER TABLE composti_storia ADD COLUMN fiala_numero INTEGER DEFAULT NULL;
```

Il meccanismo in `db.ts` applica automaticamente la migration al prossimo avvio confrontando il prefisso `007` con `user_version`.

> ⚠️ Applicare anche manualmente al DB di sviluppo:
> ```bash
> sqlite3 "/path/al/lcms.db" "ALTER TABLE composti_storia ADD COLUMN fiala_numero INTEGER DEFAULT NULL; PRAGMA user_version = 7;"
> ```

### File coinvolti

| File | Modifica |
|------|---------|
| `src/main/migrations/007-apertura-fiale.sql` | Nuovo file migration |
| `src/shared/types.ts` | Estendere `CompostoStoria` |
| `src/main/ipc/composti.ipc.ts` | Aggiungere handler `composti:apri-fiala`; aggiungere `fiale_aperte_count` alla query `composti:list` |
| `src/renderer/pages/composti/FialeSelector.tsx` | Nuovo componente pallini |
| `src/renderer/pages/composti/ApriAperturaDialog.tsx` | Nuovo dialog apertura fiala |
| `src/renderer/pages/composti/CompostiTable.tsx` | Colonna Fiale con `FialeSelector` |
| `src/renderer/pages/composti/CompostoPanel.tsx` | Storico: mostrare eventi `apertura_fiala` |

### Blocco 1 — DB e Backend

#### 1A — Migration `007-apertura-fiale.sql`

```sql
ALTER TABLE composti_storia ADD COLUMN fiala_numero INTEGER DEFAULT NULL;
```

#### 1B — `src/shared/types.ts`

Estendere `CompostoStoria`:

```ts
export interface CompostoStoria {
  id: number
  composto_id: number
  tipo: 'Rivalidazione' | 'Dismissione' | 'apertura_fiala'
  data: string
  note: string | null
  n_registro_qc: string | null
  batch_analitico: string | null
  lotto_crm_valido: string | null
  fiala_numero: number | null  // ← nuovo campo
  created_at: string
}
```

#### 1C — `src/main/ipc/composti.ipc.ts`

**Modifica 1** — aggiungere `fiale_aperte_count` alla query `composti:list`:

```sql
SELECT c.*,
  COUNT(CASE WHEN p.stato = 'Attiva' THEN 1 END) AS prep_attive_count,
  COUNT(CASE WHEN p.stato = 'Attiva' AND p.scadenza < date('now') THEN 1 END) AS prep_scadute_count,
  COUNT(CASE WHEN cs.tipo = 'apertura_fiala' THEN 1 END) AS fiale_aperte_count
FROM composti c
LEFT JOIN preparazioni p ON p.composto_id = c.id
LEFT JOIN composti_storia cs ON cs.composto_id = c.id
```

**Modifica 2** — aggiungere handler `composti:apri-fiala` in fondo prima della chiusura di `registerCompostiIpc()`:

```ts
ipcMain.handle('composti:apri-fiala', (_, compostoId: number, data: {
  fiala_numero: number
  data_apertura: string
  operatore?: string
  note?: string
}) => {
  const result = getDb().prepare(
    `INSERT INTO composti_storia (composto_id, tipo, data, fiala_numero, note)
     VALUES (?, 'apertura_fiala', ?, ?, ?)`
  ).run(
    compostoId,
    data.data_apertura,
    data.fiala_numero,
    data.note || null
  )
  return { id: result.lastInsertRowid }
})
```

### Blocco 2 — Componenti renderer

#### 2A — Nuovo file `src/renderer/pages/composti/FialeSelector.tsx`

```tsx
interface FialeSelectorProps {
  numeroFiale: number      // da parseInt(composto.fiala) || 1
  fialeAperte: number      // da composto.fiale_aperte_count
  onApri: (fialaNumero: number) => void
}

export function FialeSelector({ numeroFiale, fialeAperte, onApri }: FialeSelectorProps) {
  if (numeroFiale <= 1) return null

  return (
    <div className="flex gap-1 items-center">
      {Array.from({ length: numeroFiale }, (_, i) => {
        const aperta = i < fialeAperte
        return (
          <button
            key={i}
            onClick={() => !aperta && onApri(i + 1)}
            className={`text-base leading-none ${aperta ? 'cursor-default text-foreground' : 'cursor-pointer text-muted-foreground hover:text-foreground'}`}
            title={aperta ? `Fiala ${i + 1} aperta` : `Apri fiala ${i + 1}`}
          >
            {aperta ? '●' : '○'}
          </button>
        )
      })}
    </div>
  )
}
```

#### 2B — Nuovo file `src/renderer/pages/composti/ApriAperturaDialog.tsx`

Dialog con:
- `data_apertura` — date input, default oggi
- `operatore` — text input, opzionale
- `note` — textarea, opzionale

Al salvataggio:
```ts
window.electronAPI.invoke('composti:apri-fiala', compostoId, {
  fiala_numero: fialaNumero,
  data_apertura,
  operatore,
  note
})
```

#### 2C — `src/renderer/pages/composti/CompostiTable.tsx`

Aggiungere colonna `"Fiale"` che renderizza `<FialeSelector>`:

```tsx
{
  header: 'Fiale',
  cell: (row) => {
    const numeroFiale = parseInt(row.fiala) || 1
    if (numeroFiale <= 1) return null
    return (
      <FialeSelector
        numeroFiale={numeroFiale}
        fialeAperte={row.fiale_aperte_count ?? 0}
        onApri={(fialaNumero) => {
          setApriAperturaTarget({ compostoId: row.id, fialaNumero })
        }}
      />
    )
  }
}
```

Aggiungere stato e `ApriAperturaDialog` nel componente tabella o nella pagina padre.

### Blocco 3 — Pannello storico

#### 3A — `src/renderer/pages/composti/CompostoPanel.tsx`

Nel tab *Storico*, differenziare la visualizzazione per `tipo === 'apertura_fiala'`:

```tsx
{evento.tipo === 'apertura_fiala' ? (
  <div>
    <span className="font-medium">Fiala {evento.fiala_numero} aperta</span>
    <span className="text-muted-foreground text-xs ml-2">{evento.data}</span>
    {evento.note && <p className="text-xs mt-1">{evento.note}</p>}
  </div>
) : (
  /* rendering esistente per Rivalidazione/Dismissione */
)}
```

### Checklist implementazione

- [ ] Blocco 1A: crea migration `007-apertura-fiale.sql`
- [ ] Blocco 1A: applica migration manualmente al DB di sviluppo
- [ ] Blocco 1B: aggiorna `types.ts`
- [ ] Blocco 1C: aggiorna `composti.ipc.ts` — query list + handler apri-fiala
- [ ] Avvia app e verifica 0 errori TypeScript
- [ ] Blocco 2A: crea `FialeSelector.tsx`
- [ ] Blocco 2B: crea `ApriAperturaDialog.tsx`
- [ ] Blocco 2C: aggiorna `CompostiTable.tsx`
- [ ] Testa apertura fiala in tabella
- [ ] Blocco 3A: aggiorna `CompostoPanel.tsx`
- [ ] Testa visualizzazione storico aperture

---

## FEAT-F — Statistiche riepilogative sopra la tabella ⏳

### Obiettivo
Aggiungere una barra di statistiche compatta sopra la tabella con i contatori più utili per il laboratorio, aggiornati in tempo reale in base ai filtri attivi.

### Stat card da mostrare

| Statistica | Descrizione |
|------------|-------------|
| **Totali** | Numero di composti nel DB (indipendente dai filtri) |
| **Visualizzati** | Numero di composti dopo i filtri attivi |
| **Attivi** | Composti con stato `attivo` (calcolato) |
| **In scadenza** | Composti con scadenza entro 30 giorni |
| **Attenzione** | Composti con preparazioni scadute (stato prep calcolato) |

### Layout suggerito
```
┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐
│  Totali     │ Visualizzati│   Attivi    │ In scadenza │  Attenzione │
│    50       │    38       │    42       │      3      │      2      │
└─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘
```

Le card "In scadenza" e "Attenzione" hanno sfondo/testo ambra o rosso se > 0.
Click su card → applica filtro corrispondente.

### File coinvolti
- `src/renderer/pages/composti/CompostiPage.tsx` — calcolo statistiche dal dataset
- `src/renderer/pages/composti/CompostiStats.tsx` — nuovo componente stat card

---

## Ordine di implementazione

```
✅ FEAT-A  rimozione matrice
✅ FEAT-B  unità flessibili (migration 006)
✅ FEAT-C  prep solo Neat
✅ FEAT-D  filtri e ricerca
🔄 FEAT-E  multi-fiala (migration 007)
⏳ FEAT-F  statistiche
```

---

## Note DB

| Migration | Contenuto | Stato |
|-----------|-----------|-------|
| 001–005 | schema base | ✅ |
| 006 | `unita_conc` a `composti` e `preparazioni` | ✅ |
| 007 | `fiala_numero` a `composti_storia` | ⏳ da applicare |

`user_version` attuale: **6**  
Dopo migration 007: **7**

---

*Piano aggiornato il 2026-03-08*