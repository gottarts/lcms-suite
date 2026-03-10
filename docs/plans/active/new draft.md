# prossimi feat (cancellare quado passa al plan):


 ## importante3

 bisogna aggiungere allo storico la data di apertura per singoli e mix
 il tasto dismetti non funziona... (bisonagna ggiungerlo funzionante anche alla barra laterale)

 ## altri
 inserire tra le destinazioni d'uso le possibilita con scelta a tendina (Taratura, Controllo qualita, Standard Interno) e di queste aggiungere un filtro accanto a quelli Stato e Work.

 nel tool di calcolo delle preparazioni sarebbe utile avere nella modalita aggiunta in volume il calcolo del peso da aggiungere:
 1 mL --> x grammi (in base a densita) in maniere identica a come nella modalita per pesata calcola il volume effettivo da aggiungere



















---
# fix macOs version
versione dmg-legacy lenta su apple silicon M1
aggiungere nel package.json il seguente script
"package:mac-universal": "npm run build && electron-builder --config electron-builder.config.mac-legacy.js --mac --universal && hdiutil create -volname 'LCMS Suite' -srcfolder 'release/mac-universal/LCMS Suite.app' -ov -format UDZO release/LCMS-Suite-1.0.0-universal.dmg"
poi 
npm run package:mac-universal
questo in realta solo per capire se ce qualche altro problema con il macbook air



