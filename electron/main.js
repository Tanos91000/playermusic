const { app, BrowserWindow, ipcMain, nativeImage, shell, dialog, Menu } = require('electron');
const path = require('path');
const { pathToFileURL, fileURLToPath } = require('url');
const http = require('http');
const https = require('https');
const fs = require('fs');
const os = require('os');
const scdl = require('soundcloud-downloader').default;
const { autoUpdater } = require('electron-updater');
const { createDownloadTrackHandler, createYoutubeDlUnpack, resolveYtDlpBinaryPath, ensureDownloadBinariesExecutable } = require('./download-track');
const {
  deleteDownloadedTrack,
  getDownloadPath,
  getDownloadedTracksLibrary
} = require('./downloads-library');
const discordPresence = require('./discord-presence');
const { runSpotifyLikesImport, SPOTIFY_REDIRECT_URI } = require('./spotify-import');
const { searchSoundCloudUnified, getSoundCloudArtistBundle } = require('./soundcloud-tracks');

const youtubeDl = createYoutubeDlUnpack(path);

let mainWindow;

function resolveAppIcon() {
  const iconsRoot = path.join(__dirname, '../icons');
  const candidates = [];

  if (process.platform === 'win32') {
    if (app.isPackaged) candidates.push(path.join(process.resourcesPath, 'icon.ico'));
    candidates.push(path.join(iconsRoot, 'icon.ico'));
  } else if (process.platform === 'darwin') {
    if (app.isPackaged) candidates.push(path.join(process.resourcesPath, 'icon.icns'));
    candidates.push(path.join(iconsRoot, 'icon.icns'));
  } else {
    candidates.push(path.join(iconsRoot, 'icon.png'));
    candidates.push(path.join(iconsRoot, 'icon.ico'));
  }

  candidates.push(path.join(iconsRoot, 'icon.png'));

  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    const img = nativeImage.createFromPath(p);
    if (!img.isEmpty()) return img;
  }
  return undefined;
}
const downloadsDir = path.join(app.getPath('userData'), 'downloads');
const downloadsFile = path.join(app.getPath('userData'), 'downloads.json');

if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });

function getAudioContentType(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case '.m4a':
    case '.mp4':
      return 'audio/mp4';
    case '.webm':
      return 'audio/webm';
    case '.ogg':
    case '.opus':
      return 'audio/ogg';
    case '.flac':
      return 'audio/flac';
    case '.wav':
      return 'audio/wav';
    case '.aac':
      return 'audio/aac';
    case '.mp3':
    default:
      return 'audio/mpeg';
  }
}

function getDownloads() {
  if (!fs.existsSync(downloadsFile)) return {};
  try {
    return JSON.parse(fs.readFileSync(downloadsFile, 'utf8'));
  } catch (e) { return {}; }
}

function saveDownloads(data) {
  fs.writeFileSync(downloadsFile, JSON.stringify(data, null, 2));
}

/** Required for <audio> seeking: browsers issue Range requests against byte offsets. */
function serveLocalAudioFile(req, res, filePath) {
  if (!fs.existsSync(filePath)) {
    console.error('Local file not found:', filePath);
    res.statusCode = 404;
    return res.end('File not found');
  }

  const stats = fs.statSync(filePath);
  const fileSize = stats.size;
  const contentType = getAudioContentType(filePath);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', contentType);

  if (req.method === 'HEAD') {
    res.statusCode = 200;
    res.setHeader('Content-Length', fileSize);
    return res.end();
  }

  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end();
  }

  const range = req.headers.range;
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!m) {
      res.statusCode = 416;
      res.setHeader('Content-Range', `bytes */${fileSize}`);
      return res.end();
    }

    let start = m[1] === '' ? NaN : parseInt(m[1], 10);
    let end = m[2] === '' ? NaN : parseInt(m[2], 10);
    if (!Number.isFinite(start)) start = 0;
    if (!Number.isFinite(end)) end = fileSize - 1;

    if (start < 0 || start >= fileSize || end < start) {
      res.statusCode = 416;
      res.setHeader('Content-Range', `bytes */${fileSize}`);
      return res.end();
    }

    if (end >= fileSize) end = fileSize - 1;

    const chunkSize = end - start + 1;
    res.statusCode = 206;
    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
    res.setHeader('Content-Length', chunkSize);

    const rs = fs.createReadStream(filePath, { start, end });
    rs.on('error', () => {
      if (!res.headersSent) res.statusCode = 500;
      res.destroy();
    });
    return rs.pipe(res);
  }

  res.statusCode = 200;
  res.setHeader('Content-Length', fileSize);
  const stream = fs.createReadStream(filePath);
  stream.on('error', () => {
    if (!res.headersSent) res.statusCode = 500;
    res.destroy();
  });
  return stream.pipe(res);
}

