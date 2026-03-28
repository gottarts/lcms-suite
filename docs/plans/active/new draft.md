# prossimi feat:

 

2026-03-28-feat-flusso-operatore-blocco-ambiguita-resoconto-sessione
Analisi critica del sistema di gestione Work — problemi aperti
(rispetto a tutti gli 8 punti e chiaro che ci vuole una semplificazione. Lasciando perdere il caso estremo dei lotti dismessi, in caso di ambiguita come avere piu lotti del crm la cosa è gia gestita dallo schema  in quanto l operatore scegli il crm da usare. anche il meccanismo attuale di eliminazione in caso di presenza di piu tipi di crm mix o soluiozne è inutile poi che l operatore seleziona volutamente il crm che vuole usare per creare la work. dico giusto se dico che questo meccanismo dell ambiguita e superfluo dato il flow di utilizzo attuale? per di piu le chips delle work hanno il tasto di ricarica lotti. ricordarsi che quando si ricarica un lotto si sta creando una nuova mix in realta e quindi devono cambiare le informazioni della chips e nei drawer. l unica ambiguita sensata è la presenza nella work di crm scaduti. ecco in quel caso sarebbe il caso di segnalarlo)
 


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



