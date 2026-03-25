# prossimi feat:

 

c'e un problema bug nella griglia schemi calibrazione.
Quando una analita ha sia crm mix che crm singoli (caso in cui operatore deve correggere manualmente) bisogna cambiare approccio... 
Adesso la gliglia mette questi analiti prima degli analiti con solo crm mix. questo rompe completamente la griglia nei casi gli analiti (con mix e singoli) sono piu di uno e hanno crm mix diversi. Poiche lo schema forza lo spostamento delle chips mix costringendo a avvicinare chips di crm mix diversi (vicini solo perche associati a analiti con crm mix e singoli che vengono spostati forzatamente vicini e sopra i analiti con solo crm mix ) . In realta a questo punto bisogna eliminare questa regola e e mettere:
-sopra solo puri
-poi le mix
quando i composti hanno sia mix che singoli bisogna semplicemnte inserire la chips dei singoli nella apposita colonna senza forzare lo spostamento dell'analita in alto rispetto alla sua posizione rispetto alla chips mix. 
magari nell'ordinare gli analiti associati a ciascuna mix sarebbe meglio mettere per primi come ordine (in ciascun blocco crm mix) glia analiti che hanno anche i crm singoli.







alcune work vivono su piu metodi e sono uguali. bisogna far si che ci sia il modo di riciamarle negli schemi di altri metodi, che ci sia una condivisione delle work (se il metodo ha gli stessi crm per quella work)

capire gestione lotto nealla preparazione work. 
 Forse anche in schema calibraioni si possono rimettere i lotti. che succede se un crm cambia lotto e il vecchio viene dismesso? sarebbe il caso se ci sono queste vaariazioni che il work nella pagina workpage venga bloccato in maniera che l operatore non possa fare preparazioni con lo schema con lotti errati o modificati o scaduti. 
 Lo schema di uso deve essere che operatore puo creare una preparazione work se lo schema ha tutti i crm attivi con lotti validi e definiti. se ci sono ambiguita (piu lotti validi o lotto originale dismesso e aggiunta di un nuovo lotto) loperatore deve andare in schemi e creare una nuova work. A quel puonto la vecchia work card viene archiviata (con tutto il suo storico di preparazioni sorgenti e lotti)
 


 ## importante


 bisognera creare un archivio di schemi calibrazione. 
 
 In piu bisognera differenziare tra scehmi per destinazione d'uso (le stesse di db composti) cioe se e uno schema per taratura, qc, taratura+qc o IS. Magari con scelta con menu a tendina. Quando si salva lo schema deve poer essere richiamabile (Magari da metodi) se uno schema va in disuso deve essere archiviabile e consultabile ma congelato.






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



