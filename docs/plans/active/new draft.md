# prossimi feat (cancellare quado passa al plan):









 ## importante

 
adesso segnale non ha accreditamento tra i campi da segnalare. Forse perche ha il tasto altro...


 ## altri
  
 
POi ce il discorso del campo classe che in inserimento e bloccato con solo alcune possibilita. bisogna lasciare libero (suggeeire i composti le classi gia create). I campi di tutti i form potrebbereo andare in automatico a popolare i moduli anagrafiche. Nel caso di classi inserendo (o importando composti) la app compila in agrafiche tutte quelle inserire nel db composti. In questo modo se ci sono classi simili esempio Pesticidi e fito si va anagrafiche si modifica e l app mergia la voce in anagrafighe e mette tutti i composti sotto anagrafica scelta (dimmi se capisci sta cosa).















---
# fix macOs version
versione dmg-legacy lenta su apple silicon M1
aggiungere nel package.json il seguente script
"package:mac-universal": "npm run build && electron-builder --config electron-builder.config.mac-legacy.js --mac --universal && hdiutil create -volname 'LCMS Suite' -srcfolder 'release/mac-universal/LCMS Suite.app' -ov -format UDZO release/LCMS-Suite-1.0.0-universal.dmg"
poi 
npm run package:mac-universal
questo in realta solo per capire se ce qualche altro problema con il macbook air



