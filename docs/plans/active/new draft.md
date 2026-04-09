# prossimi feat:









 
 


 ## importante

 ### Sezione Audit CRM
 Una sezione dedicata dell'app (separata dalle pagine operative) che permette di verificare lo stato dei CRM usati nei work rispetto a una data fornita dall'utente.

 **Funzionalità:**
 - L'utente seleziona un metodo e una data → l'app mostra la tabella di match tra analiti accreditati e CRM disponibili
 - Per ogni analita accreditato (`metodo_analiti.accreditato = 1`): stato CRM (✓ valido / ⚠ in scadenza / ⚠ nessuna scadenza / ❌ GAP)
 - Lotto e scadenza del CRM corrispondente quando presente
 - Evidenziazione in scadenza entro 30 giorni dalla data selezionata
 - Sommario: totale accreditati, coperti, gap, in scadenza
 - Filtro per stato
 - Esportabile come documento (es. MD o PDF) per tracciabilità

 **Query chiave (già prototipata):**
 `metodo_analiti` (accreditato=1) → LEFT JOIN su `work_ingredienti` + `composti` per nome → stato calcolato sulla `scadenza_prodotto`







 ## altri
  
 











---
# fix macOs version
versione dmg-legacy lenta su apple silicon M1
aggiungere nel package.json il seguente script
"package:mac-universal": "npm run build && electron-builder --config electron-builder.config.mac-legacy.js --mac --universal && hdiutil create -volname 'LCMS Suite' -srcfolder 'release/mac-universal/LCMS Suite.app' -ov -format UDZO release/LCMS-Suite-1.0.0-universal.dmg"
poi 
npm run package:mac-universal
questo in realta solo per capire se ce qualche altro problema con il macbook air



