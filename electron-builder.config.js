/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'com.lcms.suite',
  productName: 'LCMS Suite',
  directories: {
    output: 'release',
  },
  files: [
    'dist/**/*',
    'package.json',
  ],
  extraResources: [
    { from: 'src/main/migrations', to: 'migrations' },
  ],
  win: {
    target: 'portable',
    icon: 'build/icon.ico',
  },
  portable: {
    artifactName: 'LCMS-Suite-${version}.exe',
  },
}
