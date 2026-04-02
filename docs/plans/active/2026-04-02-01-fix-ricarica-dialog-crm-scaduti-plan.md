# Piano: Fix RicaricaDialog per CRM scaduti

## Context

Il pulsante "Ricarica ↻" nello SchemaCalibrazione appare già correttamente per CRM scaduti (`haScaduti=true`). Quando si apre il `RicaricaDialog`, però, la sezione "Scelta richiesta" mostra il dropdown vuoto per i componenti di mix scaduti, rendendo impossibile confermare la ricarica.

**Root cause**: `getMixOpzioni` in `RicaricaDialog.tsx` filtra i sostituti richiedendo `s.mix_id != null` (riga 145: `if (s.mix_id && ...)`). Per i CRM scaduti (non dismessi), i sostituti trovati dal backend possono avere `mix_id = null` (ad esempio singoli con stesso nome), che vengono scartati → dropdown vuoto → bottone disabilitato.

Inoltre, le label "Lotto attuale (dismesso)" nelle sezioni scelta (righe 283 e 312) sono errate per i CRM scaduti.

## Modifiche — file: `src/renderer/pages/work/RicaricaDialog.tsx`

### Fix 1: `getMixOpzioni` — includere sostituti senza mix_id

Il filtro `s.mix_id && !seen.has(s.mix_id)` scarta i sostituti con `mix_id = null`.

Per i componenti di mix scaduti, i sostituti potrebbero essere:
- altri lotti dello stesso mix (hanno `mix_id`)
- composti singoli con stesso nome (hanno `mix_id = null`)

La funzione deve distinguere i due casi e gestire entrambi.

### Fix 2: `handleMixScelta` — gestire sostituti con mix_id null

Usare il formato `"single:<id>"` come value per i sostituti singoli nel dropdown.

### Fix 3: `getMixSceltaAttuale` — gestire sostituti con mix_id null

Restituire `single:<id>` quando il sostituto scelto non ha mix_id.

### Fix 4: dropdown `<option>` nel render — usare il value corretto

Usare `o.mix_id ?? \`single:${o.id}\`` come value.

### Fix 5: Label "dismesso" → testo contestuale per scaduti

Usare `rep.data_dismissione ? 'dismesso' : 'scaduto'` nelle righe 283 e 312.

## Estensioni future (non ancora implementate)

### WorkPage — pulsante Schema per `haScaduti`
**File**: `src/renderer/pages/work/WorkPage.tsx` (righe 321–330)

Estendere con stile giallo ambra e testo "Aggiorna Schema ↗" anche quando `haScaduti && !isBloccata`.

### Filtro mix scaduti — SchemaCalibrazione.logic.ts
**File**: `src/renderer/pages/metodi/SchemaCalibrazione.logic.ts` (righe 132–141)

Rimuovere la guardia `!r.mix_id` così il filtro scaduti si applica anche ai componenti di mix.

### Filtro mix scaduti — AggiungiASchemaDialog.tsx
**File**: `src/renderer/pages/work/AggiungiASchemaDialog.tsx` (righe 36–42)

Stessa modifica: rimuovere `!r.mix_id && ` dalla condizione riga 38.

## Scope implementato

Un solo file: `src/renderer/pages/work/RicaricaDialog.tsx`

## Verifica

1. Aprire SchemaCalibrazione con una work che ha CRM scaduti (badge giallo "⚠ CRM scaduti")
2. Cliccare "Ricarica ↻" sul chip
3. Il dialog deve mostrare gli ingredienti scaduti con il dropdown popolato di opzioni
4. Scegliere un sostituto → il bottone "Conferma e Ricarica" si abilita
5. Confermare → la work viene aggiornata e archiviata
