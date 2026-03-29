# Resoconto sessione — Link DB Composti dalla colonna Analiti

**Data:** 2026-03-28
**Oggetto:** Aggiunto pulsante ↗ nella colonna Analiti dello Schema Calibrazione per navigare al DB Composti con filtri intelligenti

---

## Cosa è stato fatto

Aggiunto un pulsante ↗ nella card di ogni analita nella colonna "Analiti" della griglia Schema Calibrazione. Il pulsante naviga a CompostiPage con ricerca preimpostata per nome analita e logica automatica sul filtro "mostra dismessi":
- Se l'analita ha CRM attivi → apre DB Composti senza mostrare i dismessi
- Se l'analita non ha CRM attivi (nessuno o tutti dismessi) → apre DB Composti con `mostraDismessi: true`

---

## Feature aggiunte

### Link ↗ dalla colonna Analiti al DB Composti

**Motivazione:** L'utente vuole poter ispezionare rapidamente lo stato dei CRM nel DB Composti partendo dagli analiti dello schema calibrazione. La logica sul flag `mostraDismessi` evita di mostrare una tabella vuota per analiti i cui CRM sono tutti dismessi.

**Implementazione:**
- `goToComposto(nome, mostraDismessi)` aggiornato per passare `mostraDismessi` a `location.state`
- Card analita trasformata in `display:flex` con testo + pulsante ↗ affiancato
- Proxy usato: variabile `senzaCrm` già disponibile nel loop (`!a.mixId && a.sngIds.length === 0`) — indica assenza di CRM attivi per quell'analita
- Chiamate esistenti a `goToComposto` (da card CRM singoli e mix) aggiornate con `false` come secondo argomento

---

## File modificati

| File | Modifica |
|------|----------|
| `src/renderer/pages/metodi/SchemaCalibrazione.grid.tsx` | `goToComposto` + 2° arg; card analita con pulsante ↗; altre chiamate con `false` |

---

## Note per sessioni future

- Il meccanismo `location.state` per i filtri di CompostiPage supporta anche altri filtri (`filtroMetodi`, `filtroAttenzione`, ecc.) se in futuro si vorrà un link più specifico.
- `senzaCrm` è un proxy: non distingue "nessun CRM mai" da "tutti dismessi". È intenzionale: in entrambi i casi mostrare i dismessi è utile all'utente.
- Piano: `docs/plans/active/2026-03-28-16-link-db-composti-colonna-analiti-plan.md`
