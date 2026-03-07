# Piano Implementazione — Modulo Composti
**Data:** 2026-03-07  
**Versione DB attuale:** user_version = 5 (migration 005 applicata)  
**Branch di riferimento:** `main`

---

## 🐛 Bug da correggere (priorità alta)

### BUG-01 — Double unit suffix `mg/L mg/L` nel display preparazione
**File:** `PreparazioniTab.tsx`  
**Causa probabile:** L'unità è concatenata sia nel campo dati (`concentrazione` già include `mg/L`) sia nel template di visualizzazione.  
**Fix:** Rimuovere il suffisso hardcoded nel JSX, oppure normalizzare il valore salvato senza unità e aggiungerla solo nel render.

```tsx
// Errato (probabile):
<span>{prep.concentrazione} mg/L</span>
// Se prep.concentrazione è già "5 mg/L"

// Corretto:
<span>{prep.concentrazione}</span>
// oppure salvare solo il numero e aggiungere l'unità una volta sola
```

**Branch:** `fix/prep-double-unit`  
**Commit:** `fix: rimuovi doppia unità mg/L nel display preparazione`

---

### BUG-02 — `composti:create-mix` omette colonne `stoccaggio` e `accreditamento_crm`
**File:** `composti.ipc.ts` — handler `composti:create-mix`  
**Causa:** La migration 005 ha aggiunto i due campi, ma l'INSERT del mix non è stato aggiornato.  
**Fix:** Aggiungere i campi all'INSERT (con valore `null` se non pertinenti per i mix).

```sql
-- Aggiungere a INSERT INTO composti (...):
stoccaggio, accreditamento_crm
-- Con i valori corrispondenti (null per i mix automatici)
```

**Branch:** `fix/create-mix-missing-cols`  
**Commit:** `fix: aggiungi stoccaggio e accreditamento_crm a composti:create-mix`

---

## 🔧 Miglioramenti UI

### MIGL-01 — Modalità Pesata: mostrare anche il volume solvente derivato (mL)
**Nota:** Il display attuale (`1.00 g di Acqua`) è corretto — non è un bug.  
**Miglioramento:** Aggiungere sotto il box "Pesare" anche il volume equivalente in mL, così l'operatore ha entrambe le info senza calcoli a mente.

**File:** `PrepCalcTool.tsx`  
**UI proposta:**
```
Pesare:
1.00 g
di Acqua
→ 1.00 mL   ← (volume = massa / densità)
```

```tsx
{modalita === 'pesata' && densita && (
  <span className="text-muted-foreground text-sm">
    → {(massa / densita).toFixed(2)} mL
  </span>
)}
```

**Branch:** `feat/pesata-show-derived-volume`  
**Commit:** `feat: modalità pesata — mostra anche volume solvente derivato in mL`

---

## ✨ Nuove Feature (priorità media)

### FEAT-01 — Badge preparazioni scadute + contatore nella tabella principale
**Obiettivo:** Nella riga composto della `CompostiTable`, mostrare:
- 🔴 Badge/icona se esistono preparazioni scadute
- Numero totale di preparazioni attive (es. `3 prep.`) — simile all'immagine allegata

**Implementazione:**

1. **IPC — `composti:list`** (`composti.ipc.ts`):  
   Aggiungere alla query SQL due campi aggregati:
   ```sql
   SELECT c.*,
     COUNT(CASE WHEN p.stato = 'attiva' THEN 1 END) AS prep_attive_count,
     COUNT(CASE WHEN p.stato = 'attiva' AND p.scadenza < date('now') THEN 1 END) AS prep_scadute_count
   FROM composti c
   LEFT JOIN preparazioni p ON p.composto_id = c.id
   GROUP BY c.id
   ```

2. **Tipo** (`shared/types.ts`):  
   Aggiungere `prep_attive_count: number` e `prep_scadute_count: number` all'interfaccia `Composto`.

3. **UI — `CompostiTable.tsx`**:  
   Nella colonna Nome (o colonna dedicata), aggiungere:
   ```tsx
   {composto.prep_attive_count > 0 && (
     <Badge variant="outline">{composto.prep_attive_count} prep.</Badge>
   )}
   {composto.prep_scadute_count > 0 && (
     <Badge variant="destructive">⚠</Badge>
   )}
   ```

