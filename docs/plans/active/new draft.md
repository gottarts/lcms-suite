# prossimi feat (cancellare quado passa al plan):

 ## importante
 nel form aggiungi mix mancano molti campi tra cui codice interno, accreditamento ecc...

 ## altri
  la ricerca non funziona per i metodi (nil filtro filtra tutti i compond). 
  Ogni composto inserito compare nei metodi. ad esempio metodo pos14 ha 3 volte acrylamide. Ciascun composto (con lo stesso nome) deve comparire singolarmente nel metodo. Anche i nomi metodi devono essere mergiati se uguali. ad esempio se cambio nome a un metodo (e lo faccio uguale ad un altro i composti devono mergiare.)


















---
# fix macOs version
versione dmg-legacy lenta su apple silicon M1
aggiungere nel package.json il seguente script
"package:mac-universal": "npm run build && electron-builder --config electron-builder.config.mac-legacy.js --mac --universal && hdiutil create -volname 'LCMS Suite' -srcfolder 'release/mac-universal/LCMS Suite.app' -ov -format UDZO release/LCMS-Suite-1.0.0-universal.dmg"
poi 
npm run package:mac-universal
questo in realta solo per capire se ce qualche altro problema con il macbook air



