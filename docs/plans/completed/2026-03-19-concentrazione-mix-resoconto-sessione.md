# Resoconto sessione — 20 marzo 2026

## Funzionalità implementata

**Modifica mix: concentrazione per-componente**

Fino ad oggi la modifica di un componente del mix propagava sempre tutti i campi
(inclusa la concentrazione) a tutti gli altri componenti. Questo era corretto per
la maggior parte dei campi (lotto, date, metodi, ecc.) ma non per la concentrazione,
che in un mix può essere diversa da analita ad analita.

---

## Comportamento nuovo

### Campo Nome
- Non viene mai propagato agli altri componenti
- L'etichetta nel form mostra `(solo questo componente)` quando si è in un mix

### Campo Concentrazione (e Unità)
- L'etichetta mostra `(sceglierai al salvataggio)` per ricordare all'utente
- Al salvataggio, se la concentrazione è stata modificata, compare una sezione
  arancione nel dialog di conferma con due scelte:
  - **Solo questo componente** — gli altri mantengono la loro concentrazione attuale
  - **Tutti i N componenti del mix** — la nuova concentrazione viene applicata a tutti
- Se la concentrazione non è stata modificata, la sezione non compare e
  il dialog funziona come prima

### Tutti gli altri campi
- Propagati a tutto il mix come sempre (lotto, date, metodi, destinazione, ecc.)

---

## File modificato

`src/renderer/pages/composti/CompostoForm.tsx`

---

## Strategia tecnica

Il backend (`composti:update`) ha una logica interna che propaga automaticamente
i campi comuni a tutti i componenti del mix quando rileva `mix_id` nel payload.
Per aggirare questa propagazione sulla concentrazione senza toccare il backend,
la funzione `doSave` usa una strategia in due passi:

1. Chiama `update` con la **concentrazione originale** nel payload → il backend
   propaga a tutto il mix ma non cambia niente agli altri (stesso valore)
2. Chiama `update` di nuovo sullo stesso componente con `mix_id: null` →
   il backend non vede un mix e aggiorna solo quel record con la nuova concentrazione

---

## Bug risolto

La prima versione del file non salvava: `doSave` riceveva `concScopeOverride`
come parametro opzionale ma `handleConfirmMix` la chiamava senza argomenti,
affidandosi allo stato React `concScope` che non si aggiorna in modo sincrono.
Il fix passa `concScope` direttamente come argomento: `doSave(concScope)`.