# prossimi feat (cancellare quado passa al plan):

 ## importante


 ## altri
 aggiungi mix vicino a aggiungi composto  (adesso importa csv è in mezzo)
 il pulsante elimina deve eliminare tutti i composti di miscele per lotto

 dare un nome migliore alla tabella nella barra sinistra e cambiare la ripetizione standard di riferimento presente nella tabella composti. pensavo di chamarla CRM book o crm storico o crm db (fammi proposte serie).

 



 Servira un tasto di export. Intanto in csv poi dovremo ragionare sulla reportistica e la stampa etichette



















---
# fix macOs version
versione dmg-legacy lenta su apple silicon M1
aggiungere nel package.json il seguente script
"package:mac-universal": "npm run build && electron-builder --config electron-builder.config.mac-legacy.js --mac --universal && hdiutil create -volname 'LCMS Suite' -srcfolder 'release/mac-universal/LCMS Suite.app' -ov -format UDZO release/LCMS-Suite-1.0.0-universal.dmg"
poi 
npm run package:mac-universal
questo in realta solo per capire se ce qualche altro problema con il macbook air



