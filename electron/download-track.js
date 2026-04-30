const http = require('http');
const https = require('https');
const { spawnSync } = require('child_process');
const YOUTUBE_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;
const { createDownloadRecord, getDownloadPath } = require('./downloads-library');

function loadBundledFfmpegPaths(path) {
  try {
    const rawFfmpeg = require('ffmpeg-static');
    const ffprobeRel = require('ffprobe-static').path;
    return {
      ffmpeg: unpackFriendlyBinaryPath(path, rawFfmpeg),
      ffprobeDir: path.dirname(unpackFriendlyBinaryPath(path, ffprobeRel))
    };
  } catch {
    return { ffmpeg: null, ffprobeDir: null };
  }
}

function unpackFriendlyBinaryPath(nodePath, binaryPath) {
  if (!binaryPath || typeof binaryPath !== 'string') return binaryPath;
  const fragment = `${nodePath.sep}app.asar${nodePath.sep}`;
  const replacement = `${nodePath.sep}app.asar.unpacked${nodePath.sep}`;
  return binaryPath.includes(fragment)
    ? binaryPath.replace(fragment, replacement)
    : binaryPath;
}

function chmodExecutable(fs, nodePath, binaryPath) {
  const resolved = unpackFriendlyBinaryPath(nodePath, binaryPath);
  if (!resolved || !fs.existsSync(resolved)) return;
  try {
    fs.chmodSync(resolved, 0o755);
  } catch {
    /* packaged apps / Windows */
  }
}

function vendorYtDlpFilename() {
  if (process.platform === 'win32') return 'yt-dlp.exe';
  if (process.platform === 'linux') {
    return process.arch === 'arm64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux';
  }
  return 'yt-dlp';
}

function ensureDownloadBinariesExecutable(fs, nodePath) {
  try {
    chmodExecutable(fs, nodePath, nodePath.join(__dirname, 'vendor', vendorYtDlpFilename()));
  } catch {
    /* ignore */
  }
  try {
    const pkgRoot = nodePath.dirname(require.resolve('youtube-dl-exec/package.json'));
    const name = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
    chmodExecutable(fs, nodePath, nodePath.join(pkgRoot, 'bin', name));
  } catch {
    /* ignore */
  }
  const { ffmpeg, ffprobeDir } = loadBundledFfmpegPaths(nodePath);
  chmodExecutable(fs, nodePath, ffmpeg);
  if (ffprobeDir) {
    const probe = process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe';
    chmodExecutable(fs, nodePath, nodePath.join(ffprobeDir, probe));
  }
}

function ytDlErrorText(err) {
  return [err?.message, err?.stderr, err?.stdout]
    .filter((s) => typeof s === 'string' && s.trim())
    .join('\n');
}

function looksLikeMetadataOrFfmpegFailure(text) {
  return /Postprocess|ffmpeg|ffprobe|Embedding|metadata|Convert|AtomicParsley/i.test(text || '');
}

function buildYtDlpEnv(path, processEnv = process.env) {
  const { ffmpeg, ffprobeDir } = loadBundledFfmpegPaths(path);
  if (!ffmpeg || !ffprobeDir) return { ...processEnv };
  const prepend = `${path.dirname(ffmpeg)}${path.delimiter}${ffprobeDir}`;
  return {
    ...processEnv,
    PATH: `${prepend}${path.delimiter}${processEnv.PATH || ''}`
  };
}

function getYoutubeIdFromUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      return YOUTUBE_ID_PATTERN.test(id) ? id : null;
    }

    if (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'music.youtube.com'
    ) {
      const watchId = parsed.searchParams.get('v');
      if (watchId && YOUTUBE_ID_PATTERN.test(watchId)) return watchId;

      const pathParts = parsed.pathname.split('/').filter(Boolean);
      if ((pathParts[0] === 'shorts' || pathParts[0] === 'embed') && YOUTUBE_ID_PATTERN.test(pathParts[1])) {
        return pathParts[1];
      }
    }
  } catch {
    return null;
  }

  return null;
}

function getYoutubeWatchUrl(video) {
  const directId = video?.id || video?.videoId;
  if (typeof directId === 'string' && YOUTUBE_ID_PATTERN.test(directId)) {
    return `https://www.youtube.com/watch?v=${directId}`;
  }

  if (typeof video?.url === 'string') {
    const urlId = getYoutubeIdFromUrl(video.url);
    if (urlId) return `https://www.youtube.com/watch?v=${urlId}`;
  }

  throw new Error('No valid YouTube URL found for this track');
}

