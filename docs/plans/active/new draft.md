# prossimi feat:








 
Problema
Le Work intermedie (sorgenti di tipo "work") non tracciano correttamente:

Sorgenti: Usano solo i CRM diretti, ignorando le Work intermedie come sorgenti. Se non ci  sono CRM diretti la tracciabilita e nulla.
Composti: Non mostrano i CRM contenuti nelle Work intermedie nella lista finale.
Dashboard Audit: Non visualizza le Work intermedie né i CRM al loro interno.
Anche i calcoli hanno problemi. Solamente quando deve calcolare dalle Work (i crm Funzionano) forse non prende la concentrazione dei composti nella work (deve prendere  la concentrazione dei compsoti nelal work acnhe perche poi nella work intermedia ci deve essere la lista dei composti con la concentrazione corretta).

Requisiti

Tracciabilità ricorsiva:

Se una Work usa un'altra Work come sorgente, deve tracciare tutti i CRM e le Work intermedie coinvolte.
Esempio:
text
Copia

WorkFinale
  ├── WorkIntermedia1 (con identificativo preparazione)
  └── CRM_C

→ La WorkFinale deve tracciare i CRM contenuti: [CRM_A, CRM_B, CRM_C, WorkIntermedia1].

Per le intermedie negli schemi devono devono esserci le evideze sulle scadenze delle sorgenti... di base se un crm o una work sorgente ha errori deve essere evidente nello schema in maniera che si possa archiviare quella work e crearne una nuova con crm e sorgenti work valide.

Dashboard Audit:

Mostrare tutte le Work intermedie e i CRM contenuti, con badge per scadenza e link al dettaglio in work page compreso archivio (con filtro in maniera che si veda solo quella selzionata).




 ## importante
[2] Error occurred in handler for 'composti:update': SqliteError: UNIQUE constraint failed: metodo_analiti.metodo_id, 
metodo_analiti.nome
[2]     at C:\Users\6500QTRAP-01\Documents\LCMS Suite Repository\lcms-suite\dist\main\ipc\composti.ipc.js:366:39      
[2]     at sqliteTransaction (C:\Users\6500QTRAP-01\Documents\LCMS Suite Repository\lcms-suite\node_modules\better-sqlite3\lib\methods\transaction.js:65:24)
[2]     at C:\Users\6500QTRAP-01\Documents\LCMS Suite Repository\lcms-suite\dist\main\ipc\composti.ipc.js:385:11      
[2]     at Session.<anonymous> (node:electron/js2c/browser_init:2:116675)
[2]     at Session.emit (node:events:508:28) {
[2]   code: 'SQLITE_CONSTRAINT_UNIQUE'

 ## altri











---
# fix macOs version
versione dmg-legacy lenta su apple silicon M1
aggiungere nel package.json il seguente script
"package:mac-universal": "npm run build && electron-builder --config electron-builder.config.mac-legacy.js --mac --universal && hdiutil create -volname 'LCMS Suite' -srcfolder 'release/mac-universal/LCMS Suite.app' -ov -format UDZO release/LCMS-Suite-1.0.0-universal.dmg"
poi 
npm run package:mac-universal
questo in realta solo per capire se ce qualche altro problema con il macbook air



