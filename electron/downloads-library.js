function coerceTrackId(id) {
  const idString = String(id);
  return /^\d+$/.test(idString) ? Number(idString) : idString;
}

function normalizeDownloadRecord(id, record) {
  if (typeof record === 'string') {
    return {
      id: coerceTrackId(id),
      localPath: record,
      title: `Piste telechargee ${id}`,
      artist: 'Local',
      duration: 0,
      artwork: null,
      url: null,
      sourceUnavailable: false,
      downloadedAt: null
    };
  }

  if (!record || typeof record !== 'object' || typeof record.localPath !== 'string') {
    return null;
  }

  return {
    id: coerceTrackId(id),
    localPath: record.localPath,
    title: record.title || `Piste telechargee ${id}`,
    artist: record.artist || 'Local',
    duration: record.duration || 0,
    artwork: record.artwork || null,
    url: record.url || null,
    sourceUnavailable: !!record.sourceUnavailable,
    downloadedAt: record.downloadedAt || null
  };
}

function createDownloadRecord(track, localPath, now = () => new Date().toISOString()) {
  return {
    localPath,
    title: track?.title || 'Piste telechargee',
    artist: track?.artist || 'Local',
    duration: track?.duration || 0,
    artwork: track?.artwork || null,
    url: track?.url || null,
    sourceUnavailable: !!track?.unavailable,
    downloadedAt: now()
  };
}

function getDownloadPath(downloads, trackId) {
  const record = normalizeDownloadRecord(trackId, downloads?.[trackId]);
  return record?.localPath || null;
}

function getDownloadedTracksLibrary(downloads, fs, downloadsDir) {
  const tracks = Object.entries(downloads || {})
    .map(([id, record]) => normalizeDownloadRecord(id, record))
    .filter(Boolean)
    .filter(track => fs.existsSync(track.localPath))
    .map(track => {
      const sizeBytes = fs.statSync(track.localPath).size;
      return {
        ...track,
        sizeBytes,
        unavailable: false,
        isFixed: true
      };
    });

  return {
    downloadsDir,
    tracks,
    count: tracks.length,
    totalBytes: tracks.reduce((total, track) => total + track.sizeBytes, 0)
  };
}

function deleteDownloadedTrack(downloads, trackId, fs) {
  const nextDownloads = { ...(downloads || {}) };
  const record = normalizeDownloadRecord(trackId, nextDownloads[trackId]);

  if (!record) {
    return { deleted: false, localPath: null, downloads: nextDownloads };
  }

  if (fs.existsSync(record.localPath)) {
    fs.unlinkSync(record.localPath);
  }

  delete nextDownloads[trackId];
  return {
    deleted: true,
    localPath: record.localPath,
    downloads: nextDownloads
  };
}

module.exports = {
  createDownloadRecord,
  deleteDownloadedTrack,
  getDownloadPath,
  getDownloadedTracksLibrary,
  normalizeDownloadRecord
};
