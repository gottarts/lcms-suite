# Piano: Etichette per Work + Badge Beta sidebar

## Context

L'utente vuole due cose:
1. **Etichette per work standard**: aggiungere la funzione di stampa etichette per le work solutions, ispirandosi al sistema già esistente per le preparazioni stock in `Etichettedialog.tsx`. Le etichette devono mostrare le informazioni principali della work (visibili nel WorkDrawer).
2. **Badge "BETA"** per Consumabili e Strumenti nel selettore pannello a sinistra (Sidebar), perché questi moduli sono abbozzati ma non ancora completamente implementati.

---

## Task 1 — Etichette per Work

### Dati disponibili (dall'interfaccia `Work` in `src/shared/types.ts`)

I campi da mostrare nell'etichetta:
- **Nome** (header)
- **Metodi** (badge metodi associati — da `metodi_ids`)
- **Concentrazione** (o "variabile" se `conc_variabile = 1`)
- **Solvente**
- **Validità** (mesi)
- **Ultima preparazione** (data, da `ultima_preparazione.data_prep`)
- **Scadenza calcolata** (data_prep + validita_mesi, usando `scadenzaDate()` già in WorkDrawer)
- **Operatore** (dell'ultima prep, da `ultima_preparazione.operatore`)
- **Stato lab** (badge: attiva/in_scadenza/scaduta/non_preparata)

### Approccio

Aggiungere in `Etichettedialog.tsx`:
1. Una nuova funzione `disegnaEtichettaWork(doc, work, metodiNomi, x, y, dim)` — header verde scuro + badge "WORK" (simile al badge "PREP" nelle preparazioni)
2. Una funzione esportata `generaEtichettaWork(work, metodiNomi, dim)` — genera PDF singolo

Aggiungere un pulsante 🏷️ nel `WorkDrawer.tsx`:
- Visibile nella sezione azioni rapide (vicino ai pulsanti Modifica/Elimina/Archivia)
- Chiama `generaEtichettaWork(work, metodiNomi)` con i dati già caricati nel drawer

### Layout etichetta work (simile a prep stock)

```
╔════════════════════╗
║ NOME WORK  [WORK]  ║  ← Header verde scuro (20, 80, 50), WORK in verde chiaro
╠════════════════════╣
║ Metodi: [M1, M2]   ║
║ Conc.:  [valore]   ║
║ Solv.:  [valore]   ║
║ Valid.: [N mesi]   ║
║ Prep.:  [data]     ║
║ Scad.:  [data]     ║
║ Op.:    [nome]     ║
╚════════════════════╝
```

Per work "al momento" (validita_mesi = null): Scad. = "—", Stato = "—".

### File da modificare

- [`src/renderer/pages/composti/Etichettedialog.tsx`](src/renderer/pages/composti/Etichettedialog.tsx) — aggiungere `disegnaEtichettaWork` + `generaEtichettaWork`
- [`src/renderer/pages/work/WorkDrawer.tsx`](src/renderer/pages/work/WorkDrawer.tsx) — aggiungere import + pulsante 🏷️

---

## Task 2 — Badge "BETA" in Sidebar per Consumabili e Strumenti

### Approccio

Nel file [`src/renderer/components/layout/Sidebar.tsx`](src/renderer/components/layout/Sidebar.tsx), modificare l'array `navItems` per aggiungere un flag `beta?: true` a Strumenti e Consumabili. Nel rendering del NavLink, mostrare un piccolo badge inline "BETA" (testo grigio o giallo, font tiny) accanto alla label quando `item.beta` è true.

```tsx
{ to: '/strumenti',   label: 'Strumenti',   icon: '🔬', beta: true },
{ to: '/consumabili', label: 'Consumabili', icon: '📦', beta: true },
```

Badge inline: `<span className="ml-auto text-[9px] text-muted-foreground bg-muted rounded px-1">BETA</span>`

---

## File critici

| File | Modifica |
|------|----------|
| `src/renderer/pages/composti/Etichettedialog.tsx` | +`disegnaEtichettaWork`, +`generaEtichettaWork` export |
| `src/renderer/pages/work/WorkDrawer.tsx` | import + pulsante etichetta |
| `src/renderer/components/layout/Sidebar.tsx` | flag beta + badge BETA |

---

## Verifica

1. Aprire WorkPage, cliccare su una work → WorkDrawer aperto
2. Cliccare 🏷️ → deve generare un PDF con nome, metodi, conc, solvente, validità, ultima prep, scadenza calcolata, operatore
3. Testare con work "al momento" (validita_mesi = null) → campi non applicabili mostrano "—"
4. Nella Sidebar verificare che Strumenti e Consumabili mostrino badge "BETA"
