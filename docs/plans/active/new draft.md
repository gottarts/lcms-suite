# prossimi feat (cancellare quado passa al plan):









 ## importante

 

per quanto riguarda il tasto cancella va fatta una miglioria. Bisogna dare la possibilita di cancellare massivamente i composti. vedi tu quale il modo piu comodo. Si puo fare che quando si applica un filtro alla tabella ci sia il tasto nuovo lotto, rivalidazione, dismetti, cancella che sia applica a tutta la selezione


 ## altri
  
serve un tasto che escluda i scaduti (un filtro di qualche tipo)
 
POi ce il discorso del campo classe che in inserimento e bloccato con solo alcune possibilita. bisogna lasciare libero (suggeeire i composti le classi gia create). I campi di tutti i form potrebbereo andare in automatico a popolare i moduli anagrafiche. Nel caso di classi inserendo (o importando composti) la app compila in agrafiche tutte quelle inserire nel db composti. In questo modo se ci sono classi simili esempio Pesticidi e fito si va anagrafiche si modifica e l app mergia la voce in anagrafighe e mette tutti i composti sotto anagrafica scelta (dimmi se capisci sta cosa).















---
# fix macOs version
versione dmg-legacy lenta su apple silicon M1
aggiungere nel package.json il seguente script
"package:mac-universal": "npm run build && electron-builder --config electron-builder.config.mac-legacy.js --mac --universal && hdiutil create -volname 'LCMS Suite' -srcfolder 'release/mac-universal/LCMS Suite.app' -ov -format UDZO release/LCMS-Suite-1.0.0-universal.dmg"
poi 
npm run package:mac-universal
questo in realta solo per capire se ce qualche altro problema con il macbook air