function getTrackQuery(track) {
  const artist = typeof track?.artist === 'string' ? track.artist.trim() : '';
  const title = typeof track?.title === 'string' ? track.title.trim() : '';
  const query = [artist, title].filter(Boolean).join(' - ');

  if (!query) {
    throw new Error('Track is missing artist and title');
  }

  return query;
}

function getSafeTrackId(track) {
  if (track?.id === undefined || track?.id === null) {
    throw new Error('Track is missing an id');
  }

  return String(track.id).replace(/[^a-zA-Z0-9_-]/g, '_');
}

function sanitizeFilenameSegment(segment) {
  const raw = String(segment ?? '')
    .replace(/[/\\?%*:|"<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 96);

  return raw || '';
}

function buildFinalBasename(track, trackId) {
  const artist = sanitizeFilenameSegment(track?.artist);
  const title = sanitizeFilenameSegment(track?.title);
  const joined = [artist, title].filter(Boolean).join(' - ');
  const base = joined || `track_${trackId}`;
  return `${base}_${trackId}`;
}

function pickExistingDownload(fs, pathMod, downloadsDir, trackId, getDownloads, track) {
  const downloads = getDownloads();
  const recordPath = getDownloadPath(downloads, track.id);
  if (typeof recordPath === 'string' && fs.existsSync(recordPath)) {
    const st = fs.statSync(recordPath);
    if (st.size > 1024) return recordPath;
  }

  const legacy = pathMod.join(downloadsDir, `${trackId}.m4a`);
  if (fs.existsSync(legacy) && fs.statSync(legacy).size > 1024) return legacy;

  const preferredBase = buildFinalBasename(track, trackId);
  for (const ext of ['.m4a', '.webm', '.opus', '.mp3', '.mp4']) {
    const candidate = pathMod.join(downloadsDir, `${preferredBase}${ext}`);
    if (fs.existsSync(candidate) && fs.statSync(candidate).size > 1024) return candidate;
  }

  return null;
}

function downloadToFile(urlString, destPath, fs) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlString);
    const client = parsed.protocol === 'https:' ? https : http;
    const file = fs.createWriteStream(destPath);

    client.get(urlString, { headers: { 'User-Agent': 'AuraPlayer/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        try { fs.unlinkSync(destPath); } catch {}
        downloadToFile(new URL(res.headers.location, urlString).href, destPath, fs)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(destPath); } catch {}
        reject(new Error(`Cover download failed (${res.statusCode})`));
        return;
      }

      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
    }).on('error', (err) => {
      try {
        file.close();
        fs.unlinkSync(destPath);
      } catch {}
      reject(err);
    });
  });
}

function ffmpegAttachCoverAndMeta({
  ffmpegPath,
  inputAudioPath,
  coverPath,
  outputPath,
  title,
  artist
}) {
  const args = [
    '-hide_banner',
    '-loglevel', 'error',
    '-y',
    '-i', inputAudioPath,
    '-i', coverPath,
    '-map', '0:a',
    '-map', '1',
    '-c:a', 'copy',
    '-c:v', 'mjpeg',
    '-disposition:v:0', 'attached_pic',
    '-metadata', `title=${title}`,
    '-metadata', `artist=${artist}`,
    outputPath
  ];

  const r = spawnSync(ffmpegPath, args, { encoding: 'utf8' });
  return r.status === 0 ? { ok: true } : { ok: false, stderr: r.stderr || '' };
}

function ffmpegMetaOnly({ ffmpegPath, inputPath, outputPath, title, artist }) {
  const args = [
    '-hide_banner',
    '-loglevel', 'error',
    '-y',
    '-i', inputPath,
    '-map', '0',
    '-c', 'copy',
    '-metadata', `title=${title}`,
    '-metadata', `artist=${artist}`,
    outputPath
  ];

  const r = spawnSync(ffmpegPath, args, { encoding: 'utf8' });
  return r.status === 0 ? { ok: true } : { ok: false, stderr: r.stderr || '' };
}

