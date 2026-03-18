# Task agente — Fix label e unità volume nel pannello dettaglio

> Esegui questo task, poi aspetta che l'utente testi prima di fare commit.  
> Non eseguire `git add` o `git commit` autonomamente.

---

## Branch da creare prima di iniziare

```bash
git checkout master
git checkout -b fix/panel-volume-label-unit
```

---

## Problema

Nel pannello laterale dettaglio (`CompostoPanel.tsx`), il campo `volume_ml` mostra sempre la label **"Volume mL"** e l'unità **`mL`** indipendentemente dalla forma del composto.

- I composti **Neat** contengono una quantità fisica (solido/liquido puro) → unità corretta: **mg**, label: **"Quantità (mg)"**
- I composti **Solution** contengono un volume di soluzione → unità corretta: **mL**, label: **"Volume (mL)"**

Il form `CompostoForm.tsx` gestisce già questa distinzione correttamente (label e placeholder dinamici). Il pannello di visualizzazione non è allineato.

---

## File da modificare

```
src/renderer/pages/composti/CompostoPanel.tsx
```

---

## Cosa fare

Cerca nel file questa riga (o simile):

```tsx
<Field label="Volume mL" value={composto.volume_ml ? `${composto.volume_ml} mL` : null} />
```

Sostituiscila con:

```tsx
<Field
  label={composto.forma === 'Neat' ? 'Quantità (mg)' : 'Volume (mL)'}
  value={composto.volume_ml ? `${composto.volume_ml} ${composto.forma === 'Neat' ? 'mg' : 'mL'}` : null}
/>
```

**Nessun'altra modifica.** Toccare solo questa riga.

---

## Verifica

1. Apri un composto **Neat** con `volume_ml` valorizzato → il pannello deve mostrare `Quantità (mg)` con valore tipo `100 mg`
2. Apri un composto **Solution** con `volume_ml` valorizzato → il pannello deve mostrare `Volume (mL)` con valore tipo `1.2 mL`
3. Se `volume_ml` è null/vuoto → il campo non deve comparire (comportamento invariato)

---

## Commit (solo dopo verifica utente)

```bash
git add src/renderer/pages/composti/CompostoPanel.tsx
git commit -m "fix: label e unità volume dinamiche nel pannello dettaglio (Neat=mg, Solution=mL)"
```