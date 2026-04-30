#!/usr/bin/env node
/**
 * Dépôt GitHub privé : l'API releases refuse les requêtes sans token.
 * electron-updater met alors le token dans app-update.yml au packaging (lisible dans le .app — PAT avec droits minimaux).
 *
 * CI : définir le secret repo ELECTRON_UPDATER_GITHUB_TOKEN = PAT classique avec scope "repo" sur ce dépôt privé.
 */
const fs = require('fs');
const path = require('path');

const token = (process.env.ELECTRON_UPDATER_GITHUB_TOKEN || '').trim();
if (!token) {
  console.error(
    'inject-updater-token: variable ELECTRON_UPDATER_GITHUB_TOKEN absente.\n' +
      'Ajoute un secret de dépôt avec un PAT GitHub classique (scope « repo ») pour lire les releases privées.'
  );
  process.exit(1);
}

const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const pubs = pkg.build && pkg.build.publish;
if (!Array.isArray(pubs)) {
  console.error('inject-updater-token: build.publish doit être un tableau');
  process.exit(1);
}
const gh = pubs.find((p) => p.provider === 'github');
if (!gh) {
  console.error('inject-updater-token: aucune entrée publish github');
  process.exit(1);
}
gh.private = true;
gh.token = token;

fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log('inject-updater-token: OK (private + token, longueur %d)', token.length);
