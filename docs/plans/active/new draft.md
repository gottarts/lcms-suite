# prossimi feat:



## problemi lavagna
### bug blocchi
Ultimo bugfix /Users/vitogelao/Documents/Personali/Chem/Arpa/LCMS Suite Progetto/lcms-suite/docs/bugfix/2026-04-20-bugfix-lavagna-selezione-frecce-badge-groupnode.md non ha risolto il problema del raggruppamento delle card che fanno parte di un group. Le card in comune devono essere proprio separate nella lavagna rispetto al resto perche continuano a esserci accavalamenti. Il processo potrebbe prevedere per prima cosa la formazione dei gruppi e poi il posizionmento di tutte le altre card ma completamente separate. i blocchi gruppi non devono essere sovrapponibili.
### bug destinazione duso
gli analiti con destinazione duso diversa dal filtro sono acnrao non visibile nel blocco analiti della lavagna. devono essere tutti visibili ma con il badge a seconda della destinazione d'uso. hai gia fatto giusto per IS che si vedono anche con filtro taratura o QC. Pero adesso con filtro IS non vedi taratura e/o qc. IL comportamento deve essere che il filtro non oscura anliti nel blocco analiti. Semplicemtne gli analiti avranno un badge IS , T, QC, T+QC e devono essere tutti visibili. Scoperti sono solo quelli che non hanno CRM. 8magari metti una legenda per questi badge nel blocco analiti. E una nella lavagna per il codice colore crm work singoli e intermedie
### ricarica e scadenza crm
nelle card delle work in lavagna è sempre visibile il tasto ricarica che deve comparire come per la griglia solo quando c'è un problema nella work (crm scaduti, dismessi o prep neat scadute o dismesse).





 ## importante

### audit work e work dismesse
quando una work finisce in archiviata deve poter essere dismessa in maniera che non al di la della scadenza non appaia piu nell audit. attualmente la scadenza dipende dalla ricetta e anche se archiviata la ricetta la work compare ancora tra le work utilizzabili anche se ha crm scaduti. Esiste anche la possibilita che una work venga ripreparata perche finita fisicamente. in quel caso il problema è che in auti mi copare fino a scadenza una work non piu presente fisicamente in lab.

 ## altri
BAZZI - SUGGERIMENTI




## FUTURO
SERVIREBBE UN CAMPO SINONIMI (PIU NOMI NON UNO) PER GESTIRE EVENTUALI NOMI E CASISTICHE PER I COMPOSTI E MAGARI UN CAMPO CAS NUMBER. FAI MOLTA ATTENZIONE IN QUANTO IL DB COMPOSTI è DELICATO. QUESTI NUOVI CAMPI FANNO PARTE DI IDENTIFICAZIONE E DEVONO ESSERE AGGIUNTI IN TUTTI I VARI PUNTI DI COMPILAZIONE DEL DB (IMPORTAZIONI, NUOVO COMPSOTO IN TUTTE LE DIALOG ECCETERA. ). FORSE PER EVITARE PROBLEMI E MEGLIO METTERE QUESTA COSA IN UN NUOVO MODULO CHE POTREBBE ESSERE DATABASE MOLECOLE (CON DENTRO ANCHE SMILE ECCETERA.)






---
# fix macOs version
versione dmg-legacy lenta su apple silicon M1
aggiungere nel package.json il seguente script
"package:mac-universal": "npm run build && electron-builder --config electron-builder.config.mac-legacy.js --mac --universal && hdiutil create -volname 'LCMS Suite' -srcfolder 'release/mac-universal/LCMS Suite.app' -ov -format UDZO release/LCMS-Suite-1.0.0-universal.dmg"
poi 
npm run package:mac-universal
questo in realta solo per capire se ce qualche altro problema con il macbook air



