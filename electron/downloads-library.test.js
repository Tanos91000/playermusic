const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createDownloadRecord,
  deleteDownloadedTrack,
  getDownloadPath,
  getDownloadedTracksLibrary
} = require('./downloads-library');

function createMemoryFs(files = new Map()) {
  return {
    existsSync(filePath) {
      return files.has(filePath);
    },
    statSync(filePath) {
      return { size: files.get(filePath)?.size ?? 0 };
    },
    unlinkSync(filePath) {
      files.delete(filePath);
    }
  };
}

test('createDownloadRecord stores playable track metadata', () => {
  const record = createDownloadRecord(
    {
      id: 42,
      title: 'One More Time',
      artist: 'Daft Punk',
      duration: 322000,
      artwork: 'cover.jpg',
      url: 'https://soundcloud.com/example',
      unavailable: true
    },
    '/music/42.m4a',
    () => '2026-04-30T08:00:00.000Z'
  );

  assert.deepEqual(record, {
    localPath: '/music/42.m4a',
    title: 'One More Time',
    artist: 'Daft Punk',
    duration: 322000,
    artwork: 'cover.jpg',
    url: 'https://soundcloud.com/example',
    sourceUnavailable: true,
    downloadedAt: '2026-04-30T08:00:00.000Z'
  });
});

test('getDownloadedTracksLibrary supports old path-only records and totals file sizes', () => {
  const downloads = {
    42: {
      localPath: '/music/42.m4a',
      title: 'One More Time',
      artist: 'Daft Punk',
      duration: 322000
    },
    99: '/music/99.mp3',
    missing: '/music/missing.mp3'
  };
  const fs = createMemoryFs(new Map([
    ['/music/42.m4a', { size: 4096 }],
    ['/music/99.mp3', { size: 1024 }]
  ]));

  const library = getDownloadedTracksLibrary(downloads, fs, '/music');

  assert.equal(library.totalBytes, 5120);
  assert.equal(library.count, 2);
  assert.equal(library.downloadsDir, '/music');
  assert.deepEqual(library.tracks.map(track => ({
    id: track.id,
    title: track.title,
    artist: track.artist,
    localPath: track.localPath,
    sizeBytes: track.sizeBytes,
    isFixed: track.isFixed,
    unavailable: track.unavailable
  })), [
    {
      id: 42,
      title: 'One More Time',
      artist: 'Daft Punk',
      localPath: '/music/42.m4a',
      sizeBytes: 4096,
      isFixed: true,
      unavailable: false
    },
    {
      id: 99,
      title: 'Piste telechargee 99',
      artist: 'Local',
      localPath: '/music/99.mp3',
      sizeBytes: 1024,
      isFixed: true,
      unavailable: false
    }
  ]);
});

test('deleteDownloadedTrack removes the file and record', () => {
  const downloads = {
    42: { localPath: '/music/42.m4a', title: 'One More Time' },
    99: '/music/99.mp3'
  };
  const files = new Map([
    ['/music/42.m4a', { size: 4096 }],
    ['/music/99.mp3', { size: 1024 }]
  ]);

  const result = deleteDownloadedTrack(downloads, 42, createMemoryFs(files));

  assert.equal(result.deleted, true);
  assert.equal(result.localPath, '/music/42.m4a');
  assert.deepEqual(result.downloads, { 99: '/music/99.mp3' });
  assert.equal(files.has('/music/42.m4a'), false);
  assert.equal(files.has('/music/99.mp3'), true);
});

test('getDownloadPath returns localPath for old and new record formats', () => {
  assert.equal(getDownloadPath({ 42: '/music/42.mp3' }, 42), '/music/42.mp3');
  assert.equal(getDownloadPath({ 42: { localPath: '/music/42.m4a' } }, 42), '/music/42.m4a');
  assert.equal(getDownloadPath({}, 42), null);
});
