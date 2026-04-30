const crypto = require('crypto');
const http = require('http');
const { mapSoundCloudCollection } = require('./soundcloud-tracks');

/** À ajouter tel quel dans le dashboard Spotify (Redirect URIs). */
const SPOTIFY_OAUTH_PORT = 48921;
const SPOTIFY_REDIRECT_URI = `http://127.0.0.1:${SPOTIFY_OAUTH_PORT}/callback`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function base64url(buf) {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function generatePkcePair() {
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

function waitForOAuthCallback({ port, expectedState, timeoutMs }) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const server = http.createServer((req, res) => {
      if (settled) return;
      try {
        const u = new URL(req.url || '/', `http://127.0.0.1:${port}`);
        if (u.pathname !== '/callback') {
          res.writeHead(404);
          res.end();
          return;
        }

        const code = u.searchParams.get('code');
        const state = u.searchParams.get('state');
        const errParam = u.searchParams.get('error');
        const desc = u.searchParams.get('error_description');

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(
          '<!DOCTYPE html><html><body style="font-family:system-ui;padding:2rem;text-align:center">' +
            '<p><strong>Aura Player</strong></p><p>Tu peux fermer cet onglet et revenir dans l’app.</p>' +
            '</body></html>'
        );

        settled = true;
        clearTimeout(timer);
        server.close();

        if (errParam) {
          reject(new Error(desc || errParam));
          return;
        }
        if (state !== expectedState) {
          reject(new Error('Réponse Spotify invalide (state).'));
          return;
        }
        if (!code) {
          reject(new Error('Pas de code d’autorisation Spotify.'));
          return;
        }
        resolve(code);
      } catch (e) {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          try {
            server.close();
          } catch {
            /* ignore */
          }
          reject(e);
        }
      }
    });

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        server.close();
      } catch {
        /* ignore */
      }
      reject(new Error('Connexion Spotify expirée. Réessaie.'));
    }, timeoutMs);

    server.on('error', (e) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        if (e.code === 'EADDRINUSE') {
          reject(
            new Error(
              `Le port ${port} est occupé. Ferme l’autre application qui l’utilise (nécessaire pour Spotify).`
            )
          );
          return;
        }
        reject(e);
      }
    });

    server.listen(port, '127.0.0.1');
  });
}

async function exchangeCodeForTokens({ code, redirectUri, clientId, codeVerifier }) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier
  });

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error_description || data.error || `HTTP ${res.status}`;
    throw new Error(String(msg));
  }
  if (!data.access_token) throw new Error('Spotify n’a pas renvoyé de jeton.');
  return data;
}

async function fetchAllSavedTracks(accessToken, onChunk) {
  const out = [];
  let url = 'https://api.spotify.com/v1/me/tracks?limit=50';

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`Titres Spotify : ${res.status} ${t.slice(0, 200)}`);
    }
    const data = await res.json();
    const items = data.items || [];
    out.push(...items);
    onChunk?.(out.length);
    url = data.next || null;
  }

  return out;
}

async function searchFirstSoundCloudHit(scdl, query, getDownloads, getDownloadPath) {
  const searchResults = await scdl.search({
    query,
    resourceType: 'tracks',
    limit: 5
  });
  const col = searchResults.collection || [];
  if (!col.length) return null;
  return mapSoundCloudCollection([col[0]], getDownloads, getDownloadPath)[0] || null;
}

/**
 * @param {object} deps
 * @param {string} deps.clientId
 * @param {import('electron').Shell} deps.shell
 * @param {(p: object) => void} [deps.sendProgress]
 * @param deps.scdl
 * @param {() => object} deps.getDownloads
 * @param {(downloads: object, trackId: unknown) => string|null} deps.getDownloadPath
 */
async function runSpotifyLikesImport(deps) {
  const { clientId, shell, sendProgress, scdl, getDownloads, getDownloadPath } = deps;

  const cid = (clientId || '').trim();
  if (!cid) {
    throw new Error('Client ID Spotify manquant.');
  }

  const state = base64url(crypto.randomBytes(16));
  const { verifier, challenge } = generatePkcePair();
  const redirectUri = SPOTIFY_REDIRECT_URI;

  const authUrl = new URL('https://accounts.spotify.com/authorize');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', cid);
  authUrl.searchParams.set('scope', 'user-library-read');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('code_challenge', challenge);

  sendProgress?.({ phase: 'oauth', message: 'Ouverture du navigateur…' });

  const codePromise = waitForOAuthCallback({
    port: SPOTIFY_OAUTH_PORT,
    expectedState: state,
    timeoutMs: 180000
  });

  await sleep(400);
  shell.openExternal(authUrl.toString());

  const code = await codePromise;

  sendProgress?.({ phase: 'token', message: 'Échange du jeton…' });

  const tokens = await exchangeCodeForTokens({
    code,
    redirectUri,
    clientId: cid,
    codeVerifier: verifier
  });

  sendProgress?.({ phase: 'fetch', message: 'Récupération des titres likés…' });

  const savedItems = await fetchAllSavedTracks(tokens.access_token, (n) => {
    sendProgress?.({ phase: 'fetch', count: n });
  });

  const tracksOut = [];
  const unmatched = [];

  let index = 0;
  const total = savedItems.length;

  for (const item of savedItems) {
    index += 1;
    const st = item.track;
    if (!st || st.type !== 'track') continue;

    const artist = (st.artists && st.artists[0] && st.artists[0].name) || '';
    const query = `${artist} ${st.name}`.trim();

    sendProgress?.({ phase: 'match', index, total, detail: query });

    try {
      const hit = await searchFirstSoundCloudHit(scdl, query, getDownloads, getDownloadPath);
      if (hit) tracksOut.push(hit);
      else unmatched.push({ title: st.name, artist });
    } catch {
      unmatched.push({ title: st.name, artist });
    }

    await sleep(110);
  }

  return {
    ok: true,
    tracks: tracksOut,
    unmatched,
    spotifyTotal: savedItems.length
  };
}

module.exports = {
  SPOTIFY_REDIRECT_URI,
  SPOTIFY_OAUTH_PORT,
  runSpotifyLikesImport
};
