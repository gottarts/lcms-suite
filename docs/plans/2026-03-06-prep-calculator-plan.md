# Feature Plan — Calcolatore Preparazione Stock

**Data:** 2026-03-06  
**Stato:** Proposta  
**Priorità:** Media  
**Modulo:** Composti → PreparazioniTab

---

## 1. Obiettivo

Aggiungere un tool assistito di calcolo della concentrazione all'interno del flusso di creazione/registrazione di una preparazione stock. Il tool guida l'operatore step-by-step nel calcolo della quantità di solvente da aggiungere e registra la concentrazione **reale** (non quella nominale) nel database.

---

## 2. Problema Attuale

Il form `PreparazioniTab` chiede direttamente `concentrazione` e `solvente` come campi liberi. Non esiste alcun supporto al calcolo: l'operatore deve fare i conti a parte, con rischio di errore e nessuna tracciabilità del ragionamento.

---

## 3. Logica di Calcolo

### 3.1 Caso Neat (si parte da solido o liquido puro pesato)

```
massa_reale_mg = massa_pesata_mg × (purezza% / 100)
```

**Aggiunta per volume:**
```
volume_solvente_mL = massa_reale_mg / concentrazione_target_mgL × 1000
concentrazione_reale_mgL = massa_reale_mg / volume_solvente_mL × 1000
```

**Aggiunta per pesata (solvente pesato):**
```
volume_solvente_mL = massa_solvente_g / densita_solvente_gcm3
concentrazione_reale_mgL = massa_reale_mg / volume_solvente_mL × 1000
```

### 3.2 Nota sulla purezza

La `purezza` è letta automaticamente dal campo `purezza` del composto padre (se `forma = Neat`). L'operatore può modificarla manualmente nel tool (es. lotto diverso, ricertificato).

---

## 4. UX Proposta

Il tool è un **pannello a step** (`PrepCalcTool`) che appare come Sheet laterale o Dialog, richiamabile dal bottone **"🧪 Calcolatore"** nel form di nuova preparazione.

### Step 1 — Parametri iniziali
| Campo | Note |
|---|---|
| Concentrazione target (mg/L) | Input numerico |
| Massa pesata (mg) | Input numerico, focus automatico |
| Purezza (%) | Pre-compilato dal composto padre, modificabile |

→ Mostra subito: **Massa reale = X mg**

### Step 2 — Solvente
| Campo | Note |
|---|---|
| Solvente | Select da anagrafica o testo libero |
| Modalità aggiunta | Radio: "Per volume (mL)" / "Per pesata (g)" |
| Densità solvente (g/cm³) | Visibile solo se modalità = "Per pesata" — pre-compilato da dizionario solventi comuni |

### Step 3 — Risultati (calcolati in tempo reale)
| Risultato | Formula |
|---|---|
| Volume solvente da aggiungere | calcolato da target e massa reale |
| *(oppure)* Massa solvente da pesare | calcolato da target e massa reale |
| **Concentrazione reale (mg/L)** | basata su quanto effettivamente aggiunto |

### Step 4 — Conferma
Bottone **"Usa questi valori"** trasferisce nel form principale:
- `concentrazione` ← concentrazione_reale
- `solvente` ← solvente selezionato
- `note` ← stringa auto-generata, es: *"Calcolato: pesata 3.4 mg, purezza 98.5%, +1.35 mL MeOH → 2487 mg/L reali"*

---

## 5. Dizionario Densità Solventi

Tabella costante embedded nel frontend (non DB), pre-compilata per i solventi comuni LC-MS:

| Solvente | Densità (g/cm³) |
|---|---|
| Acetonitrile (MeCN) | 0.786 |
| Metanolo (MeOH) | 0.791 |
| DMSO | 1.100 |
| Acqua | 1.000 |
| Etanolo (EtOH) | 0.789 |
| Acetone | 0.791 |
| Etil acetato | 0.902 |
| Diclorometano | 1.325 |
| Formiato di metile | 0.974 |

L'operatore può sempre inserire un valore manuale.

---

## 6. Modifiche al Database

### 6.1 Migration — `preparazioni` table

Aggiungere i seguenti campi alla tabella `preparazioni` per tracciare i parametri del calcolo:

```sql
-- Migration 002-prep-calc-fields.sql
ALTER TABLE preparazioni ADD COLUMN massa_pesata REAL;
ALTER TABLE preparazioni ADD COLUMN purezza_usata REAL;
ALTER TABLE preparazioni ADD COLUMN densita_solvente REAL;
ALTER TABLE preparazioni ADD COLUMN modalita_aggiunta TEXT;  -- 'volume' | 'pesata'
ALTER TABLE preparazioni ADD COLUMN concentrazione_reale REAL;
ALTER TABLE preparazioni ADD COLUMN concentrazione_target REAL;
```

