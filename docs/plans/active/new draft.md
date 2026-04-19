# prossimi feat:








 


##
in stato tracciabilita della dashboar la card 
Analiti accreditati scoperti
1

Nessun CRM attivo con nome corrispondente
NON DA INFO AGGIUNTIVE... (CHE ANALITA?)    FAI QUALCOSA... 
PROPOSTA. SOSTITUIRE QUELLA card CON una card "WORK DA PREPARE" (SI PUO FARE CHE CLICCANDO SI ARRIVI IN WORKPAGE CON UN FILTRO DA IMPLEMNTARE ACNHE IN WORKPAGE CHE EVIDENZI LE WORK SENZA PREPARAZIONI ATTIVE O DA RINONVARE PERCHE SCADUTE)

PER QUANTO RIGUARDA Analiti accreditati scoperti FAREI UNA COSA IN STILE "SCADENZE PROSSIMI 60 GIORNI" MA NEL BLOCCO STATO TRACCIABILITA. QUINDI CON ELENCO DEGLI ANALITI SCOPERTI CON COLLEGAMENTI AL DB COMPOSTI PER QUELLI SCADUTI O DISMESSI.
AGGIUNGEREI ANCHE UNA COSA SIMILE CON GLI ANALITI ACCREDITATI NON COPERTI DA CRM CON ACCREDITAMENTO 17034.

- in metodi-> schemi gli analiti in cui i crm sono filtrati dalla destinazione duso non dovrebbero essere diasattivati come se il crm non ci fosse (scaduto o dismesso) ma deve essere formattato come un normale analita. Magari ragruppa gli analiti in questa condizione e metti un collegamnto al filtro "destinazione duso" con il colore di riferimento in maniera che cambi il filtro (è un secondo metodo di cambio filtro della destinazione d'uso alternativo a quello esistente e piu naturale)
- selezione automatica è utile perche permette di vedere tutti gli analiti del metodo. Sarebbe bello mettere anche il colegamento a db composti con filtro nome in maniera che punti al database.
si potrebbe rinominare "Selezione automatica e ripilogo"
- etichette per work standard
-metti moduli consumabili e struemnti come beta nel selettore pannello a sinistra in quanto non sono implementate ma solo abbozzzate
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



