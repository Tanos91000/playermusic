#!/usr/bin/env node
/**
 * Télécharge le binaire yt-dlp officiel (Python embarqué).
 * Évite la zipapp youtube-dl-exec qui utilise le python3 système (souvent 3.9 Xcode < 3.10).
 */
const fs = require('fs');
const path = require('path');

const VERSION = process.env.YTDLP_VERSION || '2026.03.17';
const VENDOR = path.join(__dirname, '..', 'electron', 'vendor');

const TARGETS = {
  darwin: {
    url: `https://github.com/yt-dlp/yt-dlp/releases/download/${VERSION}/yt-dlp_macos`,
    filename: 'yt-dlp'
  },
  win32: {
    url: `https://github.com/yt-dlp/yt-dlp/releases/download/${VERSION}/yt-dlp.exe`,
    filename: 'yt-dlp.exe'
  },
  linux: {
    url:
      process.arch === 'arm64'
        ? `https://github.com/yt-dlp/yt-dlp/releases/download/${VERSION}/yt-dlp_linux_aarch64`
        : `https://github.com/yt-dlp/yt-dlp/releases/download/${VERSION}/yt-dlp_linux`,
    filename: process.arch === 'arm64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux'
  }
};

async function download(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'playermusic-ytdlp-fetch/1' }
  });
  if (!res.ok) {
    throw new Error(`yt-dlp download HTTP ${res.status} (${url})`);
  }
  return Buffer.from(await res.arrayBuffer());
}

(async () => {
  const cfg = TARGETS[process.platform];
  if (!cfg) {
    console.warn('ensure-ytdlp-standalone: plateforme non gérée:', process.platform);
    process.exit(0);
  }

  await fs.promises.mkdir(VENDOR, { recursive: true });
  const dest = path.join(VENDOR, cfg.filename);

  if (fs.existsSync(dest) && fs.statSync(dest).size > 500_000) {
    console.log('ensure-ytdlp-standalone: déjà présent →', dest);
    process.exit(0);
  }

  console.log('ensure-ytdlp-standalone: téléchargement', cfg.url);
  const buf = await download(cfg.url);
  await fs.promises.writeFile(dest, buf);
  try {
    await fs.promises.chmod(dest, 0o755);
  } catch {
    /* Windows */
  }
  console.log('ensure-ytdlp-standalone: OK →', dest);
})().catch((err) => {
  console.error('ensure-ytdlp-standalone:', err.message || err);
  process.exit(1);
});
