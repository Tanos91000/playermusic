/**
 * Recherche de paroles sur lrclib.net.
 *
 * Les titres SoundCloud sont très bruités (« MEANT TO BE (HARDSTYLE) [SLOWED]
 * prod. XYZ »), ce qui faisait échouer la recherche la plupart du temps.
 * On nettoie le titre par paliers et on tente plusieurs requêtes.
 */

const NOISE_PATTERNS = [
  /\((?:official|audio|video|lyrics?|visualizer|hd|hq|4k)[^)]*\)/gi,
  /\[(?:official|audio|video|lyrics?|visualizer|hd|hq|4k)[^\]]*\]/gi,
  /\b(?:sped\s*up|slowed(?:\s*\+?\s*reverb)?|reverb|hardstyle|nightcore|remix|bootleg|edit|mashup|cover|instrumental|extended|radio\s*edit|club\s*mix|vip\s*mix|ultra\s*slowed|perfectly\s*slowed)\b/gi,
  /\bprod\.?\s*(?:by)?\s*[^\s-][^-|)\]]*/gi,
  /\bfree\s*(?:dl|download)\b/gi,
  /\bft\.?\b|\bfeat\.?\b/gi,
  /[[(][^)\]]*[)\]]/g
];

/** Retire les mentions de version/production qui empêchent la correspondance. */
export function cleanTitle(rawTitle) {
  let t = String(rawTitle || '');
  for (const re of NOISE_PATTERNS) t = t.replace(re, ' ');
  t = t
    .replace(/[_|]+/g, ' ')
    .replace(/\s*[-–—]\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return t;
}

/** L'artiste SoundCloud contient souvent « Records », « Official », etc. */
export function cleanArtist(rawArtist) {
  return String(rawArtist || '')
    .replace(/\b(?:official|music|records?|prod|beats?|tv)\b/gi, ' ')
    .replace(/[^\p{L}\p{N}\s&'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Titre sans la partie après un tiret (souvent « Titre - Version »). */
function titleBeforeDash(title) {
  const idx = title.search(/\s[-–—]\s/);
  return idx > 0 ? title.slice(0, idx).trim() : title;
}

export function parseSyncedLyrics(lrc) {
  if (typeof lrc !== 'string' || !lrc.trim()) return [];
  const out = [];
  for (const line of lrc.split('\n')) {
    // Une ligne peut porter plusieurs horodatages : [00:12.34][01:02.00] texte
    const stamps = [...line.matchAll(/\[(\d{1,3}):(\d{2}(?:[.:]\d{1,3})?)\]/g)];
    if (stamps.length === 0) continue;
    const text = line.replace(/\[[^\]]*\]/g, '').trim();
    for (const m of stamps) {
      const minutes = parseInt(m[1], 10);
      const seconds = parseFloat(String(m[2]).replace(':', '.'));
      if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) continue;
      out.push({ time: minutes * 60 + seconds, text });
    }
  }
  return out.sort((a, b) => a.time - b.time);
}

function pickBest(results, durationSec) {
  if (!Array.isArray(results) || results.length === 0) return null;
  const synced = results.filter((r) => r.syncedLyrics);
  const pool = synced.length > 0 ? synced : results.filter((r) => r.plainLyrics);
  if (pool.length === 0) return null;
  if (!durationSec) return pool[0];
  // À défaut d'identifiant commun, la durée est le meilleur discriminant.
  return pool.reduce((best, r) => {
    const d = Math.abs((r.duration || 0) - durationSec);
    const bd = Math.abs((best.duration || 0) - durationSec);
    return d < bd ? r : best;
  }, pool[0]);
}

async function getJson(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) return null;
  return res.json();
}

/**
 * Renvoie `{ lines, synced, source }` ou `null` si rien n'a été trouvé.
 * `lines` : `[{ time, text }]` (une seule entrée à time 0 si non synchronisé).
 */
export async function fetchLyrics(track, signal) {
  if (!track) return null;
  const durationSec = track.duration ? Math.round(track.duration / 1000) : null;
  const title = cleanTitle(track.title);
  const artist = cleanArtist(track.artist);
  const shortTitle = titleBeforeDash(title);

  // Du plus précis au plus large : la première tentative qui donne des paroles gagne.
  const attempts = [];
  if (title && artist) {
    attempts.push(
      `https://lrclib.net/api/search?${new URLSearchParams({ track_name: title, artist_name: artist })}`
    );
  }
  if (shortTitle && shortTitle !== title && artist) {
    attempts.push(
      `https://lrclib.net/api/search?${new URLSearchParams({ track_name: shortTitle, artist_name: artist })}`
    );
  }
  if (title) attempts.push(`https://lrclib.net/api/search?${new URLSearchParams({ q: `${title} ${artist}`.trim() })}`);
  if (shortTitle && shortTitle !== title) {
    attempts.push(`https://lrclib.net/api/search?${new URLSearchParams({ q: shortTitle })}`);
  }

  for (const url of attempts) {
    let data = null;
    try {
      data = await getJson(url, signal);
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      continue;
    }
    const best = pickBest(data, durationSec);
    if (!best) continue;

    if (best.syncedLyrics) {
      const lines = parseSyncedLyrics(best.syncedLyrics);
      if (lines.length > 0) {
        return { lines, synced: true, source: `${best.artistName} — ${best.trackName}` };
      }
    }
    if (best.plainLyrics && best.plainLyrics.trim()) {
      return {
        lines: [{ time: 0, text: best.plainLyrics.trim() }],
        synced: false,
        source: `${best.artistName} — ${best.trackName}`
      };
    }
  }

  return null;
}
