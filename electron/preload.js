const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  searchSoundCloud: (query) => ipcRenderer.invoke('search-soundcloud', query),
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
  restartApp: () => ipcRenderer.invoke('restart-app')
});
