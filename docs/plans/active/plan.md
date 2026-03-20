Contesto
Lo SchemaCalibrazione attuale ha un layout a griglia piatta (colonne Analiti | Mix CRM | Singoli | Work) senza connessioni visive tra gli elementi. L'Excalidraw di riferimento (Schema-work.excalidraw) mostra un diagramma a nodi e frecce con:

Frecce che collegano i CRM sorgente ai blocchi Work
Contenitori tratteggiati per raggruppare sezioni (Analiti, CRM, Work)
Più spazio tra le sezioni, aspetto "diagram-like"

L'obiettivo è avvicinare la grafica a quel look, mantenendo la struttura attuale dei 4 file e tutte le funzionalità esistenti.

Step 1 — Tipi e interfacce (SchemaCalibrazione.types.ts)

Aggiungere interfaccia ConnectionLine (sourceId, targetId, sourceType, color)
Aggiungere tipo per il callback registerCardRef: (id: string, el: HTMLDivElement | null) => void nelle props di GrigliaAnalitiCrm e ColonneWork

Step 2 — Ref registry + SVG overlay (SchemaCalibrazione.tsx)

Creare useRef<Map<string, HTMLDivElement>>() nel componente root per registrare tutti i nodi (Mix, Sng, Work)
Passare registerCardRef come prop a GrigliaAnalitiCrm e ColonneWork
Creare ref per il container scrollabile (workspaceRef)
Creare componente interno ConnectionsOverlay:

SVG position: absolute, pointer-events: none, dentro il container scrollabile
Dimensioni pari a scrollWidth x scrollHeight del container
Per ogni Work in workCols, per ogni src in work.srcs, tracciare un path curvo (cubic bezier) dal bordo destro della card sorgente al bordo sinistro della card Work
Colore linea: basato su src.tipo (mix → C.mix.border, sng → C.sng.border, work → C.work.border)
Stile: stroke-width: 1.5, stroke-dasharray: 5 3, opacity: 0.55
Arrowhead marker in <defs>
Ricalcolo con useLayoutEffect su [workCols] + ResizeObserver sul container



Step 3 — Annotare i ref sulle card (SchemaCalibrazione.grid.tsx + .tsx)

Ogni card Mix: ref={el => registerCardRef(mixId, el)}
Ogni card Singolo: ref={el => registerCardRef(sngId, el)}
Ogni card Work: ref={el => registerCardRef(work.id, el)}

Step 4 — Funzione computeConnections (SchemaCalibrazione.logic.ts)
tscomputeConnections(workCols, cardRefs, scrollContainer) → Array<{x1,y1,x2,y2,color}>

Per ogni Work, per ogni src, getBoundingClientRect() di entrambi
Coordinate relative al scrollContainer (sottrarre rect container, aggiungere scrollLeft/scrollTop)
Anchor: bordo destro centro (sorgente) → bordo sinistro centro (target)

Step 5 — Contenitori sezione tratteggiati

Analiti: wrapper con border: 1.5px dashed C.page.brd2, border-radius: 10px, margin: 8px, label "Analiti" posizionato in alto
CRM (Mix + Singoli): stesso stile, label "CRM"
Work: stesso stile, label "Soluzioni Work"
Rimuovere i borderRight rigidi tra le sezioni, sostituiti dai container + gap

Step 6 — Stile card migliorato

border-radius: 8px uniforme su tutte le card
box-shadow: 0 1px 3px rgba(0,0,0,0.08) su tutte le card
padding: 8px 12px uniforme
borderLeft: 3px solid ${col.border} per dare un punto di ancoraggio visivo alle frecce
Selezione: ring animato via transition su box-shadow (gia parzialmente presente)

Step 7 — Spaziatura layout

Gap tra sezioni: gap: 20px nel container workspace
ROW da 42px a 48px
Colonne Work da 255px a 270px
Mix absolute: left:8, right:8
padding: 12px sul workspace container


File coinvolti
FileModifichesrc/renderer/pages/metodi/SchemaCalibrazione.types.ts+ConnectionLine, +registerCardRef nelle propssrc/renderer/pages/metodi/SchemaCalibrazione.tsx+ref registry, +ConnectionsOverlay, +section containers Work, +spacingsrc/renderer/pages/metodi/SchemaCalibrazione.grid.tsx+ref callbacks su card, +section containers Analiti/CRM, +card styling, ROW→48src/renderer/pages/metodi/SchemaCalibrazione.logic.ts+computeConnections()

Verifica

Aprire un metodo con CRM associati → lo schema mostra le 3 sezioni con bordi tratteggiati
Le card hanno ombra sottile e border-left colorato
Creare una Work → appaiono frecce curve dai CRM sorgente alla card Work
Scroll orizzontale → le frecce restano allineate
Aggiungere colonna intermedia → frecce si aggiornano correttamente
Eliminare una Work → frecce scompaiono
Aprire il drawer dettaglio → continua a funzionare normalmente
Tutte le interazioni esistenti (selezione, rimozione CRM, conflitti) funzionano come prima