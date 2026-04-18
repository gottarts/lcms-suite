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
- metodi -- schema-   La grafica della "scadenza" nelle ricette sembra indicare la scadenza di una preparazione fisica specifica. Dovrebbe indicare invece la scadenza assegnata attribuita. Suggerimeto:togliere il codice colore (verde) e lasciarla solo come in dicazione testuale
- WORK STANDARDS Tasto in  alto a sx "+Nuova Work" e' ridondante (c'e gia' l'opzione "prepara" su ogni singola ricetta)
-"Forma commerciale" indica il nome dello standard (non e' nota di modifica, solo nota promemoria)
-   In "Nuova preparazione stock", cambio "Forma" con "Forma neat"
- Cambiare unita di misura quando mostra riepilogo ricetta nuova work (ora in ml, cambiare in µl per maggiore immediatezza visiva essendo un riepilogo ricetta con volumi di diluizione)
- su SCHEMI, difetto grafico nella colonna CRM a sx (non vedo l'icona di collegamento a Reference standard che dovrebbe essere accanto al nome. C e', e' cliccabile, ma non si vede)
- su SCHEMI tolgo il comando "ricarica" dalle soluzioni work intermedie
- in PREPARAZIONE, pescare il nome operatore da Anagrafiche
- implementare in DASHBOARD l'elenco delle stock solution in scadenza o scadute
- bug per stock solution in scadenza il giorno medesimo (le da come preparazioni scadute, ma non c'e' l'alert)




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



