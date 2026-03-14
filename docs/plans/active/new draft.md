# prossimi feat (cancellare quado passa al plan):









 ## importante



 adesso ci sono due meccanismi di importazione massiva. Tramite aggiugi mix si puo sostanzialmtene importare miscele con import text guidato. Pero in relta c'e da definire la logica. 
 Questa importazione non importa un unico prodotto ma piu prodotti (infatti si possono avere piu lotti) il problema e che la app considera tutti i lotti come se fossero un unico mix_id. in realta non e formalmente cosi. Se importo 20 righe di composti con 4 lotti ho 4 crm miscela quindi 4 mix_id. 
 
 A questo punto terrei la feat che e utili ma farei in modo che solo un singolo mix possa essere aggiunto tramite aggiungi mix. 

 Per aggiungere massivamente piu mix useremo il import normale della tabella composti Import csv (o excel). applicherei anche a questo la funzione di selezione e aggancio dei campi (adesso ce solo funzione aggancio campi ma non anteprima e scelta riga intestazione). Una cosa molto importatnte e la questione Forma. attualemnte forma ha Solution e Neat ma va aggiunta anche Mix e i composti che hanno Mix dovranno avere il badge. In sosteanza se si fa un import di sostanza e ci sono piu composti con nomi diversi e stessi campi allora il composto fa parte di una mix e dovra avere forma Mix e badge. Considererei mix come una proprieta che deriva dall'avere piu righe in tabella con lo stesso lotto.

per quanto riguarda il tasto cancella va fatta una miglioria. Bisogna dare la possibilita di cancellare massivamente i composti. vedi tu quale il modo piu comodo. Si puo fare che quando si applica un filtro alla tabella ci sia il tasto nuovo lotto, rivalidazione, dismetti, cancella che sia applica a tutta la selezione


 ## altri
  
serve un tasto che escluda i scaduti (un filtro di qualche tipo)
 
POi ce il discorso del campo classe che in inserimento e bloccato con solo alcune possibilita. bisogna lasciare libero (suggeeire i composti le classi gia create). I campi di tutti i form potrebbereo andare in automatico a popolare i moduli anagrafiche. Nel caso di classi inserendo (o importando composti) la app compila in agrafiche tutte quelle inserire nel db composti. In questo modo se ci sono classi simili esempio Pesticidi e fito si va anagrafiche si modifica e l app mergia la voce in anagrafighe e mette tutti i composti sotto anagrafica scelta (dimmi se capisci sta cosa).















---
# fix macOs version
versione dmg-legacy lenta su apple silicon M1
aggiungere nel package.json il seguente script
"package:mac-universal": "npm run build && electron-builder --config electron-builder.config.mac-legacy.js --mac --universal && hdiutil create -volname 'LCMS Suite' -srcfolder 'release/mac-universal/LCMS Suite.app' -ov -format UDZO release/LCMS-Suite-1.0.0-universal.dmg"
poi 
npm run package:mac-universal
questo in realta solo per capire se ce qualche altro problema con il macbook air



