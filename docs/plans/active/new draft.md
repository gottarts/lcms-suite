# prossimi feat:









 
 


 ## importante


Consolidate calibration drawer schemas
(finire con nome metodo e fare resoconto sessione)

 ## altri
  mettere link a db composti per tutti i badge dei crm in audit CRM della dashboard
 











---
# fix macOs version
versione dmg-legacy lenta su apple silicon M1
aggiungere nel package.json il seguente script
"package:mac-universal": "npm run build && electron-builder --config electron-builder.config.mac-legacy.js --mac --universal && hdiutil create -volname 'LCMS Suite' -srcfolder 'release/mac-universal/LCMS Suite.app' -ov -format UDZO release/LCMS-Suite-1.0.0-universal.dmg"
poi 
npm run package:mac-universal
questo in realta solo per capire se ce qualche altro problema con il macbook air



