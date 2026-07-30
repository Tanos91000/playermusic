'use strict';

const { execFileSync } = require('child_process');
const path = require('path');

/**
 * Signature ad-hoc du bundle macOS (hook `afterPack` d'electron-builder).
 *
 * `mac.identity: null` demande à electron-builder de ne pas signer du tout.
 * Sur Apple Silicon, le binaire ne porte alors que la signature minimale
 * produite par l'éditeur de liens : elle ne scelle pas les ressources du
 * bundle, et macOS répond « "Aura Player" is damaged and can't be opened ».
 *
 * Une vraie signature ad-hoc (`codesign --sign -`) corrige ce message. L'app
 * reste non notariée : au premier lancement il faut faire clic droit → Ouvrir,
 * ou lever la quarantaine. Seul un Developer ID Apple + notarisation
 * supprimerait complètement l'avertissement.
 */
exports.default = async function adhocSignMac(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const appName = `${context.packager.appInfo.productFilename}.app`;
  const appPath = path.join(context.appOutDir, appName);

  console.log(`[Aura] signature ad-hoc : ${appPath}`);
  try {
    execFileSync(
      'codesign',
      ['--force', '--deep', '--sign', '-', '--timestamp=none', appPath],
      { stdio: 'inherit' }
    );
    execFileSync('codesign', ['--verify', '--verbose=1', appPath], { stdio: 'inherit' });
    console.log('[Aura] signature ad-hoc validée');
  } catch (err) {
    // Ne pas casser le build : sans signature, l'app reste installable
    // manuellement (levée de quarantaine côté utilisateur).
    console.warn('[Aura] signature ad-hoc impossible :', err && err.message);
  }
};
