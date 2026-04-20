# prossimi feat:


## problemi lavagna

### bug destinazione duso
gli analiti con destinazione duso diversa dal filtro sono acnrao non visibile nel blocco analiti della lavagna. devono essere tutti visibili ma con il badge a seconda della destinazione d'uso. hai gia fatto giusto per IS che si vedono anche con filtro taratura o QC. Pero adesso con filtro IS non vedi taratura e/o qc. IL comportamento deve essere che il filtro non oscura anliti nel blocco analiti. Semplicemtne gli analiti avranno un badge IS , T, QC, T+QC e devono essere tutti visibili. Scoperti sono solo quelli che non hanno CRM. 8magari metti una legenda per questi badge nel blocco analiti. E una nella lavagna per il codice colore crm work singoli e intermedie
### ricarica e scadenza crm
nelle card delle work in lavagna è sempre visibile il tasto ricarica che deve comparire come per la griglia solo quando c'è un problema nella work (crm scaduti, dismessi o prep neat scadute o dismesse).
### card work crm scaduti
la card delle work mostra crm scaduti anche quando il crm è stato rivalidato
### riallinea
il tasto riallinea non riallinea in tempo reale ma necessita di un click su griglia e tornare a lavagna per vedere gli effetti



### Resoconto sessione — Schema Lavagna: Spazio verticale tra cluster CRM e trascinamento gruppi

  - **Possibili miglioramenti futuri**:
  - Rendere configurabile il `GROUP_GAP` dall'esterno (es. tramite prop o costante globale).
  - Aggiungere una leggera ombreggiatura di sfondo ai gruppi durante il drag per migliorare il feedback visivo.
  - Considerare l'aggiunta di un'animazione di snap quando si rilascia un gruppo vicino ad altri cluster.



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



