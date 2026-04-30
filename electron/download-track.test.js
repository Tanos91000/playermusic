const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  createDownloadTrackHandler,
  getYoutubeWatchUrl,
  buildFinalBasename
} = require('./download-track');

test('getYoutubeWatchUrl prefers a canonical watch URL from a video id', () => {
  assert.equal(
    getYoutubeWatchUrl({ id: 'FGBhQbmPwH8', url: 'not a valid url' }),
    'https://www.youtube.com/watch?v=FGBhQbmPwH8'
  );
});

test('download handler uses ytsearch1 and format fallback', async () => {
  const calls = [];
  const savedDownloads = [];
  const downloadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-downloads-'));

  const handler = createDownloadTrackHandler({
    downloadsDir,
    fs,
    path,
    os,
    getDownloads: () => ({}),
    saveDownloads: (downloads) => savedDownloads.push(downloads),
    youtubeDl: async (url, opts) => {
      calls.push([url, opts]);
      const outPath = opts.output.replace('.%(ext)s', '.m4a');
      fs.writeFileSync(outPath, Buffer.alloc(2048));
      return outPath;
    },
    afterYtDlDownload: async ({ downloadedPath: dlPath, downloadsDir: dir, track, trackId, pathMod }) => {
      const dest = pathMod.join(dir, `${buildFinalBasename(track, trackId)}.m4a`);
      fs.renameSync(dlPath, dest);
      return dest;
    },
    now: () => '2026-04-30T08:00:00.000Z',
    logger: { log() {}, error() {}, warn() {} }
  });

  const result = await handler(null, {
    id: 123,
    artist: 'Daft Punk',
    title: 'One More Time'
  });

  assert.equal(result.success, true);
  assert.equal(result.localPath, path.join(downloadsDir, `${buildFinalBasename({ artist: 'Daft Punk', title: 'One More Time' }, '123')}.m4a`));
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'ytsearch1:Daft Punk - One More Time');
  assert.equal(calls[0][1].format, 'bestaudio[ext=m4a]/bestaudio/best');
  assert.equal(calls[0][1].print, 'after_move:filepath');
  assert.equal(calls[0][1].addMetadata, true);
  assert.deepEqual(savedDownloads, [{
    123: {
      localPath: result.localPath,
      title: 'One More Time',
      artist: 'Daft Punk',
      duration: 0,
      artwork: null,
      url: null,
      sourceUnavailable: false,
      downloadedAt: '2026-04-30T08:00:00.000Z'
    }
  }]);

  fs.rmSync(downloadsDir, { recursive: true, force: true });
});

test('pickExistingDownload via getDownloadPath skips yt-dlp when file exists', async () => {
  const downloadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-downloads-'));
  const existingPath = path.join(downloadsDir, `${buildFinalBasename({ artist: 'X', title: 'Y' }, '9')}.m4a`);
  fs.writeFileSync(existingPath, Buffer.alloc(2048));

  const calls = [];
  const handler = createDownloadTrackHandler({
    downloadsDir,
    fs,
    path,
    os,
    getDownloads: () => ({
      9: { localPath: existingPath, title: 'Y', artist: 'X' }
    }),
    saveDownloads: () => {},
    youtubeDl: async () => {
      calls.push(true);
      throw new Error('should not run');
    },
    now: () => '2026-04-30T08:00:00.000Z',
    logger: { log() {}, error() {}, warn() {} }
  });

  const result = await handler(null, { id: 9, artist: 'X', title: 'Y' });
  assert.equal(result.success, true);
  assert.equal(result.localPath, existingPath);
  assert.equal(calls.length, 0);

  fs.rmSync(downloadsDir, { recursive: true, force: true });
});