**Migration:** Non necessaria (solo query).  
**Branch:** `feat/composti-prep-count-badge`  
**Commit:** `feat: badge contatore e alert preparazioni scadute in tabella`

---

### FEAT-02 — Rimuovere titolo cella preparato (forma + info non utili)
**File:** `PreparazioniTab.tsx`  
**Obiettivo:** Eliminare l'intestazione della card preparazione che mostra "Solido — #?" o simili, poiché non aggiunge valore.  
**Fix:** Rimuovere il nodo JSX che renderizza titolo/header della card, mantenendo solo i campi dati.

**Branch:** `fix/prep-card-remove-title`  
**Commit:** `fix: rimuovi titolo non informativo dalla card preparazione`

---

### FEAT-03 — Stato preparazione calcolato automaticamente alla scadenza
**Obiettivo:** Se `scadenza < oggi` e `stato === 'attiva'`, la preparazione deve visualizzarsi come `scaduta` — indipendentemente dal valore salvato nel DB.

**Implementazione:**
- Aggiungere funzione helper `computeStatoPreparazione(prep)` (sul modello di `computeStato` per i composti):

```ts
// preparazioni.utils.ts (nuovo file o in PreparazioniTab.tsx)
export function computeStatoPrep(prep: Preparazione): string {
  if (prep.stato === 'dismessa') return 'dismessa'
  if (prep.stato === 'esaurita') return 'esaurita'
  if (prep.scadenza && new Date(prep.scadenza) < new Date()) return 'scaduta'
  return prep.stato ?? 'attiva'
}
```

- Usare `computeStatoPrep(prep)` ovunque si renderizza lo stato della preparazione in `PreparazioniTab.tsx`.
- Il valore nel DB rimane `attiva` — lo stato calcolato è solo visualizzazione.

**Branch:** `feat/prep-stato-calcolato`  
**Commit:** `feat: stato preparazione calcolato automaticamente alla scadenza`

---

## 📋 Ordine di esecuzione consigliato

| # | Item | Branch | Complessità |
|---|------|--------|-------------|
| 1 | BUG-01 doppia unità mg/L | `fix/prep-double-unit` | Bassa |
| 2 | MIGL-01 pesata volume derivato mL | `feat/pesata-show-derived-volume` | Bassa |
| 3 | BUG-02 create-mix SQL | `fix/create-mix-missing-cols` | Bassa |
| 4 | FEAT-02 rimuovi titolo card | `fix/prep-card-remove-title` | Bassa |
| 5 | FEAT-03 stato calcolato scadenza | `feat/prep-stato-calcolato` | Media |
| 6 | FEAT-01 badge + contatore tabella | `feat/composti-prep-count-badge` | Media |

---

## 🗄️ Stato DB dopo questa sessione
Nessuna migration necessaria per i fix.  
Nessuna migration necessaria per FEAT-01, FEAT-02, FEAT-03.  
**Prossima migration:** `006-...` da definire per sviluppi futuri.

---

## 🔀 Git — Workflow sessione

```bash
# Per ogni fix/feature:
git checkout main
git pull
git checkout -b fix/prep-double-unit   # o il branch del task

# ... modifiche ...

git add -A
git commit -m "fix: rimuovi doppia unità mg/L nel display preparazione"
git checkout main
git merge fix/prep-double-unit
git branch -d fix/prep-double-unit

# Oppure aprire PR se si lavora in team
```

**Convenzioni commit:** `feat:` · `fix:` · `chore:` · `refactor:` · `docs:`

---

## 📝 Note

- Lo stato `scaduto` per le preparazioni (FEAT-03) è intenzionalmente **solo visualizzazione** — non aggiorna il DB, per coerenza con l'approccio già usato per `computeStato` sui composti.
- Il contatore preparazioni (FEAT-01) si basa su `stato = 'attiva'` nel DB, non sullo stato calcolato — da rivalutare dopo implementazione FEAT-03.
- L'immagine allegata (badge `0 prep.`) conferma il pattern visivo atteso per FEAT-01.