// Tiny local server to proxy SoundCloud streams (replaces Next.js API route)
const server = http.createServer(async (req, res) => {
  const urlParams = new URLSearchParams(req.url.split('?')[1]);
  const url = urlParams.get('url');

  if (!url) {
    res.statusCode = 400;
    return res.end('Missing url parameter');
  }

  // Handle local file serving (must support Range so <audio> can seek)
  if (url.startsWith('file://')) {
    let filePath;
    try {
      filePath = fileURLToPath(new URL(decodeURIComponent(url)));
    } catch {
      const decodedUrl = decodeURIComponent(url);
      filePath = decodedUrl.replace(/^file:\/\//i, '');
      if (process.platform === 'win32' && filePath.startsWith('/')) filePath = filePath.slice(1);
    }
    return serveLocalAudioFile(req, res, filePath);
  }

  try {
    const client_id = await scdl.getClientID();
    const info = await scdl.getInfo(url);
    const progressive = info.media.transcodings.find(t => t.format.protocol === 'progressive');

    if (progressive) {
      const mediaRes = await scdl.axios.get(progressive.url + '?client_id=' + client_id);
      const directUrl = mediaRes.data.url;

      const options = { headers: {} };
      if (req.headers.range) options.headers.range = req.headers.range;

      https.get(directUrl, options, (cdnRes) => {
        res.statusCode = cdnRes.statusCode;
        for (const [key, value] of Object.entries(cdnRes.headers)) {
          res.setHeader(key, value);
        }
        res.setHeader('Access-Control-Allow-Origin', '*');
        cdnRes.pipe(res);
      }).on('error', (err) => {
        console.error('CDN Proxy error:', err);
        res.statusCode = 500;
        res.end();
      });
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'audio/mpeg');
      const stream = await scdl.download(url);
      stream.pipe(res);
    }
  } catch (error) {
    console.error('Failed to proxy stream:', error);
    if (!res.headersSent) res.writeHead(500);
    res.end('Failed to fetch audio stream');
  }
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log('Port 3006 is already in use. Assuming proxy is already running.');
  } else {
    console.error('Proxy server error:', e);
  }
});

let pendingUpdateAvailable = false;
let pendingUpdateDownloaded = false;

function flushUpdaterStatusToRenderer() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const wc = mainWindow.webContents;
  if (!wc || wc.isDestroyed()) return;
  if (pendingUpdateDownloaded) wc.send('update-downloaded', {});
  else if (pendingUpdateAvailable) wc.send('update-available', {});
}

function setupAutoUpdater() {
  if (!app.isPackaged) return;

  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('error', (err) => {
    console.error('[Aura] autoUpdater:', err?.message || err);
  });
  autoUpdater.on('checking-for-update', () => {
    console.log('[Aura] autoUpdater: checking…');
  });
  autoUpdater.on('update-not-available', () => {
    console.log('[Aura] autoUpdater: up to date');
  });

  autoUpdater.on('update-available', (info) => {
    pendingUpdateAvailable = true;
    console.log('[Aura] autoUpdater: update available', info?.version);
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update-available', info);
  });

  autoUpdater.on('update-downloaded', (info) => {
    pendingUpdateDownloaded = true;
    console.log('[Aura] autoUpdater: update downloaded', info?.version);
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update-downloaded', info);
  });

  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      console.error('[Aura] autoUpdater check failed:', err?.message || err);
    });
  }, 5000);
}

