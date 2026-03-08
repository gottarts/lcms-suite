Feat A - ✅ Implementazione completata
Cosa ho fatto
#	File	Istruzione	Stato
1	CompostiTable.tsx	Rimuovere colonna matrice	✅ Nessuna azione (non presente)
2	CompostoPanel.tsx	Rimuovere <Field label="Matrice" ...> dal tab Dettaglio	✅ Rimosso
3	CompostoForm.tsx	Rimuovere campo input matrice dal form	✅ Rimosso
4	types.ts	Aggiungere commento @deprecated	✅ Aggiunto
5	Verifica	Confermare zero occorrenze nei file Composti	✅ Verificato
Note finali
Il campo matrice rimane nel tipo TypeScript Composto con commento @deprecated, quindi non rompe la compatibilità con l'IPC e il DB
Gli altri moduli (Metodi, Strumenti) mantengono matrice correttamente — il campo è rilevante solo lì
Nessuna migrazione DB necessaria — il field rimane nella tabella SQLite per retrocompatibilità

FEAT-B — ✅ Implementazione completa
File	Operazione	Stato
006-unita-conc.sql	Migration DB	✅
types.ts	Tipi Composto + Preparazione	✅
unita.ts	Costanti + parseConcentrazione	✅
composti.ipc.ts	SELECT, INSERT, UPDATE + fix tipo	✅
preparazioni.ipc.ts	SELECT, INSERT, UPDATE	✅
CompostoForm.tsx	Select unita_conc	✅
PrepCalcTool.tsx	Numero puro + unita_conc	✅
PreparazioniTab.tsx	Display + Select + payload	✅
CompostoPanel.tsx	Display con parseConcentrazione	✅
Build TypeScript	0 errors	✅
✅ Modifiche completate su 

MixPesticidiForm.tsx

Riepilogo cambiamenti:
Sezione	Modifica	Stato
Import	Aggiunto UNITA_CONCENTRAZIONE, UNITA_DEFAULT	✅
Stato iniziale	Aggiunto campo unita_conc: UNITA_DEFAULT	✅
Reset form	Aggiunto unita_conc: UNITA_DEFAULT	✅
JSX label	Cambiato da "Concentrazione mg/L (per componente)" a "Concentrazione"	✅
JSX Select	Aggiunto Select unità accanto a Concentrazione	✅
Payload Save	Incluso unita_conc: form.unita_conc \|\| UNITA_DEFAULT	✅

