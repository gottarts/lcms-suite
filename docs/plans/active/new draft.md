# prossimi feat (cancellare quado passa al plan):



 

 pesante:
 bisogna partire con gli schemi di preparazione delle soluzioni work. le work sono soluzioni preprate dalle solution, dalle mix e dai neat/preparati. Sarebbe bello avere nel metodo lo schema calibrazione. 
 Mi piacerebbe farequalcosa con excalidraw che ti metto in chat


 
 


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



