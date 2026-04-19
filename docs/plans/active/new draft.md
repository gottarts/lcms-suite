# prossimi feat:



##

## Bug noti / TODO rimasti aperti (da risolvere nella prossima sessione)

### ⚠ Frecce non appaiono
**Sintomo:** Le frecce tra moduli CRM/Work non sono visibili in produzione.
**Causa probabile:** `computeArchi()` richiede che le Work abbiano `srcs` popolato con `tipo` corretto (`'mix' | 'sng' | 'prep' | 'work'`). Se lo schema non ha Work create (o le Work non hanno sorgenti in `selSrcs`), non viene disegnato nessun arco. Possibile anche che i moduli derivati non matchino per `id` le chiavi usate nelle frecce (es. `MIX-${mixId}` vs l'id usato in `w.srcs`).
**Da verificare:** Aggiungere `console.log` temporaneo su `archi` dopo `computeArchi()` per vedere se è vuoto. Controllare che `w.srcs[i].id` corrisponda al `mixId` o `sngId` usato come chiave in `mixMod` / `sngMod`.
Ho visto che appaiono ma in uno schema solo (con intermedie) e non collegano tutto. In piu appaiono ma ci sono sovrapposizioni e schifezze. In piu non si muovono con lo spostamento della chips.

### ⚠ Pan con click sullo sfondo buggy
**Sintomo:** Il pan inizia male (scatti, salti) quando si clicca sullo sfondo del viewport.
**Causa probabile:** Il check `e.target !== e.currentTarget` nel `handleViewportMouseDown` fallisce perché il world div intercetta l'evento prima del viewport. Il world occupa tutta l'area del viewport (anche se è più grande con overflow) e `e.target` risulta il world, non il viewport stesso.
**Fix suggerito:** Cambiare la condizione: usare un ref separato per il "background" del canvas (un div con z-index basso dietro i moduli), oppure accettare qualsiasi target che non sia un `.modulo` (classe da aggiungere ai moduli). In alternativa: usare mouse button centrale (button=1) per pan sempre, e button=0 solo su sfondo.
ha bloccato proprio l'pp

### ⚠ Zoom troppo repentino
**Sintomo:** Lo zoom con wheel è percepito come troppo veloce/brusco.
**Fix suggerito:** Ridurre il `factor` da `1.1` a `1.05` (mezza variazione per step). Opzionale: leggere `e.deltaMode` (0=pixel, 1=righe, 2=pagine) e scalare `deltaY` di conseguenza per trackpad vs mouse wheel.
 
 ### altro
 alcune card sono sovrappost (quelle con rivette piu lunghe...)
 generale aspetto buggato della lavagna. deve essere una mappa con card collegate senza sovrapposizioni ( o comunque minime) e piu espnsa. Ci deve essere un livello di sovrapposizione per le freccie. Qelle di una card non devono sovrapporsi a quelle di un altra card. 

 Se non riesci a far tutto usa una libreira a un certo punto tentanto di mantenere lo schema. Ma questo lo sai tu sei tu il developer.

 ## importante


 ## altri
BAZZI - SUGGERIMENTI




## FUTURO
SERVIREBBE UN CAMPO SINONIMI (PIU NOMI NON UNO) PER GESTIRE EVENTUALI NOMI E CASISTICHE PER I COMPOSTI E MAGARI UN CAMPO CAS NUMBER. FAI MOLTA ATTENZIONE IN QUANTO IL DB COMPOSTI è DELICATO. QUESTI NUOVI CAMPI FANNO PARTE DI IDENTIFICAZIONE E DEVONO ESSERE AGGIUNTI IN TUTTI I VARI PUNTI DI COMPILAZIONE DEL DB (IMPORTAZIONI, NUOVO COMPSOTO IN TUTTE LE DIALOG ECCETERA. ). FORSE PER EVITARE PROBLEMI E MEGLIO METTERE QUESTA COSA IN UN NUOVO MODULO CHE POTREBBE ESSERE DATABASE MOLECOLE (CON DENTRO ANCHE SMILE ECCETERA.)






---
# fix macOs version
versione dmg-legacy lenta su apple silicon M1
aggiungere nel package.json il seguente script
"package:mac-universal": "npm run build && electron-builder --config electron-builder.config.mac-legacy.js --mac --universal && hdiutil create -volname 'LCMS Suite' -srcfolder 'release/mac-universal/LCMS Suite.app' -ov -format UDZO release/LCMS-Suite-1.0.0-universal.dmg"
poi 
npm run package:mac-universal
questo in realta solo per capire se ce qualche altro problema con il macbook air



