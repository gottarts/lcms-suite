# CLAUDE.md — Istruzioni per Claude Code

## Regole generali

- **Leggi sempre un file prima di modificarlo.** Non fare supposizioni sul contenuto.
- **Cambiamenti minimali e mirati.** Modifica solo ciò che è strettamente necessario per il task corrente. Niente refactoring, pulizia o semplificazioni non esplicitamente richieste.
- **Scope isolato.** Se stai lavorando su un modulo (es. SchemaCalibrazione), non toccare file di altri moduli (es. CompostiTable) a meno che non sia esplicitamente richiesto.

## File critici — NON semplificare mai senza autorizzazione esplicita

Questi file hanno funzionalità complesse che devono rimanere intatte. Prima di modificarli, descrivi cosa intendi cambiare e perché, poi agisci in modo chirurgico.

- `src/renderer/pages/composti/CompostiTable.tsx` — tabella principale DB Composti: selezione bulk con checkbox e shift+click, filtri per colonna, visibilità/ordine colonne, badge RIVALIDATO, ApriAperturaDialog, FialeSelector, indicatori campi mancanti
- `src/renderer/pages/composti/StoriaDialog.tsx` — dialog dismissione/rivalidazione: supporto modalità bulk (props `onSavedBulk`, `isBulk`, `bulkLottiDistinti`), campo nuova scadenza, routing bulk vs singolo
- `src/renderer/pages/composti/CompostiPage.tsx` — pagina principale DB Composti: logica bulk, mix-scope dialog, lotto-scope dialog

> **Origine di questa regola**: commit `2c4eabd` ha accidentalmente svuotato CompostiTable e StoriaDialog mentre lavorava su SchemaCalibrazione, causando la perdita di selezione bulk, dismissione bulk e molte colonne. Recuperato con ripristino da git in sessione 2026-03-21.

## Interfacce TypeScript

- Non rimuovere props da interfacce senza prima cercare tutti i punti di uso con `grep`.
- TypeScript **non segnala props extra** passate a un componente — una prop rimossa dall'interfaccia smette di funzionare silenziosamente senza errori di compilazione.

## Struttura documentazione

- Piani attivi: `docs/plans/active/`
- Bugfix documentati: `docs/bugfix/`
- Analisi funzionale del progetto: `docs/ANALISI_FUNZIONALE.md`