async function finalizeDownloadedAudioAsync(deps) {
  const {
    downloadedPath,
    downloadsDir,
    track,
    trackId,
    pathMod,
    fs,
    ffmpegPath,
    os,
    logger
  } = deps;

  const ext = pathMod.extname(downloadedPath).toLowerCase() || '.m4a';
  const finalPath = pathMod.join(downloadsDir, `${buildFinalBasename(track, trackId)}${ext}`);
  const title = typeof track?.title === 'string' ? track.title.trim() : 'Unknown title';
  const artist = typeof track?.artist === 'string' ? track.artist.trim() : 'Unknown artist';

  if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
    if (downloadedPath !== finalPath) {
      try {
        fs.renameSync(downloadedPath, finalPath);
      } catch (err) {
        logger.warn('Rename without ffmpeg failed:', err?.message || err);
        return downloadedPath;
      }
    }
    return finalPath;
  }

  const tmpOut = pathMod.join(downloadsDir, `.aura_${trackId}_${Date.now()}${ext}`);
  const artworkUrl = typeof track?.artwork === 'string' ? track.artwork.trim() : '';
  const canEmbedCover = /^https?:\/\//i.test(artworkUrl) && (ext === '.m4a' || ext === '.mp4');

  let coverTmp = null;
  if (canEmbedCover) {
    coverTmp = pathMod.join(os.tmpdir(), `aura-cover-${trackId}-${Date.now()}.jpg`);
    try {
      await downloadToFile(artworkUrl, coverTmp, fs);
    } catch {
      try { fs.unlinkSync(coverTmp); } catch {}
      coverTmp = null;
    }
  }

  let metaOk = false;
  if (coverTmp && fs.existsSync(coverTmp)) {
    const r = ffmpegAttachCoverAndMeta({
      ffmpegPath,
      inputAudioPath: downloadedPath,
      coverPath: coverTmp,
      outputPath: tmpOut,
      title,
      artist
    });
    metaOk = r.ok;
    try { fs.unlinkSync(coverTmp); } catch {}
  }

  if (!metaOk) {
    const r = ffmpegMetaOnly({
      ffmpegPath,
      inputPath: downloadedPath,
      outputPath: tmpOut,
      title,
      artist
    });
    metaOk = r.ok;
    if (!metaOk && r.stderr) logger.warn('ffmpeg metadata:', r.stderr.trim());
  }

  if (metaOk && fs.existsSync(tmpOut)) {
    try { fs.unlinkSync(downloadedPath); } catch {}
    fs.renameSync(tmpOut, finalPath);
    return finalPath;
  }

  try { fs.unlinkSync(tmpOut); } catch {}

  if (downloadedPath !== finalPath) {
    try {
      fs.renameSync(downloadedPath, finalPath);
    } catch {
      return downloadedPath;
    }
  }

  return finalPath;
}

function normalizeYtDlStdout(result) {
  if (typeof result === 'string') return result.trim();
  if (Buffer.isBuffer(result)) return result.toString('utf8').trim();
  return '';
}

