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
    target: [
      { target: 'dir', arch: ['x64', 'ia32'] },
    ],
    signAndEditExecutable: false,
  },
  mac: {
    target: 'dmg',
    category: 'public.app-category.developer-tools',
    identity: null,
  },
  artifactName: 'LCMS-Suite-${version}.${ext}',
}
