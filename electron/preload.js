const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  searchSoundCloud: (query) => ipcRenderer.invoke('search-soundcloud', query),
  getSoundCloudArtist: (profileUrl) => ipcRenderer.invoke('get-soundcloud-artist', profileUrl),
  resizeWindow: (width, height, isMini) => ipcRenderer.invoke('resize-window', { width, height, isMini }),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  downloadTrack: (track) => ipcRenderer.invoke('download-track', track),
  getDownloadedTracks: () => ipcRenderer.invoke('get-downloaded-tracks'),
  getDownloadLibrary: () => ipcRenderer.invoke('get-download-library'),
  deleteDownloadedTrack: (trackId) => ipcRenderer.invoke('delete-downloaded-track', trackId),
  onUpdateAvailable: (callback) => {
    ipcRenderer.removeAllListeners('update-available');
    ipcRenderer.on('update-available', callback);
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.removeAllListeners('update-downloaded');
    ipcRenderer.on('update-downloaded', callback);
  },
  restartApp: () => ipcRenderer.invoke('restart-app'),
  setDiscordClientId: (clientId) => ipcRenderer.invoke('discord-set-client-id', clientId),
  updateDiscordPresence: (payload) => ipcRenderer.invoke('discord-update-presence', payload),
  /** Main process only — preload sandbox cannot require('path'). */
  localPathToAudioUrl: (absPath) => ipcRenderer.invoke('local-path-to-file-url', absPath),
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url),
  getSpotifyRedirectUri: () => ipcRenderer.invoke('get-spotify-redirect-uri'),
  spotifyImportLikes: (clientId) => ipcRenderer.invoke('spotify-import-likes', { clientId }),
  onSpotifyImportProgress: (callback) => {
    ipcRenderer.removeAllListeners('spotify-import-progress');
    ipcRenderer.on('spotify-import-progress', (_event, payload) => callback(payload));
  }
});
