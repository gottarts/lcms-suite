---
name: operatore_preparazione
description: L'operatore va nella preparazione della work (work:prepara / WorkDrawer), NON nella creazione dello schema calibrazione
type: feedback
---

L'operatore NON va nel modal SchemaCalibrazione (creazione Work), ma nella registrazione della preparazione in laboratorio (`WorkDrawer` → form "Nuova preparazione" → campo operatore → salvato in `work_preparazioni.operatore`).

**Why:** L'utente ha dovuto correggerlo 3 volte. Lo schema calibrazione crea la ricetta della work; la preparazione è l'atto fisico in lab, ed è lì che si traccia chi l'ha fatta.

**How to apply:** Qualsiasi richiesta di "aggiungere operatore alle work" → guardare prima WorkDrawer e work_preparazioni, non SchemaCalibrazione.