function createWindow(icon) {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    ...(icon ? { icon } : {}),
    // hiddenInset: drag region + traffic lights on macOS; default framed window on Windows/Linux
    ...(process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset' } : {}),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  });

  mainWindow.webContents.once('did-finish-load', () => {
    flushUpdaterStatusToRenderer();
  });

  // Dev: try Vite first (retry a few times). After timeout, load built dist/index.html
  if (!app.isPackaged) {
    const devUrl = 'http://127.0.0.1:3005';
    const distIndex = path.join(__dirname, '../dist/index.html');
    let viteLoaded = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 16; // ~8 seconds (16 x 500ms)

    const loadDist = () => {
      if (viteLoaded) return;
      viteLoaded = true;
      console.log('[Aura] Vite unreachable – loading dist/index.html');
      mainWindow.loadFile(distIndex);
    };

    const tryVite = () => {
      if (viteLoaded) return;
      attempts += 1;
      mainWindow.loadURL(devUrl).then(() => {
        viteLoaded = true;
        mainWindow.webContents.openDevTools();
      }).catch(() => {
        if (attempts < MAX_ATTEMPTS) {
          setTimeout(tryVite, 500);
        } else {
          loadDist();
        }
      });
    };

    mainWindow.webContents.on('did-fail-load', (_event, code, _desc, failedUrl) => {
      if (viteLoaded) return;
      if (failedUrl !== devUrl || attempts >= MAX_ATTEMPTS) return;
      if (code === -102 || code === -105 || code === -106 || code === -7) {
        attempts += 1;
        if (attempts < MAX_ATTEMPTS) {
          setTimeout(tryVite, 500);
        } else {
          loadDist();
        }
      }
    });

    tryVite();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  // Windows taskbar icon / jump list grouping (must match installer app id)
  app.setAppUserModelId('com.emric.playermusic');

  // Remove default File / Edit / … menu bar (esp. Windows); keep macOS menu if we add one later
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null);
  }

  ensureDownloadBinariesExecutable(fs, path);
  const ytBin = resolveYtDlpBinaryPath(path);
  if (fs.existsSync(ytBin)) {
    console.log('[Aura] yt-dlp:', ytBin);
  } else {
    console.error('[Aura] yt-dlp absent — téléchargements impossibles:', ytBin);
  }

  const appIcon = resolveAppIcon();
  if (process.platform === 'darwin' && appIcon) {
    try {
      app.dock.setIcon(appIcon);
    } catch {
      /* ignore */
    }
  }

  // Start the proxy server
  server.listen(3006, () => {
    console.log('Stream proxy server running on port 3006');
  });

  createWindow(appIcon);

  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(resolveAppIcon());
    }
  });
});

app.on('before-quit', () => {
  discordPresence.shutdown().catch(() => {});
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handler for window resizing (Mini-player)
ipcMain.handle('resize-window', (_event, { width, height, isMini }) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const finish = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.setSize(width, height, true);
    mainWindow.setAlwaysOnTop(!!isMini);
    if (isMini) mainWindow.center();
  };

  if (mainWindow.isFullScreen()) {
    mainWindow.setFullScreen(false);
    setTimeout(finish, 120);
    return;
  }

  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
    setTimeout(finish, 50);
    return;
  }

  finish();
});

ipcMain.handle('open-local-audio-files', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(win || undefined, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      {
        name: 'Audio',
        extensions: ['mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg', 'opus', 'webm']
      }
    ]
  });
  if (canceled || !filePaths?.length) return { canceled: true, paths: [] };
  return { canceled: false, paths: filePaths };
});

ipcMain.handle('filter-existing-local-paths', (_event, paths) => {
  if (!Array.isArray(paths)) return [];
  return paths.filter((p) => typeof p === 'string' && p.trim() && fs.existsSync(path.normalize(p.trim())));
});

// IPC Handler for SoundCloud Search (tracks + artists)
ipcMain.handle('search-soundcloud', async (event, query) => {
  try {
    return await searchSoundCloudUnified(scdl, query, getDownloads, getDownloadPath, 30, 15);
  } catch (error) {
    console.error('Search error in IPC:', error);
    throw error;
  }
});

ipcMain.handle('get-soundcloud-artist', async (_event, profileUrl) => {
  if (typeof profileUrl !== 'string' || !profileUrl.trim()) {
    throw new Error('Missing profile URL');
  }
  try {
    return await getSoundCloudArtistBundle(scdl, profileUrl.trim(), getDownloads, getDownloadPath);
  } catch (error) {
    console.error('Artist profile error in IPC:', error);
    throw error;
  }
});

ipcMain.handle('open-external-url', (_event, url) => {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url.trim())) return false;
  shell.openExternal(url.trim());
  return true;
});

