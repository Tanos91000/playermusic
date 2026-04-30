const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
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

const youtubeDl = createYoutubeDlUnpack(path);

let mainWindow;
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

// Tiny local server to proxy SoundCloud streams (replaces Next.js API route)
const server = http.createServer(async (req, res) => {
  const urlParams = new URLSearchParams(req.url.split('?')[1]);
  const url = urlParams.get('url');

  if (!url) {
    res.statusCode = 400;
    return res.end('Missing url parameter');
  }

  // Handle local file serving
  if (url.startsWith('file://')) {
    const decodedUrl = decodeURIComponent(url);
    const filePath = decodedUrl.replace('file://', '');
    if (fs.existsSync(filePath)) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', getAudioContentType(filePath));
      const stats = fs.statSync(filePath);
      res.setHeader('Content-Length', stats.size);
      return fs.createReadStream(filePath).pipe(res);
    } else {
      console.error('Local file not found:', filePath);
      res.statusCode = 404;
      return res.end('File not found');
    }
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: 'hiddenInset', // Native look on macOS
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

  // Dev: use 127.0.0.1 so it matches Vite (localhost → IPv6-only mismatch causes endless load on some macOS setups)
  if (!app.isPackaged) {
    const devUrl = 'http://127.0.0.1:3005';
    let attempts = 0;
    const loadDev = () => {
      attempts += 1;
      mainWindow.loadURL(devUrl).catch(() => {
        if (attempts < 80) setTimeout(loadDev, 250);
      });
    };
    mainWindow.webContents.on('did-fail-load', (_event, code, _desc, failedUrl) => {
      if (failedUrl !== devUrl || attempts >= 80) return;
      if (code === -102 || code === -105 || code === -106 || code === -7) setTimeout(loadDev, 300);
    });
    loadDev();
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  ensureDownloadBinariesExecutable(fs, path);
  const ytBin = resolveYtDlpBinaryPath(path);
  if (fs.existsSync(ytBin)) {
    console.log('[Aura] yt-dlp:', ytBin);
  } else {
    console.error('[Aura] yt-dlp absent — téléchargements impossibles:', ytBin);
  }

  // Start the proxy server
  server.listen(3006, () => {
    console.log('Stream proxy server running on port 3006');
  });

  createWindow();

  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handler for window resizing (Mini-player)
ipcMain.handle('resize-window', (event, { width, height, isMini }) => {
  if (mainWindow) {
    mainWindow.setSize(width, height, true);
    mainWindow.setAlwaysOnTop(isMini);
  }
});

// IPC Handler for SoundCloud Search
ipcMain.handle('search-soundcloud', async (event, query) => {
  try {
    const searchResults = await scdl.search({
      query,
      resourceType: 'tracks',
      limit: 30
    });

    const downloads = getDownloads();

    return searchResults.collection
      .map(track => {
        const isUnavailable = track.policy === 'BLOCK' || track.policy === 'SNIP';
        const localPath = getDownloadPath(downloads, track.id);
        return {
          id: track.id,
          title: track.title,
          artist: track.user.username,
          duration: track.duration, // in ms
          artwork: track.artwork_url ? track.artwork_url.replace('large', 't500x500') : null,
          url: track.permalink_url,
          unavailable: isUnavailable && !localPath,
          isFixed: !!localPath,
          localPath: localPath
        };
      });
  } catch (error) {
    console.error('Search error in IPC:', error);
    throw error;
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

ipcMain.handle('restart-app', () => {
  autoUpdater.quitAndInstall();
});
