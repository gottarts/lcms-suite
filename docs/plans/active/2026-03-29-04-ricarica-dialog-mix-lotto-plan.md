# Plan: RicaricaDialog — Selezione lotto per mix, non per composto

## Context

Nel `RicaricaDialog`, quando una work contiene composti che appartengono a una CRM Mix, il dialog mostra la selezione del lotto (e il cambio automatico/ambiguo) **per ogni singolo composto** della mix. Questo è ridondante e confuso: siccome i composti di una mix devono sempre usare lo stesso lotto del mix, basta mostrare **una sola riga per mix** (con il nome della forma commerciale), pur elencando i composti sottostanti a titolo informativo.

**Esempio attuale**: Mix "Pest Mix 1" con 10 analiti → 10 righe di selezione lotto identiche.
**Comportamento atteso**: 1 sola riga con selettore lotto per "Pest Mix 1", sotto si vedono i 10 analiti.

## Soluzione

### 1. Backend — `work.ipc.ts` (riga ~441)

Aggiungere `c.mix_id` e `c.forma_commerciale` alla SELECT di `work:check-lot-status`:

```sql
SELECT wi.id, wi.source_id, wi.lotto_usato, wi.source_type,
  c.nome              AS nome,
  c.lotto             AS lotto_corrente,
  c.data_dismissione,
  c.mix_id            AS mix_id,
  c.forma_commerciale AS forma_commerciale
FROM work_ingredienti wi
LEFT JOIN composti c ON c.id = wi.source_id
WHERE wi.work_id = ? AND wi.source_type = 'crm'
```

> Composti non-mix avranno `mix_id = null` e `forma_commerciale = null` — la logica esistente funziona invariata per loro.

### 2. Frontend — `RicaricaDialog.tsx`

**Raggruppamento**: prima di renderizzare, raggruppare gli ingredienti per `mix_id` (non-null) o per `source_id` (singoli, mix_id = null).

**Logica scelte per mix**:
- Un singolo selettore per mix group (keyed su `mix_id`)
- `scelte` rimane `Record<number, number>` (source_id → new_source_id), ma quando l'utente sceglie un lotto per una mix, la scelta si propaga a **tutti i source_id del gruppo**
- I `sostituti` di tutti i composti della mix devono essere intersecati/allineati per mostrare solo lotti validi per l'intera mix

**Struttura render per mix group**:
```
[Forma Commerciale / Mix ID]        [lotto attuale → lotto nuovo]
  ↳ Composto A                      ok/sostituito
  ↳ Composto B                      ok/sostituito
  ...
  [select: scegli lotto mix]        (solo se ambiguo)
```

**Logica sostituti per mix**:
- I sostituti di una mix (per un analita) hanno lo stesso `mix_id` ma con lotto diverso
- Per trovare i sostituti validi per l'intera mix: usare i sostituti del primo analita (già per stesso nome), o semplicemente mostrare i lotti distinti del mix_id in questione → **query sostituti già usa `nome`**, quindi ogni analita trova i propri sostituti con stesso nome; lotti coerenti tra analiti dello stesso mix

**Approccio pragmatico per sostituti mix**:
- Usare i sostituti del **primo ingrediente del gruppo** come lista lotti candidati per la mix
- Propagare la scelta `new_source_id` a tutti i membri del gruppo tramite offset:
  - Per ogni membro `ing` del gruppo, trovare il sostituto con lo stesso `nome` nella lista sostituti del membro stesso che ha `mix_id` uguale al sostituto scelto dal primo
  - Oppure, più semplice: aggiungere nel backend una query che trova tutti i composti con stesso `mix_id` del sostituto scelto

**Approccio confermato** (un nuovo lotto ha per forza `mix_id` diverso):
- Tutti gli analiti di Mix A lotto vecchio hanno come sostituto il corrispondente analita nel nuovo lotto della stessa mix → stesso nuovo `mix_id`
- La propagazione è affidabile: scegliendo un sostituto per un analita del gruppo, il suo `mix_id` identifica univocamente il nuovo lotto della mix

**Implementazione**:
- Aggiungere `c.mix_id` ai sostituti nel backend (nella query sostituti)
- Frontend raggruppa per `mix_id`, mostra 1 selettore per gruppo con le opzioni "lotto disponibile" = `mix_id` distinti dei sostituti
- Quando utente sceglie `new_mix_id` per la mix: per ogni membro del gruppo, `scelte[member.source_id]` = sostituto con `mix_id = new_mix_id` nei sostituti del membro

---

## File da modificare

1. **`src/main/ipc/work.ipc.ts`** — riga ~440-460
   - Aggiungere `c.mix_id`, `c.forma_commerciale` alla SELECT ingredienti
   - Aggiungere `c.mix_id` alla SELECT sostituti (già `id, lotto, concentrazione, unita_conc`)

2. **`src/renderer/pages/work/RicaricaDialog.tsx`** — interamente
   - Raggruppare `lotStatus` per `mix_id` (null = singolo)
   - Render: 1 riga per mix group (con header forma_commerciale e lista composti sotto), 1 selettore per gruppo
   - Propagare la scelta a tutti i source_id del gruppo: match per `nome` nei sostituti di ogni membro con `mix_id` del sostituto scelto
   - `tuttiRisolti` e `handleConferma` restano invariati (operano su `scelte` per source_id)

## Dettaglio propagazione scelta mix

Quando l'utente sceglie un sostituto per la mix (es. sceglie `sostituto.id = 42` per "Acetamiprid", che ha `sostituto.mix_id = 'LOT-2025-003'`):
- Per ogni altro membro del gruppo: trovare nei suoi `sostituti` quello con `mix_id = 'LOT-2025-003'`
- Impostare `scelte[member.source_id] = quel_sostituto.id`

Questo funziona perché tutti i composti di una mix hanno sempre un sostituto con lo stesso `mix_id` (stesso lotto della mix).

## Verifica

1. Aprire una work che contiene una CRM Mix con lotto dismesso e più sostituti
2. Aprire RicaricaDialog
3. Verificare che appaia 1 sola riga selettore per la mix (non N righe per N analiti)
4. I composti del mix sono elencati sotto come dettaglio (non-interattivi)
5. Scegliendo un lotto dalla select, tutti i composti del mix vengono aggiornati
6. Confermare → nuova work creata con lotti corretti per tutti i composti del mix
