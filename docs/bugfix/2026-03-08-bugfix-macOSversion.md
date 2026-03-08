# Bugfix — Mac Build (DMG) su macOS 12 e precedenti — Revisione

**Data:** 2026-03-08

---

## Problema

Il comando `npm run package:mac-legacy` falliva con due errori distinti in sequenza:

### Errore 1 — Proprietà non valida nello schema
```
configuration.mac has an unknown property 'dmgBuilderVersion'
```
La proprietà `dmgBuilderVersion` era stata aggiunta nel bugfix precedente (2026-03-01) ma non esiste nello schema di `electron-builder@26.8.1`. In quella sessione veniva ignorata silenziosamente; con la versione attuale la validazione è diventata più strict e blocca il build.

### Errore 2 — Python 3.14 incompatibile con MacOS 12 e precedenti
Rimossa `dmgBuilderVersion`, il build avanzava ma falliva comunque:
```
dyld: Symbol not found: (_mkfifoat)
  Referenced from: '.../dmg-builder@1.2.0/.../python/bin/python3.14'
  Expected in: '/usr/lib/libSystem.B.dylib'
```
`electron-builder@26.8.1` scarica sempre `dmg-builder@1.2.0` che include Python 3.14 compilato per macOS 13+. Su macOS 12 il simbolo `_mkfifoat` non è presente in `libSystem.B.dylib`.

---

## Causa Radice

`dmg-builder@1.2.0` è hardcoded in `electron-builder@26.8.1` e non è sostituibile tramite configurazione. Non esiste una proprietà `dmgBuilderVersion` nello schema — era una proprietà inventata nel bugfix precedente che per coincidenza non causava errori in quella sessione.

---

## Soluzione

Usare **`hdiutil`**, lo strumento nativo di macOS, per creare il DMG al posto di `dmg-builder`. Il build viene diviso in due fasi:

1. `electron-builder --dir` → produce solo la cartella `release/mac/LCMS Suite.app` (niente DMG, niente dmg-builder)
2. `hdiutil create` → crea il DMG nativamente, senza Python, senza dipendenze esterne

### File modificati

**`electron-builder.config.mac-legacy.js`** — rimossa la riga `dmgBuilderVersion` (non valida):

```js
/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'com.lcms.suite',
  productName: 'LCMS Suite',
  directories: { output: 'release' },
  files: ['dist/**/*', 'package.json'],
  extraResources: [
    { from: 'src/main/migrations', to: 'migrations' },
  ],
  mac: {
    target: 'dmg',
    category: 'public.app-category.developer-tools',
    identity: null,
  },
  artifactName: 'LCMS-Suite-${version}-legacy.${ext}',
}
```

**`package.json`** — script `package:mac-legacy` aggiornato con `--dir` + `hdiutil`:

```json
"package:mac-legacy": "npm run build && electron-builder --config electron-builder.config.mac-legacy.js --mac --dir && hdiutil create -volname 'LCMS Suite' -srcfolder 'release/mac/LCMS Suite.app' -ov -format UDZO release/LCMS-Suite-1.0.0-legacy.dmg"
```

---

## Distribuzione Mac — Istruzioni

### Build

```bash
npm run package:mac-legacy
```

Output: `release/LCMS-Suite-1.0.0-legacy.dmg`

### Cosa distribuire

**Solo il file `.dmg`** — la cartella `release/mac/` è un passaggio intermedio e non va distribuita.

```
release/
  LCMS-Suite-1.0.0-legacy.dmg   ← questo si distribuisce
  mac/                            ← ignorare, è temporaneo
```

### Installazione utente finale

1. Aprire il `.dmg`
2. Trascinare `LCMS Suite.app` in `/Applications`
3. Al primo avvio: configurare il percorso del database (SetupPage)

### Pulizia cartelle di build

Le cartelle `dist/` e `release/` sono già in `.gitignore`. Si possono cancellare liberamente:

```bash
rm -rf dist release
```

---

## Ambiente

| | |
|---|---|
| macOS | 12.7.6 Monterey |
| Node.js | v24.14.0 |
| Electron | ^40.8.0 |
| electron-builder | ^26.8.1 |
| better-sqlite3 | ^12.6.2 |

---

## Git

```bash
git add package.json electron-builder.config.mac-legacy.js
git commit -m "fix: usa hdiutil nativo per DMG su macOS 12 e precedenti (dmg-builder@1.2.0 incompatibile con Python 3.14)"
```