> **Nota:** Il campo `concentrazione` (TEXT) esistente viene mantenuto per compatibilità. `concentrazione_reale` (REAL) è il valore calcolato preciso.

### 6.2 Aggiornamento `Preparazione` type in `src/shared/types.ts`

```ts
export interface Preparazione {
  // ... campi esistenti ...
  massa_pesata: number | null
  purezza_usata: number | null
  densita_solvente: number | null
  modalita_aggiunta: 'volume' | 'pesata' | null
  concentrazione_reale: number | null
  concentrazione_target: number | null
}
```

---

## 7. File da Creare / Modificare

| File | Operazione | Descrizione |
|---|---|---|
| `src/main/migrations/002-prep-calc-fields.sql` | **Crea** | Migration ALTER TABLE |
| `src/main/db.ts` | **Modifica** | Registra migration 002 |
| `src/shared/types.ts` | **Modifica** | Aggiorna interface `Preparazione` |
| `src/main/ipc/preparazioni.ipc.ts` | **Modifica** | CRUD legge/scrive nuovi campi |
| `src/renderer/pages/composti/PrepCalcTool.tsx` | **Crea** | Il tool di calcolo (Sheet/Dialog) |
| `src/renderer/pages/composti/PreparazioniTab.tsx` | **Modifica** | Aggiunge bottone "Calcolatore" + mostra conc. reale |
| `src/renderer/lib/solventDensities.ts` | **Crea** | Dizionario densità solventi |

---

## 8. Tasks

### Task A — Migration DB
```bash
# Crea il file SQL
# Aggiorna src/main/db.ts per applicare migration 002 se user_version < 2
git add -A
git commit -m "feat(db): migration 002 — prep calc fields"
```

### Task B — Types & IPC
- Aggiorna `Preparazione` in `types.ts`
- Aggiorna `preparazioni:create` e `preparazioni:update` per leggere/scrivere i nuovi campi
```bash
git add -A
git commit -m "feat(ipc): preparazioni support calc fields"
```

### Task C — Frontend: `solventDensities.ts`
- File costante con record `{ [nome: string]: number }`
- Esporta anche array per Select ordinata alfabeticamente
```bash
git add -A
git commit -m "feat(lib): solvent densities dictionary"
```

### Task D — Frontend: `PrepCalcTool.tsx`
- Sheet (Shadcn `Sheet` o `Dialog`)
- Step 1: inputs (target, pesata, purezza) con calcolo live massa reale
- Step 2: solvente + modalità + densità con calcolo live volume/massa
- Step 3: output evidenziato (concentrazione reale in grande)
- Step 4: bottone "Usa questi valori" con callback `onConfirm`
- Validazione: blocca step 2 se massa reale = 0 o purezza = 0
```bash
git add -A
git commit -m "feat(ui): PrepCalcTool — assisted stock preparation calculator"
```

### Task E — Frontend: Aggiorna `PreparazioniTab.tsx`
- Aggiungi bottone **"🧪 Calcolatore"** nel form dialog
- Quando si apre il calcolatore, passa `purezza` del composto padre come prop
- `onConfirm` del tool popola i campi `concentrazione`, `solvente`, `note`
- Nella card di ogni preparazione: mostra `concentrazione_reale` se presente, con label "Conc. reale" distinta da "Conc. nominale"
```bash
git add -A
git commit -m "feat(ui): PreparazioniTab — integrate PrepCalcTool"
```

---

## 9. Out of Scope (v1)

- Calcolo per diluizioni seriali (es. da stock a working solution) — feature futura
- Incertezza di misura e propagazione degli errori
- Stampa etichette con concentrazione calcolata
- Esportazione foglio di preparazione

---

## 10. Note Operative

- Il tool è **opzionale**: l'operatore può sempre compilare il form a mano senza passare dal calcolatore
- La nota auto-generata nel campo `note` garantisce tracciabilità anche senza i campi extra
- La `purezza` del composto padre è quella del lotto corrente; se l'operatore ha aperto un nuovo lotto con purezza diversa, la modifica nel tool **non** aggiorna il composto — solo la preparazione
- Il campo `concentrazione` (TEXT) esistente viene popolato con la concentrazione reale convertita a stringa, per compatibilità con la visualizzazione attuale