ipcMain.handle('get-spotify-redirect-uri', () => SPOTIFY_REDIRECT_URI);

ipcMain.handle('spotify-import-likes', async (event, { clientId }) => {
  const wc = event.sender;
  const sendProgress = (payload) => {
    try {
      if (!wc.isDestroyed()) wc.send('spotify-import-progress', payload);
    } catch {
      /* ignore */
    }
  };
  try {
    return await runSpotifyLikesImport({
      clientId,
      shell,
      sendProgress,
      scdl,
      getDownloads,
      getDownloadPath
    });
  } catch (err) {
    console.error('[Aura] spotify-import-likes:', err);
    return {
      ok: false,
      error: err?.message || String(err),
      tracks: [],
      unmatched: [],
      spotifyTotal: 0
    };
  }
});

function serializeIpcError(err) {
  if (err == null) return 'Erreur sans détail (valeur absente).';
  if (typeof err === 'string') return err.slice(0, 4000);
  const chunks = [];
  const msg = err.message && String(err.message).trim();
  if (msg) chunks.push(msg);
  if (typeof err.stderr === 'string' && err.stderr.trim()) chunks.push(err.stderr.trim());
  if (typeof err.stdout === 'string' && err.stdout.trim()) chunks.push(err.stdout.trim());
  if (err.code) chunks.push(`code: ${err.code}`);
  if (err.errno != null) chunks.push(`errno: ${err.errno}`);
  if (err.exitCode != null) chunks.push(`exitCode: ${err.exitCode}`);
  if (err.signal) chunks.push(`signal: ${err.signal}`);
  if (err.command) chunks.push(`commande: ${err.command}`);
  const stack = err.stack && String(err.stack).trim();
  if (stack && chunks.length < 2) {
    chunks.push(stack.split('\n').slice(0, 12).join('\n'));
  }
  const text = chunks.filter(Boolean).join('\n\n').trim();
  return text ? text.slice(0, 4000) : `Erreur (${typeof err}): ${String(err)}`.slice(0, 4000);
}

const downloadTrackHandler = createDownloadTrackHandler({
  downloadsDir,
  fs,
  path,
  os,
  getDownloads,
  saveDownloads,
  youtubeDl
});

ipcMain.handle('download-track', async (event, track) => {
  try {
    return await downloadTrackHandler(event, track);
  } catch (err) {
    console.error('download-track IPC:', err);
    return {
      success: false,
      localPath: null,
      error: serializeIpcError(err)
    };
  }
});

ipcMain.handle('get-downloaded-tracks', () => {
  const downloads = getDownloads();
  return Object.fromEntries(
    Object.keys(downloads)
      .map(id => [id, getDownloadPath(downloads, id)])
      .filter(([, localPath]) => !!localPath)
  );
});

ipcMain.handle('get-download-library', () => {
  return getDownloadedTracksLibrary(getDownloads(), fs, downloadsDir);
});

ipcMain.handle('delete-downloaded-track', (_event, trackId) => {
  const result = deleteDownloadedTrack(getDownloads(), trackId, fs);
  saveDownloads(result.downloads);
  return getDownloadedTracksLibrary(result.downloads, fs, downloadsDir);
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('discord-set-client-id', (_event, id) => {
  discordPresence.setRendererClientId(typeof id === 'string' ? id : '');
  return null;
});

ipcMain.handle('local-path-to-file-url', (_event, absPath) => {
  if (typeof absPath !== 'string' || !absPath.trim()) return '';
  try {
    return pathToFileURL(path.normalize(absPath.trim())).href;
  } catch {
    return '';
  }
});

ipcMain.handle('discord-update-presence', (_event, payload) => {
  return discordPresence.update(payload || {}).catch(() => {});
});

ipcMain.handle('restart-app', () => {
  // macOS electron-updater (MacUpdater): if Squirrel never emitted native "update-downloaded",
  // quitAndInstall() does NOT call checkForUpdates() while autoInstallOnAppQuit is true → click does nothing.
  if (process.platform === 'darwin') {
    autoUpdater.autoInstallOnAppQuit = false;
  }
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.destroy();
    }
    mainWindow = null;
  } catch {
    /* ignore */
  }
  setImmediate(() => {
    try {
      autoUpdater.quitAndInstall();
    } catch (err) {
      console.error('[Aura] quitAndInstall:', err);
      app.quit();
    }
  });
});
