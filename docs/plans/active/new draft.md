# prossimi feat:

 
Lista composti CRM — gli analiti eliminati dal metodo non dovrebbero sparire da CRM/work dello schema di calibrazione, perché CRM e work devono includere anche composti presenti nei prodotti ma non nel metodo. Tutti i dettagli e le descrizioni degli work devono indicare il reale contenuto. NOn so come hai organizzato il database ma la logica principale è che c'e una lista magazzino (db composti), una lista di parametri dei metodi (che come adesso comunica con il db composti accetando composti in cui viene indicato il metodo nel db composti e allo stesso tempo cancella il campo metodi in db composti quando il parametro viene eliminato dal metodo) e gli schemi di calibrazione prendono gli analiti dai parametri del metodo e i crm dai db composti.

Anche nel drawer metodo bisogna sistemare questo
Composti associati (37 sostanze, 38 lotti) . l elenco sono le sostanze dele metodo. 


 
alcune work vivono su piu metodi e sono uguali. bisogna far si che ci sia il modo di riciamarle negli schemi di altri metodi, che ci sia una condivisione delle work (se il metodo ha gli stessi crm per quella work)

capire gestione lotto nealla preparazione work. 
 Forse anche in schema calibraioni si possono rimettere i lotti. che succede se un crm cambia lotto e il vecchio viene dismesso? sarebbe il caso se ci sono queste vaariazioni che il work nella pagina workpage venga bloccato in maniera che l operatore non possa fare preparazioni con lo schema con lotti errati o modificati o scaduti. 
 Lo schema di uso deve essere che operatore puo creare una preparazione work se lo schema ha tutti i crm attivi con lotti validi e definiti. se ci sono ambiguita (piu lotti validi o lotto originale dismesso e aggiunta di un nuovo lotto) loperatore deve andare in schemi e creare una nuova work. A quel puonto la vecchia work card viene archiviata (con tutto il suo storico di preparazioni sorgenti e lotti)
 


 ## importante


 bisognera creare un archivio di schemi calibrazione. In piu bisognera differenziare tra scehmi per destinazione d'uso (le stesse di db composti) cioe se e uno schema per taratura, qc, taratura+qc o IS. Magari con scelta con menu a tendina. Quando si salva lo schema deve poer essere richiamabile (Magari da metodi) se uno schema va in disuso deve essere archiviabile e consultabile ma congelato.






 ## altri
  
 
nella card delle work in workpage dece esserci la selezione del metodo come filtro delle work. 














---
# fix macOs version
versione dmg-legacy lenta su apple silicon M1
aggiungere nel package.json il seguente script
"package:mac-universal": "npm run build && electron-builder --config electron-builder.config.mac-legacy.js --mac --universal && hdiutil create -volname 'LCMS Suite' -srcfolder 'release/mac-universal/LCMS Suite.app' -ov -format UDZO release/LCMS-Suite-1.0.0-universal.dmg"
poi 
npm run package:mac-universal
questo in realta solo per capire se ce qualche altro problema con il macbook air



