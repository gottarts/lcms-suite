# prossimi feat:




 Ci sono dei miglioramente sempre per quanto riguarda la gestione work in schemi e workpage:
la feat di ricarica funziona bene per quanto riguarda i crm dismessi e quindi il pulsante riarica sui chips degli schemi. 
La cosa è da estendere anche i crm scaduti



mettere il collegamento al db composti anche per la colonna anliti del scehma calibrazione. se lanalita ha i crm attivi visualizzare la tabella coi composti non dismessi. se il composto ha solo crm dismessi o inesitenti puntare alla tabella con il filtro mostra dismessi attivo.


 
 


 ## importante


 bisognera creare un archivio di schemi calibrazione. 
 
 In piu bisognera differenziare tra scehmi per destinazione d'uso (le stesse di db composti) cioe se e uno schema per taratura, qc, taratura+qc o IS. Magari con scelta con menu a tendina. Quando si salva lo schema deve poer essere richiamabile (Magari da metodi) se uno schema va in disuso deve essere archiviabile e consultabile ma congelato.






 ## altri
  
 
nella card delle work in workpage dece esserci la selezione del metodo come filtro delle work. 





in compound db il nuovo lotto su crm mix mette la concentrazione dei componenti del nuovo lotto uguale a quello selezionato per il nuovo lotto...








---
# fix macOs version
versione dmg-legacy lenta su apple silicon M1
aggiungere nel package.json il seguente script
"package:mac-universal": "npm run build && electron-builder --config electron-builder.config.mac-legacy.js --mac --universal && hdiutil create -volname 'LCMS Suite' -srcfolder 'release/mac-universal/LCMS Suite.app' -ov -format UDZO release/LCMS-Suite-1.0.0-universal.dmg"
poi 
npm run package:mac-universal
questo in realta solo per capire se ce qualche altro problema con il macbook air



