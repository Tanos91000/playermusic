const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const https = require('https');
const fs = require('fs');
const scdl = require('soundcloud-downloader').default;
const { autoUpdater } = require('electron-updater');
const yts = require('yt-search');
const ytdl = require('ytdl-core');
const play = require('play-dl');

let mainWindow;
const downloadsDir = path.join(app.getPath('userData'), 'downloads');
const downloadsFile = path.join(app.getPath('userData'), 'downloads.json');

if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });

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
      res.setHeader('Content-Type', 'audio/mpeg');
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

    const downloads = getDownloads();

    return searchResults.collection
      .map(track => {
        const isUnavailable = track.policy === 'BLOCK' || track.policy === 'SNIP';
        const localPath = downloads[track.id];
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

ipcMain.handle('download-track', async (event, track) => {
  try {
    console.log(`Starting download for: ${track.artist} - ${track.title}`);
    const query = `${track.artist} - ${track.title}`;
    const r = await yts(query);
    const video = r.videos[0];
    if (!video) throw new Error('No match found on YouTube');

    const fileName = `${track.id}.mp3`;
    const filePath = path.join(downloadsDir, fileName);

    if (fs.existsSync(filePath) && fs.statSync(filePath).size > 1024) {
      const downloads = getDownloads();
      downloads[track.id] = filePath;
      saveDownloads(downloads);
      return { success: true, localPath: filePath };
    }

    // Using play-dl which is currently much more stable than ytdl-core
    const stream = await play.stream(video.url, { quality: 2 }); // highestaudio equivalent
    const fileStream = fs.createWriteStream(filePath);

    return new Promise((resolve, reject) => {
      stream.stream.pipe(fileStream);
      
      let hasError = false;
      fileStream.on('finish', () => {
        if (!hasError) {
          console.log(`Download finished: ${filePath}`);
          const downloads = getDownloads();
          downloads[track.id] = filePath;
          saveDownloads(downloads);
          resolve({ success: true, localPath: filePath });
        }
      });

      const handleError = (err) => {
        if (hasError) return;
        hasError = true;
        console.error('Stream/File error:', err);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        reject(err);
      };

      fileStream.on('error', handleError);
      stream.stream.on('error', handleError);
    });
  } catch (error) {
    console.error('Download error:', error);
    throw error;
  }
});

ipcMain.handle('get-downloaded-tracks', () => {
  return getDownloads();
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('restart-app', () => {
  autoUpdater.quitAndInstall();
});
