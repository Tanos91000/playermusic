const BLOCKED_FIRST_SEGMENTS = new Set([
  'discover',
  'pages',
  'you',
  'charts',
  'explore',
  'stations',
  'popular-tracks',
  'terms-of-use',
  'privacy'
]);

/**
 * Profil SoundCloud pour une piste : champ enrichi ou déduit de l’URL permalink.
 */
export function resolveArtistPermalinkUrl(track) {
  if (!track) return null;
  if (track.artistPermalinkUrl && typeof track.artistPermalinkUrl === 'string') {
    return track.artistPermalinkUrl.trim() || null;
  }
  const raw = track.url;
  if (typeof raw !== 'string' || !raw.includes('soundcloud.com')) return null;
  try {
    const u = new URL(raw.trim());
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    const user = parts[0];
    if (BLOCKED_FIRST_SEGMENTS.has(user.toLowerCase())) return null;
    return `https://soundcloud.com/${user}`;
  } catch {
    return null;
  }
}

/**
 * URL avatar SoundCloud : remplace uniquement le suffixe `-large.ext` (pas un replace global sur « large »).
 * @param {'list'|'profile'} variant — liste recherche (léger) vs page profil
 */
export function normalizeSoundCloudAvatarUrl(raw, variant = 'list') {
  if (!raw || typeof raw !== 'string') return null;
  let u = raw.trim();
  if (u.startsWith('//')) u = `https:${u}`;
  if (!/^https?:\/\//i.test(u)) return null;
  const suffix = variant === 'profile' ? 't500x500' : 't200x200';
  if (/sndcdn\.com/i.test(u)) {
    const swapped = u.replace(/-large\.(jpg|jpeg|png|webp)$/i, `-${suffix}.$1`);
    if (swapped !== u) return swapped;
  }
  return u;
}
