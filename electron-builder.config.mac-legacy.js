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