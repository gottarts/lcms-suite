# prossimi feat (cancellare quado passa al plan):

 ## importante
 
 
 nel tool di calcolo delle preparazioni sarebbe utile avere nella modalita aggiunta in volume il calcolo del peso da aggiungere:
 1 mL --> x grammi (in base a densita) in maniere identica a come nella modalita per pesata calcola il volume effettivo da aggiungere
 Cambierei leggermente il fuznionamento. una volta scelto conc target mg pesati e solvente (densita) come per aggiunta del volume il tool presenta il volume da aggiungere per arrivare alla conc target. Sotto dove attualmente c'e la ccncentrazione ottenuta metterei il campo per inserire volume (o pesata effettivi e quindi la concentrazione reale)


 ## altri
 metti aggiungi mix vicino a aggiungi composto  (adesso importa csv è in mezzo)
 il pulsante elimina deve eliminare tutti i composti di miscele per lotto

 dare un nome migliore alla tabella nella barra sinistra e cambiare la ripetizione standard di riferimento presente nella tabella composti. pensavo di chamarla CRM book o crm storico o crm db (fammi proposte serie).

 mettere un segno di fiala chiusa vicino ai crm chiusi (fammi proposte) e il tastiono prep davanti a tutti i neat (se non ci sono preparazioni conteggio 0)

 inserire tra le destinazioni d'uso le possibilita con scelta a tendina (Taratura, Controllo qualita, Taratura+ControlloQualità, Standard Interno) e di queste aggiungere un filtro accanto a quelli Stato e Work.

 Inserisci un controllo che verifichi che la data di apertura sia inferiore di quella di scadenza (dopo il salva solo un avviso)
 🔮 Feat futura nota — Alert date anomale nello storico
 Da pianificare in una sessione successiva: se data_apertura del composto è successiva alla data di qualsiasi evento in composti_storia, mostrare un avviso visivo nello storico (es. icona ⚠️ sull'evento "Apertura" in fondo). L'unica eccezione ammessa è scadenza_prodotto, che per natura può precedere la data di apertura in laboratorio.



 Servira un tasto di export. Intanto in csv poi dovremo ragionare sulla reportistica e la stampa etichette



















---
# fix macOs version
versione dmg-legacy lenta su apple silicon M1
aggiungere nel package.json il seguente script
"package:mac-universal": "npm run build && electron-builder --config electron-builder.config.mac-legacy.js --mac --universal && hdiutil create -volname 'LCMS Suite' -srcfolder 'release/mac-universal/LCMS Suite.app' -ov -format UDZO release/LCMS-Suite-1.0.0-universal.dmg"
poi 
npm run package:mac-universal
questo in realta solo per capire se ce qualche altro problema con il macbook air



