# prossimi feat (cancellare quado passa al plan):


 ## importante2
 Ci vuole il campo e n fiale anche per il form aggiunta mix.
 ci vuole anche un sistema che se viene modificato il campo fiale per un composto contenuto in una mix i composti associati a quella mix abbiano il sistema di contatore filale. 
 In tutti i form il campo filae deve essere attivare il conteggio (pallini solo se il numero e maggiore di 1) se lasciato biuaco o scritto 1 il conteggio non parte. 
 
 ## importante3

 bisogna aggiungere allo storico la data di apertura per singoli e mix

 ## altri
 nel tool di calcolo delle preparazioni sarebbe utile avere nella modalita aggiunta in volume il calcolo del peso da aggiungere:
 1 mL --> x grammi (in base a densita) in maniere identica a come nella modalita per pesata calcola il volume effettivo da aggiungere

tutti i nuovi composti inseriti devono andare in coda. sia nuovo lotto che aggiunta mix non hanno questo comportamento

quantdo si ordina una colonna non ce modo di eliminare ordinamento (magari il terzo lick potrebbe resettare orinamento colonna)

















---
# fix macOs version
versione dmg-legacy lenta su apple silicon M1
aggiungere nel package.json il seguente script
"package:mac-universal": "npm run build && electron-builder --config electron-builder.config.mac-legacy.js --mac --universal && hdiutil create -volname 'LCMS Suite' -srcfolder 'release/mac-universal/LCMS Suite.app' -ov -format UDZO release/LCMS-Suite-1.0.0-universal.dmg"
poi 
npm run package:mac-universal
questo in realta solo per capire se ce qualche altro problema con il macbook air



