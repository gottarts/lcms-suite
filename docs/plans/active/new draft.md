# prossimi feat:









 
 


 ## importante

BUG:Il problema sta nel fatto che a comandare non è la work come oggetto generale ma la preparazione... la work in generale è un oggetto che serve a definire contenuto ricetta e tracciabilità rispetto ai crm. Audit deve usare le preparazioni come riferimento di data:
audit metodo X data Y-->cerca le work associate al metodo X --> cerca le preparazioni sia in work attive che in work archiviate che erano valide in data Y (devono essere riportate tutte) -per ognuna-> estrai info (lotti CRM,lotti CRMneat(preparazione stock), e info di preprazione della work).
questo schema deve essere monolitico per la questione audit.
attualmente audit come prende la data di "inizio" di una work. se creo una work oggi e faccio audit per ieri la vedo? vedo la work creata oggi--> questo è un gravissimo bug concettuale del sofware e va assolutamente aggiustato.


 ## altri
  
 











---
# fix macOs version
versione dmg-legacy lenta su apple silicon M1
aggiungere nel package.json il seguente script
"package:mac-universal": "npm run build && electron-builder --config electron-builder.config.mac-legacy.js --mac --universal && hdiutil create -volname 'LCMS Suite' -srcfolder 'release/mac-universal/LCMS Suite.app' -ov -format UDZO release/LCMS-Suite-1.0.0-universal.dmg"
poi 
npm run package:mac-universal
questo in realta solo per capire se ce qualche altro problema con il macbook air



