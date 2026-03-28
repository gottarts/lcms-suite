# Piano: rename "+ Schema" → "+ Metodo" in WorkPage/AggiungiASchemaDialog

## Context

L'utente vuole rinominare il pulsante e il dialog "Aggiungi a Schema" in "Aggiungi a Metodo", perché concettualmente l'azione è "la work appare nello schema del metodo selezionato", e "metodo" è il termine più corretto dal punto di vista dell'utente.

Non ci sono bug da correggere: il link "Vai allo Schema" mancante per le work orfane è comportamento atteso (nessuno schema a cui puntare).

## File da modificare

### 1. `src/renderer/pages/work/WorkPage.tsx` — bottone nella WorkCard (~riga 336-339)

Cambio label bottone:
- `+ Schema ↗` → `+ Metodo ↗`
- `title="Aggiungi questa work a uno schema di calibrazione"` → `title="Aggiungi questa work a un metodo di calibrazione"`

### 2. `src/renderer/pages/work/AggiungiASchemaDialog.tsx` — 3 stringhe UI

- **Titolo dialog** (riga ~199): `"Aggiungi allo Schema"` → `"Aggiungi a Metodo"`
- **Sottotitolo** (riga ~201): `"Seleziona lo schema di calibrazione per <b>{workNome}</b>"` → `"Seleziona il metodo di calibrazione per <b>{workNome}</b>"`
- **Pulsante conferma** (riga ~298): `"Aggiungi allo Schema ↗"` → `"Aggiungi a Metodo ↗"`

## Note

- Il nome del componente `AggiungiASchemaDialog` rimane invariato (rinominare file/componente non è richiesto).
- Nessuna logica da toccare, solo stringhe UI.

## Verifica

- Aprire WorkPage → verificare che il bottone mostri `+ Metodo ↗`
- Cliccare il bottone su una work orfana → dialog si apre con titolo "Aggiungi a Metodo"
- Confermare → label bottone di conferma è "Aggiungi a Metodo ↗"
