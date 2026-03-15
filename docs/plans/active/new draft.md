# prossimi feat (cancellare quado passa al plan):









 ## importante

 Modifica in blocco mix
 Questo composto fa parte del mix O27 che contiene 611 componenti.

 Tutti i campi comuni (lotto, date, concentrazione, destinazione, work standard, ubicazione, metodi e altri) verranno aggiornati su tutti i componenti del mix. Solo il nome del singolo composto rimarrà invariato.

 Vuoi procedere?

 non puo essere che abbia tutti quei composti. ce un errore concettuale nella definizione di mix. La mix O27 ha 27 commposti. 
 Ho verificato il comportamento. Il form modifica della barra laterale modifica tutti i composti della mix inserita ossia modifica tutti i lotti e non solo la miscela O27 (che ha un lotto diverso dalle altre.) Continua a esserci questa ambiguita dovuta al fatto che il tasto aggiungi mix in realta permette di inserire non una sola mix ma piu mix con lotti diversi (cioe flaconi diversi)
 Data la situazione ambigua farei un passo indietro e permettrei di aggiungere solo le miscele di un certo lotto tramite il tasto mix. 
 Per aggiungere massivamente piu mix (cioe piu flaconi contenenti miscele di composti) useremo il import normale della tabella composti Import csv (o excel). applicherei anche a questo la funzione di selezione dell intestaione e aggancio dei campi (adesso ce solo funzione aggancio campi ma non anteprima e scelta riga intestazione). Una cosa molto importatnte e la questione Forma. attualemnte forma ha Solution e Neat ma va aggiunta anche Mix e i composti che hanno Mix dovranno avere il badge. In sosteanza se si fa un import di sostanza e ci sono piu composti con nomi diversi e stessi campi allora il composto fa parte di una mix e dovra avere forma Mix e badge. Considererei mix come una proprieta che deriva dall'avere piu righe in tabella con lo stesso lotto. 
 viceversa se si importa una serie di miscele tramite il form aggiungi mix e dentro ci fossere delle sostanze in dei lotti unici (cioe un lotto una sostanza) allora il form avvisa l utente di selezionare quale miscela vuole inserire (elenco delle miscele presenti)

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



