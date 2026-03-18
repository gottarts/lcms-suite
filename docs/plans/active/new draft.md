# prossimi feat (cancellare quado passa al plan):







 manca data di apertura , concentrazione e purezza dalle colonne selezionabili
 


 ## importante

 se selezione due composti (stesso nome) e lotto in comune mi chiede di cancellarli tutti e modificarli tutti (vedi fosetyl)
 Mix parzialmente selezionato
Hai selezionato 2 di 3 componenti del mix lotto "787027". Vuoi applicare l'azione solo ai selezionati o a tutti i componenti del mix?
questa cosa succede con i composti con stesso lotto ma diverso nome che vengono per sbagli importati come mix. 
il fix potrebbe essere sganciali dal mix_id in qualche modo (infatti se si va nel form di modifica del composto che era un mix e diventa un solution si vede che è ancora agganciato a un mix_id con un certo nome)


autocompilazione preparazioni
in preparazioni mettere ubicaizone e stoccaggio invece di posizione...
rivedere stato su preparati
rivedere rivalidazione lotti uguali e nomi uguali
nuovo lotto non considera differenze tra solution e neat
 ## altri
  
 















---
# fix macOs version
versione dmg-legacy lenta su apple silicon M1
aggiungere nel package.json il seguente script
"package:mac-universal": "npm run build && electron-builder --config electron-builder.config.mac-legacy.js --mac --universal && hdiutil create -volname 'LCMS Suite' -srcfolder 'release/mac-universal/LCMS Suite.app' -ov -format UDZO release/LCMS-Suite-1.0.0-universal.dmg"
poi 
npm run package:mac-universal
questo in realta solo per capire se ce qualche altro problema con il macbook air



