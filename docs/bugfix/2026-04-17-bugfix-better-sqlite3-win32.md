# Bugfix — better-sqlite3: "not a valid Win32 application"

---

## Problema

Avviando `npm run dev`, l'app crasha con l'errore:

```
better_sqlite3.node is not a valid Win32 application
```

Il modulo nativo `better-sqlite3` risulta compilato per una versione di Node.js incompatibile con Electron.

---

## Root cause

Quando `npm install` viene eseguito (es. dopo un `git pull` con `package-lock.json` modificato), `better-sqlite3` viene compilato per Node.js di sistema invece che per l'ABI di Electron. Il binario `.node` risultante non è caricabile da Electron.

---

## Fix

**File:** `package.json`

Aggiunto script `postinstall` che ricompila automaticamente `better-sqlite3` per Electron dopo ogni `npm install`:

```json
"postinstall": "electron-rebuild -f -w better-sqlite3"
```

---

## Verifica

1. Cancellare `node_modules/better-sqlite3/build/`
2. Eseguire `npm install`
3. Verificare che `electron-rebuild` gira automaticamente
4. Eseguire `npm run dev` — l'app si avvia senza errori
