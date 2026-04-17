# prossimi feat:








 
Esiste la possibilita che una work sorgente di una work figlia finisca prima della scadenza. In quel caso se ne prepara una nuova ma la work figlia non e tracciata nei confronti della preparazione della madre. Si potrebbe metter un controllo sulle date di preparazione. La work figlia viene sempre preparata quando si prepara un nuova work madre. Quindi deve avere una data successiva. si puo mettre un controllo data in cui si avvisa nel caso che la preparazione figlia ha una data inferiore a quella della nuova madre. Che ne dici? oestamente. (magari dammi un suggeriemto)

sarebbe bello avere in wokpage i colori delle righe delle work uguali al codice colore delle chips in schemi calibrazione (arancione e viola) ma gari solo della riga e le preparazioni come adesso.
Mettere in selezione metodo audit il nome - Nome esteso del metodo (e non quel progressivo tuo)



 ## importante


 ## altri











---
# fix macOs version
versione dmg-legacy lenta su apple silicon M1
aggiungere nel package.json il seguente script
"package:mac-universal": "npm run build && electron-builder --config electron-builder.config.mac-legacy.js --mac --universal && hdiutil create -volname 'LCMS Suite' -srcfolder 'release/mac-universal/LCMS Suite.app' -ov -format UDZO release/LCMS-Suite-1.0.0-universal.dmg"
poi 
npm run package:mac-universal
questo in realta solo per capire se ce qualche altro problema con il macbook air



