# Bugfix — Mac Build (DMG) su macOS Monterey

## Problema

Il comando `npm run package:mac` falliva su **macOS 12 Monterey** con il seguente errore:

```
dyld[9992]: Symbol not found: (_mkfifoat)
  Referenced from: '.../dmgbuild-bundle-x86_64-.../python/bin/python3.14'
  Expected in: '/usr/lib/libSystem.B.dylib'
ERR_ELECTRON_BUILDER_CANNOT_EXECUTE
```

### Causa

`electron-builder@26.x` scarica automaticamente `dmg-builder@1.2.0`, che include **Python 3.14** compilato per macOS 13+. Su macOS 12 il simbolo `_mkfifoat` non è presente in `libSystem.B.dylib`, causando il crash del processo di build.

---

## Soluzione

Invece di fare il downgrade di `electron-builder`, sono state create **due configurazioni di build separate**:

| Script | Config | Target |
|---|---|---|
| `npm run package:mac` | `electron-builder.config.js` | macOS 13+ |
| `npm run package:mac-legacy` | `electron-builder.config.mac-legacy.js` | macOS 12 Monterey e precedenti |

### 1. Nuovo file `electron-builder.config.mac-legacy.js`

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
    dmgBuilderVersion: '0.12.0',
  },
  artifactName: 'LCMS-Suite-${version}-legacy.${ext}',
}
```

### 2. Aggiunta script in `package.json`

```json
"package:mac-legacy": "npm run build && electron-builder --config electron-builder.config.mac-legacy.js --mac"
```

---

## Altri problemi risolti nella stessa sessione

### Progetto su Google Drive
Il progetto era ospitato in una cartella Google Drive, che non supporta i permessi Unix. I binari in `node_modules/.bin/` risultavano non eseguibili (`Permission denied`). Il progetto è stato spostato in:
```
/Users/.../Documents/Personali/Chem/Arpa/LCMS Suite Progetto/lcms-suite
```

### `better-sqlite3` — NODE_MODULE_VERSION mismatch
Il modulo nativo `better-sqlite3` era compilato per Node.js di sistema (v24) invece che per la versione di Node.js interna a Electron. Risolto con:
```bash
npx electron-rebuild -f -w better-sqlite3
```

---

## Ambiente

| | |
|---|---|
| macOS | 12.7.6 Monterey |
| Node.js | v24.14.0 |
| Electron | ^40.7.0 |
| electron-builder | ^26.8.1 |
| better-sqlite3 | ^12.6.2 |