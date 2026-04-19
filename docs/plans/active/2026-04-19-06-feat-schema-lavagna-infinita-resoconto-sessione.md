# Resoconto sessione — Schema Calibrazione: Vista Lavagna Infinita

**Data:** 2026-04-19
**Oggetto:** Nuovo componente `SchemaLavagna` — vista canvas pan/zoom alternativa alla griglia, con moduli draggabili e frecce dinamiche

---

## Cosa è stato fatto

Progettato e implementato `SchemaCalibrazione.lavagna.tsx`, un componente React che aggiunge una vista "lavagna infinita" allo Schema di Calibrazione, affiancando la griglia esistente (che diventa la modalità edit) tramite un toggle in bottom-bar.

Sessione divisa in due macro-parti:
1. **Brainstorming esteso** (skill `brainstorming` + `frontend-design` + visual companion): 4 domande di design con mockup nel browser per definire layout, estetica, strategia frecce, persistenza posizioni.
2. **Implementazione**: scrittura del file nuovo (`SchemaCalibrazione.lavagna.tsx`) e modifica chirurgica di `SchemaCalibrazione.tsx`.

---

## Feature aggiunta

### SchemaLavagna — vista canvas read-only dello schema

**Motivazione:** La griglia attuale è efficace per editare ma poco leggibile per consultare lo schema completo (scadenze, lotti, produttori, rivalidazioni non visibili a colpo d'occhio). La nuova vista mostra tutte le informazioni in moduli navigabili.

**Implementazione:**
- File nuovo: `src/renderer/pages/metodi/SchemaCalibrazione.lavagna.tsx` (~700 righe)
- Componenti interni: `SidebarAnaliti` (fissa sx, con filtri Tutti/Coperti/Scoperti e badge M/S/IS), `ModuloMix` / `ModuloSng` / `ModuloWork` (draggabili), `ArchiSVG` (SVG dentro il world), `useLavagnaPositions` (hook localStorage)
- Pan/zoom nativo via CSS transform + onWheel (zoom-to-cursor) + drag sfondo
- Auto-layout L→R: Mix col.0 (x=40), Sng/Neat col.1 (x=440), Work col.2 (x=900), intermedie con gap 440px
- Persistenza posizioni: `localStorage` chiave `lcms:lavagna:positions:<metodoId>`, debounce 200ms
- Stile: palette `C` del progetto, font `Lato` + `IBM Plex Mono`, nessuna dipendenza nuova
- Modifica chirurgica `SchemaCalibrazione.tsx`: +1 import, +1 state `vista`, +toggle UI bottom-bar, +branch render ternario

---

## Bug noti / TODO rimasti aperti (da risolvere nella prossima sessione)

### ⚠ Frecce non appaiono
**Sintomo:** Le frecce tra moduli CRM/Work non sono visibili in produzione.
**Causa probabile:** `computeArchi()` richiede che le Work abbiano `srcs` popolato con `tipo` corretto (`'mix' | 'sng' | 'prep' | 'work'`). Se lo schema non ha Work create (o le Work non hanno sorgenti in `selSrcs`), non viene disegnato nessun arco. Possibile anche che i moduli derivati non matchino per `id` le chiavi usate nelle frecce (es. `MIX-${mixId}` vs l'id usato in `w.srcs`).
**Da verificare:** Aggiungere `console.log` temporaneo su `archi` dopo `computeArchi()` per vedere se è vuoto. Controllare che `w.srcs[i].id` corrisponda al `mixId` o `sngId` usato come chiave in `mixMod` / `sngMod`.

### ⚠ Pan con click sullo sfondo buggy
**Sintomo:** Il pan inizia male (scatti, salti) quando si clicca sullo sfondo del viewport.
**Causa probabile:** Il check `e.target !== e.currentTarget` nel `handleViewportMouseDown` fallisce perché il world div intercetta l'evento prima del viewport. Il world occupa tutta l'area del viewport (anche se è più grande con overflow) e `e.target` risulta il world, non il viewport stesso.
**Fix suggerito:** Cambiare la condizione: usare un ref separato per il "background" del canvas (un div con z-index basso dietro i moduli), oppure accettare qualsiasi target che non sia un `.modulo` (classe da aggiungere ai moduli). In alternativa: usare mouse button centrale (button=1) per pan sempre, e button=0 solo su sfondo.

### ⚠ Zoom troppo repentino
**Sintomo:** Lo zoom con wheel è percepito come troppo veloce/brusco.
**Fix suggerito:** Ridurre il `factor` da `1.1` a `1.05` (mezza variazione per step). Opzionale: leggere `e.deltaMode` (0=pixel, 1=righe, 2=pagine) e scalare `deltaY` di conseguenza per trackpad vs mouse wheel.

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/metodi/SchemaCalibrazione.lavagna.tsx` | NUOVO — tutta la feature lavagna |
| `src/renderer/pages/metodi/SchemaCalibrazione.tsx` | Chirurgico: import + state `vista` + toggle UI + branch render |
| `docs/plans/active/2026-04-19-06-*-plan.md` | Piano approvato copiato (vedi step 4) |

---

## Note per sessioni future

- **Priorità 1:** Debuggare le frecce — verificare che `w.srcs` sia popolato e che gli id matchino tra `deriveModuli()` e `computeArchi()`. Il problema è probabilmente nel mapping `mixMod.get(s.id)` dove `s.id` è il `mix_id` ma `mixMod` è indicizzato su `meta.mixId` (che è il mix_id attivo, non necessariamente uguale a `s.id` se c'è lotto alternativo).
- **Priorità 2:** Fix pan (vedere sopra) e zoom (factor 1.05).
- **Piano di riferimento:** `/Users/vitogelao/.claude/plans/crea-un-nuovo-componente-functional-nest.md`
- Il brainstorming ha consumato molti token (visual companion + Plan agent + Explore agent) — per i fix nella prossima sessione procedere direttamente senza brainstorming.
- Il componente è read-only per design: le callback di edit (toggleMix, toggleSng, ecc.) non sono passate alla Lavagna, rendendo il toggle griglia↔lavagna non distruttivo.
