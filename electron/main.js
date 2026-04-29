const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const https = require('https');
const scdl = require('soundcloud-downloader').default;
const { autoUpdater } = require('electron-updater');

let mainWindow;

// Tiny local server to proxy SoundCloud streams (replaces Next.js API route)
const server = http.createServer(async (req, res) => {
  const urlParams = new URLSearchParams(req.url.split('?')[1]);
  const url = urlParams.get('url');

  if (!url) {
    res.statusCode = 400;
    return res.end('Missing url parameter');
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

server.listen(3006, () => {
  console.log('Stream proxy server running on port 3006');
});

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

  // Wait for Vite dev server if in dev mode
  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:3005');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();
  
  // Check for updates
  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on('update-available', (info) => {
    if (mainWindow) mainWindow.webContents.send('update-available', info);
  });

  autoUpdater.on('update-downloaded', (info) => {
    if (mainWindow) mainWindow.webContents.send('update-downloaded', info);
  });

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

    return searchResults.collection
      .map(track => {
        const isUnavailable = track.policy === 'BLOCK' || track.policy === 'SNIP' || track.policy === 'MONETIZE';
        return {
          id: track.id,
          title: track.title,
          artist: track.user.username,
          duration: track.duration, // in ms
          artwork: track.artwork_url ? track.artwork_url.replace('large', 't500x500') : null,
          url: track.permalink_url,
          unavailable: isUnavailable
        };
      });
  } catch (error) {
    console.error('Search error in IPC:', error);
    throw error;
  }
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('restart-app', () => {
  autoUpdater.quitAndInstall();
});