function createDownloadTrackHandler({
  downloadsDir,
  fs,
  path: pathMod,
  os,
  getDownloads,
  saveDownloads,
  youtubeDl,
  now,
  logger = console,
  afterYtDlDownload
}) {
  const bundled = loadBundledFfmpegPaths(pathMod);
  const finalize =
    typeof afterYtDlDownload === 'function' ? afterYtDlDownload : finalizeDownloadedAudioAsync;

  return async function downloadTrack(_event, track) {
    const query = getTrackQuery(track);
    const trackId = getSafeTrackId(track);

    let downloadedPath = null;

    try {
      logger.log(`Starting download for: ${query}`);

      const existing = pickExistingDownload(fs, pathMod, downloadsDir, trackId, getDownloads, track);
      if (existing) {
        const downloads = getDownloads();
        downloads[track.id] = createDownloadRecord(track, existing, now);
        saveDownloads(downloads);
        return { success: true, localPath: existing };
      }

      ensureDownloadBinariesExecutable(fs, pathMod);

      const outputTemplate = pathMod.join(downloadsDir, `.aura_ytdl_${trackId}_${Date.now()}.%(ext)s`);
      const ytEnv = buildYtDlpEnv(pathMod);

      const commonYtFlags = {
        format: 'bestaudio[ext=m4a]/bestaudio/best',
        output: outputTemplate,
        print: 'after_move:filepath',
        noPlaylist: true,
        noCheckCertificates: true,
        noWarnings: true,
        embedThumbnail: false,
        addHeader: [
          'referer:https://www.youtube.com/',
          'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ]
      };

      let ytResult;
      try {
        ytResult = await youtubeDl(`ytsearch1:${query}`, { ...commonYtFlags, addMetadata: true }, { env: ytEnv });
      } catch (err) {
        if (looksLikeMetadataOrFfmpegFailure(ytDlErrorText(err))) {
          logger.warn('yt-dlp addMetadata failed, retrying without:', ytDlErrorText(err).slice(0, 400));
          ytResult = await youtubeDl(`ytsearch1:${query}`, { ...commonYtFlags, addMetadata: false }, { env: ytEnv });
        } else {
          throw err;
        }
      }

      downloadedPath = normalizeYtDlStdout(ytResult);
      if (!downloadedPath || !fs.existsSync(downloadedPath)) {
        throw new Error('Download finished but output file is missing');
      }

      const finalPath = await finalize({
        downloadedPath,
        downloadsDir,
        track,
        trackId,
        pathMod,
        fs,
        ffmpegPath: bundled.ffmpeg,
        os,
        logger
      });

      downloadedPath = null;

      logger.log(`Download finished: ${finalPath}`);
      const downloads = getDownloads();
      downloads[track.id] = createDownloadRecord(track, finalPath, now);
      saveDownloads(downloads);
      return { success: true, localPath: finalPath };
    } catch (error) {
      if (downloadedPath && fs.existsSync(downloadedPath)) {
        try { fs.unlinkSync(downloadedPath); } catch {}
      }
      logger.error('Download error:', error);
      throw error;
    }
  };
}

function resolveYtDlpBinaryPath(nodePath, fsMod = require('fs')) {
  const vendorFile = vendorYtDlpFilename();
  const candidates = [];

  try {
    const { app } = require('electron');
    if (app?.isPackaged && process.resourcesPath) {
      candidates.push(
        nodePath.join(process.resourcesPath, 'app.asar.unpacked', 'electron', 'vendor', vendorFile)
      );
    }
  } catch {
    /* tests sans Electron */
  }

  candidates.push(nodePath.join(__dirname, 'vendor', vendorFile));

  for (const raw of candidates) {
    const p = unpackFriendlyBinaryPath(nodePath, raw);
    try {
      if (fsMod.existsSync(p) && fsMod.statSync(p).size > 10_000) {
        return p;
      }
    } catch {
      /* ignore */
    }
  }

  /* Ancienne zipapp npm (#!/usr/bin/env python3) — exige Python ≥ 3.10 ; évité en prod via electron/vendor */
  const name = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
  const pkgRoot = nodePath.dirname(require.resolve('youtube-dl-exec/package.json'));
  let resolved = unpackFriendlyBinaryPath(nodePath, nodePath.join(pkgRoot, 'bin', name));

  if (!fsMod.existsSync(resolved)) {
    try {
      const { app } = require('electron');
      if (app?.isPackaged && process.resourcesPath) {
        const fallback = nodePath.join(
          process.resourcesPath,
          'app.asar.unpacked',
          'node_modules',
          'youtube-dl-exec',
          'bin',
          name
        );
        if (fsMod.existsSync(fallback)) resolved = fallback;
      }
    } catch {
      /* ignore */
    }
  }

  return resolved;
}

/**
 * youtube-dl-exec utilise tinyspawn qui fait `cmd.split(' ')`, ce qui casse les chemins
 * avec espaces (ex. /Applications/Aura Player.app/...). On spawn directement avec argv.
 */
function createYoutubeDlUnpack(nodePath) {
  const binPath = resolveYtDlpBinaryPath(nodePath);
  const dargs = require('dargs');
  const { spawn } = require('child_process');

  return async function youtubeDl(url, flags = {}, execOpts = {}) {
    const argv = [url, ...dargs(flags, { useEquals: false }).filter(Boolean)];
    return new Promise((resolve, reject) => {
      const child = spawn(binPath, argv, {
        windowsHide: true,
        ...execOpts
      });
      let stdout = '';
      let stderr = '';
      child.stdout?.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr?.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      child.on('error', (err) => {
        Object.assign(err, { stderr, stdout });
        reject(err);
      });
      child.on('close', (exitCode, signal) => {
        if (exitCode === 0) {
          const raw = stdout.trim();
          if (!raw) {
            resolve('');
            return;
          }
          if (raw.startsWith('{')) {
            try {
              resolve(JSON.parse(raw));
            } catch {
              resolve(raw);
            }
          } else {
            resolve(raw);
          }
          return;
        }
        const msg = [stderr.trim(), stdout.trim()].filter(Boolean).join('\n')
          || `yt-dlp a échoué (code ${exitCode}${signal ? `, signal ${signal}` : ''})`;
        const err = new Error(msg);
        Object.assign(err, { stderr, stdout, exitCode, signal });
        reject(err);
      });
    });
  };
}

module.exports = {
  createDownloadTrackHandler,
  createYoutubeDlUnpack,
  ensureDownloadBinariesExecutable,
  getYoutubeWatchUrl,
  resolveYtDlpBinaryPath,
  /** exported for tests */
  buildFinalBasename,
  unpackFriendlyBinaryPath
};
