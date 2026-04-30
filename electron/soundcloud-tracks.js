/**
 * Shared mapping from soundcloud-downloader search results → renderer track shape.
 */

const { appendURL } = require('soundcloud-downloader/dist/util');

/** évite replace('large',…) qui casse les URL sndcdn (images cassées en liste) */
function normalizeSoundCloudAvatarUrl(raw, variant = 'list') {
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

function normalizeSoundCloudArtworkUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let u = raw.trim();
  if (u.startsWith('//')) u = `https:${u}`;
  if (!/^https?:\/\//i.test(u)) return null;
  if (/sndcdn\.com/i.test(u)) {
    const swapped = u.replace(/-large\.(jpg|jpeg|png|webp)$/i, '-t500x500.$1');
    if (swapped !== u) return swapped;
  }
  return u;
}

function mapSoundCloudSearchUser(user) {
  if (!user?.id) return null;
  const u = user;
  if (!u.permalink && !u.permalink_url) return null;
  const permalinkUrl =
    u.permalink_url ||
    (u.permalink ? `https://soundcloud.com/${u.permalink}` : null);
  if (!permalinkUrl) return null;
  const rawAvatar = u.avatar_url || u.avatarUrl;
  const avatarUrl = normalizeSoundCloudAvatarUrl(rawAvatar, 'list');
  return {
    id: u.id,
    username: u.username || '',
    fullName: u.full_name || u.username || '',
    permalinkUrl,
    avatarUrl,
    followerCount: u.followers_count ?? u.follower_count ?? null,
    trackCount: u.track_count ?? null
  };
}

function mapSoundCloudUserProfile(apiUser) {
  if (!apiUser?.id) return null;
  const permalinkUrl =
    apiUser.permalink_url ||
    (apiUser.permalink ? `https://soundcloud.com/${apiUser.permalink}` : null);
  const rawAvatar = apiUser.avatar_url;
  const avatarUrl = normalizeSoundCloudAvatarUrl(rawAvatar, 'profile');
  return {
    id: apiUser.id,
    username: apiUser.username || '',
    fullName: apiUser.full_name || apiUser.username || '',
    permalinkUrl,
    avatarUrl,
    followerCount: apiUser.followers_count ?? apiUser.follower_count ?? null,
    trackCount: apiUser.track_count ?? null,
    description: typeof apiUser.description === 'string' ? apiUser.description : ''
  };
}

function mapSoundCloudCollection(collection, getDownloads, getDownloadPath) {
  const downloads = getDownloads();
  return (collection || []).map((track) => {
    const isUnavailable = track.policy === 'BLOCK' || track.policy === 'SNIP';
    const localPath = getDownloadPath(downloads, track.id);
    const user = track.user || {};
    const artistPermalinkUrl =
      user.permalink_url ||
      (user.permalink ? `https://soundcloud.com/${user.permalink}` : null);
    return {
      id: track.id,
      title: track.title,
      artist: user.username || '',
      artistUserId: user.id,
      artistPermalinkUrl,
      duration: track.duration,
      playbackCount:
        track.playback_count != null
          ? Number(track.playback_count)
          : track.play_count != null
            ? Number(track.play_count)
            : null,
      artwork: normalizeSoundCloudArtworkUrl(track.artwork_url),
      url: track.permalink_url,
      unavailable: isUnavailable && !localPath,
      isFixed: !!localPath,
      localPath
    };
  });
}

async function searchSoundCloudTracks(scdl, query, getDownloads, getDownloadPath, limit = 30) {
  const searchResults = await scdl.search({
    query,
    resourceType: 'tracks',
    limit
  });
  return mapSoundCloudCollection(searchResults.collection, getDownloads, getDownloadPath);
}

async function searchSoundCloudUsers(scdl, query, limit = 15) {
  const searchResults = await scdl.search({
    query,
    resourceType: 'users',
    limit
  });
  return (searchResults.collection || []).map(mapSoundCloudSearchUser).filter(Boolean);
}

async function fetchSoundCloudUserTracks(scdl, userId, getDownloads, getDownloadPath, limitPerPage = 50, maxPages = 5) {
  const clientID = await scdl.getClientID();
  let url = appendURL(
    `https://api-v2.soundcloud.com/users/${userId}/tracks`,
    'client_id',
    clientID,
    'limit',
    String(limitPerPage),
    'offset',
    '0'
  );
  const merged = [];
  for (let page = 0; page < maxPages; page += 1) {
    const { data } = await scdl.axios.get(url);
    merged.push(...mapSoundCloudCollection(data.collection, getDownloads, getDownloadPath));
    if (!data.next_href) break;
    url = appendURL(data.next_href, 'client_id', clientID);
  }
  return merged;
}

async function getSoundCloudArtistBundle(scdl, profileUrl, getDownloads, getDownloadPath) {
  const user = await scdl.getUser(profileUrl);
  const profile = mapSoundCloudUserProfile(user);
  if (!profile) throw new Error('Invalid artist profile');
  const tracks = await fetchSoundCloudUserTracks(scdl, user.id, getDownloads, getDownloadPath);
  return { profile, tracks };
}

async function searchSoundCloudUnified(scdl, query, getDownloads, getDownloadPath, trackLimit = 30, userLimit = 15) {
  const [tracks, artists] = await Promise.all([
    searchSoundCloudTracks(scdl, query, getDownloads, getDownloadPath, trackLimit),
    searchSoundCloudUsers(scdl, query, userLimit)
  ]);
  return { tracks, artists };
}

module.exports = {
  mapSoundCloudCollection,
  mapSoundCloudSearchUser,
  mapSoundCloudUserProfile,
  searchSoundCloudTracks,
  searchSoundCloudUsers,
  fetchSoundCloudUserTracks,
  getSoundCloudArtistBundle,
  searchSoundCloudUnified
};
