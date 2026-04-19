# Resoconto sessione — Audit work codice, badge link, parametri fullscreen

**Data:** 2026-04-19
**Oggetto:** Codice WS in audit dashboard e PDF, badge "Work con problemi" con link diretto, ParametriMetodoPage fullscreen come SchemaCalibrazione

---

## Cosa è stato fatto

- Aggiunto il campo `codice` (WS-YYYYMMDD-XXX) della work nell'audit dashboard (header riga) e nel PDF audit (scheda work)
- I badge "Work con problemi" nella TracciabilitaCard ora navigano direttamente alla work specifica con `openWorkId`
- `ParametriMetodoPage` ora occupa tutto lo spazio della finestra come `SchemaCalibrazione` (margini negativi + bg-background)
- Aggiunta regola in CLAUDE.md per il pattern fullscreen dei componenti in MetodiPage

---

## Bug risolti / Feature aggiunte

### Codice WS nell'audit dashboard
**Motivazione:** L'utente voleva vedere il "lotto" (= codice progressivo WS-...) della work accanto al nome nella riga audit, per identificarla rapidamente.
**Implementazione:**
- `auditModel.ts`: aggiunto `work_codice: string | null` a `AuditWorkRow`, popolato da `wRaw.codice ?? null`
- `dashboard.ipc.ts`: aggiunto `w.codice` nella SELECT SQL della query `dashboard:audit-crm` (era il pezzo mancante — senza questo `wRaw.codice` era sempre undefined)
- `AuditCrmSection.tsx`: codice mostrato in grigio accanto al nome work nell'header della riga

### Codice WS nel PDF audit
**Motivazione:** Il progressivo ricetta (codice WS) mancava dall'intestazione della scheda work nel PDF esportato.
**Implementazione:** `auditReport.ts` — riga info in alto a destra nella scheda work aggiornata: `${w.work_codice ? \`${w.work_codice}   |   \` : ''}Scadenza: ...`

### Badge "Work con problemi" con link diretto
**Motivazione:** I badge nella TracciabilitaCard navigavano a `/work` senza filtro, l'utente doveva cercare manualmente la work.
**Implementazione:** `TracciabilitaCard.tsx` — onClick cambiato da `nav('/work')` a `nav('/work', { state: { openWorkId: w.id, archiviata: false, searchWork: w.nome } })`, stesso pattern già usato in AuditCrmSection.

### ParametriMetodoPage fullscreen
**Motivazione:** La tabella parametri analitici lasciava spazio vuoto sopra (BackButton del layout visibile, padding non compensato).
**Implementazione:** Applicato stesso pattern di `SchemaCalibrazione`: div root con `margin: -16, marginTop: -60, height: '100%', overflow: 'hidden'` + `bg-background` per coprire fisicamente il BackButton. Header interno con `padding: '12px 24px'` e shadow.

### Regola CLAUDE.md pattern fullscreen
**Motivazione:** Il pattern è stato applicato due volte con tentativi multipli — documentato per applicarlo direttamente in futuro.
**Implementazione:** Aggiunta sezione "Componenti fullscreen in MetodiPage" in CLAUDE.md con i valori esatti e i riferimenti ai file.

---

## File modificati

| File | Modifica |
|------|----------|
| `src/main/ipc/dashboard.ipc.ts` | Aggiunto `w.codice` nella SELECT SQL audit-crm |
| `src/renderer/pages/dashboard/lib/auditModel.ts` | Campo `work_codice` in `AuditWorkRow` + popolamento in `buildAuditModel` |
| `src/renderer/pages/dashboard/sections/AuditCrmSection.tsx` | Mostra `work_codice` nell'header riga work |
| `src/renderer/pages/dashboard/lib/auditReport.ts` | Codice WS nell'header scheda work PDF |
| `src/renderer/pages/dashboard/sections/TracciabilitaCard.tsx` | Badge work con link diretto via `openWorkId` |
| `src/renderer/pages/metodi/ParametriMetodoPage.tsx` | Layout fullscreen con margini negativi + bg-background |
| `src/renderer/components/layout/AppLayout.tsx` | `flex flex-col` + `flex-1 min-h-0` per propagare altezza all'Outlet |
| `CLAUDE.md` | Pattern fullscreen MetodiPage documentato |

---

## Note per sessioni future

- Il campo `codice` della work (WS-YYYYMMDD-XXX) è ora presente in `AuditWorkRow` — se in futuro si aggiungono altri posti dove mostrarlo, il modello è già pronto.
- Il pattern fullscreen (margin -16/-60 + bg-background) va applicato a qualsiasi nuovo componente che sostituisce la vista in MetodiPage — vedi CLAUDE.md.
- La modifica ad `AppLayout` (`flex flex-col`) è innocua per le altre pagine ma migliora la propagazione dell'altezza.
