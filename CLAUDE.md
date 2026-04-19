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

## Componenti fullscreen in MetodiPage

Quando un componente (es. `ParametriMetodoPage`, `SchemaCalibrazione`) deve occupare tutto lo spazio della finestra sostituendo la vista metodi:

1. Il div root del componente deve avere: `className="flex flex-col bg-background"` e `style={{ margin: -16, marginTop: -60, height: '100%', overflow: 'hidden' }}`
2. I margini negativi annullano il `p-4` del layout (`-16`) e coprono il BackButton del layout (`-60`)
3. `bg-background` è obbligatorio per coprire fisicamente il BackButton sottostante
4. Header interno con `style={{ padding: '12px 24px', boxShadow: '0 1px 0 rgba(0,0,0,0.06)' }}` e `className="flex-shrink-0"`

Riferimento: `SchemaCalibrazione.tsx` riga ~768, `ParametriMetodoPage.tsx`.

## Struttura documentazione

- Piani attivi: `docs/plans/active/`
- Bugfix documentati: `docs/bugfix/`
- Analisi funzionale del progetto: `docs/ANALISI_FUNZIONALE.md`
