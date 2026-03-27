# prossimi feat:

 

Lo schema di uso deve essere che operatore puo creare una preparazione work se lo schema ha tutti i crm attivi con lotti validi e definiti. se ci sono ambiguita (piu lotti validi o lotto originale dismesso e aggiunta di un nuovo lotto) loperatore deve andare in schemi e creare una nuova work. A quel puonto la vecchia work card viene archiviata (con tutto il suo storico di preparazioni sorgenti e lotti)
 


quando si importa una mix con composti mancanti rispetto allo schema sarebbe il caso di mettere (nella chips del work e nei dettagli catena tracciabilita e compsoti) anche gli analiti che non sono nello schema magari evidenziandoli in qualche modo nel drawer (adesso la work importata ha solo le concentrazioni dei composti dello schema in cui viene importato ed elimina completamente gli altri)






 
 


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



