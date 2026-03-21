# Piano: Protezione funzionalità DB Composti — prevenire regressioni future

## Contesto

Il commit `2c4eabd` ha distrutto `CompostiTable.tsx` e `StoriaDialog.tsx` accidentalmente mentre lavorava su SchemaCalibrazione. Questo è successo perché Claude Code non aveva istruzioni esplicite su quali file/funzionalità siano critici e non vadano mai toccati al di fuori del loro contesto specifico. L'obiettivo è mettere in atto protezioni che rendano questo tipo di errore impossibile o immediatamente visibile.

## Analisi delle opzioni

### Opzione A — `CLAUDE.md` nella root del progetto ✅ PRINCIPALE
**Cos'è**: file letto automaticamente da Claude Code all'inizio di ogni sessione (prima di tutto il resto). Sovrascrive comportamenti default. È il meccanismo più diretto e potente.
**Pro**: caricato ad ogni sessione senza che l'utente debba ricordarlo, vincolante per Claude, può includere regole specifiche per file
**Contro**: nessuno rilevante per questo caso

### Opzione B — Memoria (`feedback`) ✅ COMPLEMENTARE
**Cos'è**: file in `~/.claude/projects/.../memory/` già esistente in questo progetto
**Pro**: persiste tra sessioni, utile per feedback operativi
**Contro**: ha meno autorità del CLAUDE.md, potrebbe essere sovrascritta da istruzioni più recenti

### Opzione C — Skill personalizzata ❌ NON NECESSARIA
**Cos'è**: skill invocabile manualmente
**Contro**: richiede che l'utente la invochi — non protegge automaticamente

### Opzione D — Hook pre-commit/pre-modifica ❌ OVERKILL
Troppo complesso per questo caso.

## Soluzione raccomandata: CLAUDE.md + memoria

### 1. Creare `CLAUDE.md` nella root del progetto

Il file deve contenere:
- **Regola generale**: leggere sempre un file prima di modificarlo
- **File critici protetti**: lista esplicita di file che non vanno mai semplificati/svuotati senza autorizzazione
- **Regola di scope**: modifiche a un modulo non devono toccare file di altri moduli (es. lavorare su SchemaCalibrazione non deve toccare CompostiTable)
- **Regola di conservazione delle props**: mai rimuovere props da interfacce TypeScript senza verificare tutti i punti di uso nel codebase
- **Riferimento alla struttura docs/**: dove trovare piani e resoconti

### 2. Aggiornare la memoria `feedback`

Aggiungere un record di feedback specifico che descriva la regressione e la regola derivante.

## File da creare/modificare

| File | Azione |
|------|--------|
| `CLAUDE.md` (root progetto) | Creare da zero |
| `~/.claude/projects/.../memory/feedback_no_semplificazioni.md` | Creare nuovo feedback |
| `~/.claude/projects/.../memory/MEMORY.md` | Aggiornare indice |

## Contenuto proposto per `CLAUDE.md`

```markdown
# CLAUDE.md — Istruzioni per Claude Code

## Regole generali

- **Leggi sempre un file prima di modificarlo.** Non fare supposizioni sul contenuto.
- **Cambiamenti minimali e mirati.** Modifica solo ciò che è strettamente necessario per il task corrente. Non refactoring, non pulizia, non semplificazioni non richieste.
- **Scope isolato.** Se stai lavorando su `ModuloA`, non toccare file di `ModuloB` a meno che non sia esplicitamente richiesto.

## File critici — NON semplificare mai senza autorizzazione esplicita

Questi file hanno funzionalità complesse che devono rimanere intatte:

- `src/renderer/pages/composti/CompostiTable.tsx` — tabella principale DB Composti con selezione bulk, filtri per colonna, gestione visibilità colonne
- `src/renderer/pages/composti/StoriaDialog.tsx` — dialog dismissione/rivalidazione con supporto bulk (props: onSavedBulk, isBulk, bulkLottiDistinti)
- `src/renderer/pages/composti/CompostiPage.tsx` — pagina principale DB Composti con logica bulk, mix-scope, lotto-scope

**Regola**: se devi modificare uno di questi file, descrivi prima cosa intendi cambiare e perché, poi fallo in modo chirurgico.

## Interfacce TypeScript

- Non rimuovere props da interfacce senza prima cercare tutti i punti di uso (`grep`).
- TypeScript non segnala props extra passate a un componente — una prop rimossa dall'interfaccia smette di funzionare silenziosamente.

## Struttura documentazione

- Piani attivi: `docs/plans/active/`
- Bugfix documentati: `docs/bugfix/`
- Analisi funzionale del progetto: `docs/ANALISI_FUNZIONALE.md`
```

## Verifica

Dopo la creazione del CLAUDE.md:
- Aprire una nuova sessione Claude Code nel progetto
- Verificare che Claude menzioni o applichi le regole del CLAUDE.md
- Il file viene caricato automaticamente — nessuna azione dell'utente richiesta
