# prossimi feat:



##

"work con problemi" in dashboard deve avere il badge con link e filtro...
in audit dashboard ci deve essere anche il "lotto"  dell worka.
in audit esporta pdf anche bisogna mettre il progressivo ricetta work.


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



