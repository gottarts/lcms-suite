# Resoconto sessione — Fix Audit CRM: logica basata sulle preparazioni

**Data:** 2026-04-11
**Oggetto:** Bug concettuale grave nell'Audit CRM: l'unità di riferimento temporale era la work, non la preparazione.

---

## Cosa è stato fatto

Identificato e corretto un bug concettuale fondamentale nel modulo Audit CRM: la query SQL che recupera le work associate a un metodo per una data di audit era basata sullo stato corrente delle work (archiviato = 0), senza considerare se la work esisteva e aveva preparazioni alla data richiesta.

---

## Bug risolti / Feature aggiunte

### Bug: Audit CRM non rispetta la temporalità delle preparazioni

**Root cause / Motivazione:**
La query in `dashboard.ipc.ts` filtrava `AND (w.archiviato = 0 OR w.archiviato IS NULL)`, il che produceva due errori simmetrici:

1. **Work archiviate escluse**: una work archiviata dopo la data di audit non veniva mostrata, anche se aveva preparazioni valide a quella data. L'ispezione storica era quindi incompleta.
2. **Work create dopo la data incluse**: una work creata oggi compariva nell'audit di ieri con stato `non_preparata` (nessuna prep <= data), perché nessun filtro temporale impediva il JOIN.

Il principio corretto è: **l'unità di riferimento è la preparazione, non la work**. Una work è presente in un audit storico se e solo se aveva almeno una preparazione registrata entro quella data (`work_preparazioni.data_prep <= @data`).

**Fix / Implementazione:**
Modifica chirurgica alla clausola `WHERE` della query works in `dashboard.ipc.ts` (righe 178–185):

- **Rimosso**: `AND (w.archiviato = 0 OR w.archiviato IS NULL)`
- **Aggiunto**:
  ```sql
  AND EXISTS (
    SELECT 1 FROM work_preparazioni wp2
    WHERE wp2.work_id = w.id AND wp2.data_prep <= @data
  )
  ```

Questo garantisce che nell'audit compaiano esattamente le work che avevano una preparazione registrata entro la data richiesta, indipendentemente dal loro stato corrente (attiva o archiviata).

---

## File modificati

| File | Modifica |
|------|----------|
| `src/main/ipc/dashboard.ipc.ts` | Sostituzione del filtro `archiviato=0` con EXISTS su `work_preparazioni` |

---

## Note per sessioni future

- **auditModel.ts e scadenzeModel.ts non richiedono modifiche**: la logica di calcolo stato (`ultima_prep_data + validita_mesi`) era già corretta, si applicava solo al sottoinsieme sbagliato di work.
- **Work senza preparazioni non compaiono più nell'audit**: questo è semanticamente corretto (se non c'era prep, non copriva nulla). Se in futuro si vuole mostrare anche work "in attesa di prima preparazione", si può aggiungere un'opzione separata nell'UI.
- **La query crm_validi non richiedeva modifiche**: le CTE `mix_usati` e `ids_rilevanti` non avevano filtro `archiviato`, quindi includevano già correttamente le work archiviate.
- Riferimento piano: `docs/plans/active/2026-04-11-03-fix-audit-crm-logica-preparazioni-plan.md`
