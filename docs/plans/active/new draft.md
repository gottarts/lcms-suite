# prossimi feat:








 


##
Analiti accreditati scoperti
1
Nessun CRM attivo con nome corrispondente
NON DA INFO AGGIUNTIVE... (CHE ANALITA?)    FAI QUALCOSA... 
PROPOSTA. SOSTITUIRE QUELLA CASELLA CON WORK DA PREPARE (SI PUO FARE CHE CLICCANDO SI ARRIVI IN WORKPAGE CON UN FILTRO DA IMPLEMNTARE ACNHE IN WORKPAGE CHE EVIDENZI LE WORK SENZA PREPARAZIONI ATTIVE O DA RINONVARE PERCHE SCADUTE)

PER QUANTO RIGUARDA Analiti accreditati scoperti FAREI UNA COSA IN STILE "SCADENZE PROSSIMI 60 GIORNI" MA NEL BLOCCO STATO TRACCIABILITA. QUINDI CON ELENCO DEGLI ANALITI SCOPERTI CON COLLEGAMENTI AL DB COMPOSTI PER QUELLI SCADUTI O DISMESSI.
AGGIUNGEREI ANCHE UNA COSA SIMILE CON GLI ANALITI ACCREDITATI NON COPERTI DA CRM CON ACCREDITAMENTO 17034.


 ## importante


 ## altri
BAZZI - SUGGERIMENTI

- "Forma commerciale" indica il nome dello standard in db comspoti si puo cambiare in nome CRM
-   In "Nuova preparazione stock", cambio "Forma" con "Forma neat"
- in PREPARAZIONE, pescare il nome operatore da Anagrafiche su windowns non lo fa ma su mac si...)

- bug per stock solution in scadenza il giorno medesimo (le da come preparazioni scadute, ma non c'e' l'alert vicino al nome in db comspoti)

- implementare in DASHBOARD l'elenco delle prparazioni neat in scadenza o scadute 
- sarebbe bello avere un badge in db compsoti con i work in cui è coinvolta la crm (non penso abbia senso aggiungere colonne ma sarebbe bello un badge ma in caso si aggiunge una colonna solo lettura)



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



