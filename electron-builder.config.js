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
    target: 'dir',
    signAndEditExecutable: false,
  },
  artifactName: 'LCMS-Suite-${version}.${ext}',
}
