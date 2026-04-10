QUESTO PIANO HA DEI MIEI COMMENTI IN MAIUSCOLO. DEVI SEGUIRLI!!
Ready for review
Select text to add comments on the plan
Piano: Spostare il percorso storage dalla Topbar al footer della Sidebar
Context
Attualmente il percorso del database (dbPath) viene mostrato come testo nella Topbar, accanto al titolo della pagina. Questo crea una riga di testa che ripete spesso il nome della pagina + il percorso — ridondante e poco elegante.

L'obiettivo è spostare tutto il controllo della cartella storage in una sezione dedicata in fondo alla Sidebar (stile pannello di controllo), ispirandosi al layout della versione originale dell'app che mostra in basso: stato sincronizzazione, data, pulsanti BACKUP / RIPRISTINA / CAMBIA CARTELLA.

Cosa cambia
1. Topbar.tsx — rimozione del dbPath
Eliminare la prop dbPath e il relativo <span> con il percorso
La Topbar diventa solo il titolo della pagina (riga sottile)
2. AppLayout.tsx — smettere di passare dbPath a Topbar
Rimuovere dbPath dallo state e dall'useEffect che chiama getConfig()
Non passare più dbPath a <Topbar>
3. Sidebar.tsx — aggiungere sezione footer storage
Sostituire il footer attuale (solo orario) con un pannello strutturato:

┌─────────────────────────────┐
│           14:35             │  ← orario (centrato, separato da border-b) SI MA METTILO SOTTO!!!
├─────────────────────────────┤
│ ● suite                     │
│   /path/to/lcms.db (trunc.) │
│   ven 10 apr 2026           │
│ [CAMBIA CARTELLA]           │
└─────────────────────────────┘
Dettagli implementativi della Sidebar:

Aggiungere useState per dbPath (stringa) e today (data formattata)
useEffect che chiama window.electronAPI.getConfig() per ottenere dbPath
Funzione handleChangeFolder che chiama window.electronAPI.selectFolder() e aggiorna dbPath in caso di successo
Mostrare il percorso abbreviato (solo nome cartella padre + /lcms.db) con title per il full path in tooltip
Mostrare data in formato "ven 10 apr 2026" (QUESTA DATA NON HA PIU SENSO METTERLA VICINA LORARIO E CREARE UN PARTE DEDICATA IN FONDO CON DATA E ORARIO) con toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
Pulsante "CAMBIA CARTELLA" in stile compatto (testo piccolo, bordo sottile)
Non aggiungere BACKUP/RIPRISTINA ora — non esistono IPC per questi; solo CAMBIA CARTELLA è supportato
File da modificare
File	Modifica
src/renderer/components/layout/Topbar.tsx	Rimuovere prop dbPath e il relativo span
src/renderer/components/layout/AppLayout.tsx	Rimuovere state dbPath, useEffect, e prop a Topbar
src/renderer/components/layout/Sidebar.tsx	Aggiungere sezione footer con percorso e pulsante CAMBIA CARTELLA
Verifica
Avviare l'app in dev: npm run dev
Verificare che la Topbar mostri solo il titolo della pagina, senza il percorso
Verificare che il footer della Sidebar mostri il percorso corretto (abbreviato, con tooltip)
Cliccare "CAMBIA CARTELLA" → si apre il dialog di sistema → selezionare una nuova cartella → il percorso si aggiorna nel footer
Navigare tra le pagine → il footer rimane stabile e corretto