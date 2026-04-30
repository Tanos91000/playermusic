import { ArrowLeft, ExternalLink } from 'lucide-react';
import TrackList from './TrackList';
import { RemoteAvatar } from './MediaPlaceholder';

function formatFollowers(n) {
  if (n == null || Number.isNaN(n)) return null;
  const x = Number(n);
  if (x >= 1e6) return `${(x / 1e6).toFixed(1)} M abonnés`;
  if (x >= 1e3) return `${Math.round(x / 1e3)} k abonnés`;
  return `${x} abonnés`;
}

function stripHtml(html) {
  if (!html || typeof html !== 'string') return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export default function ArtistProfileView({
  profile,
  tracks,
  loading,
  onBack,
  onPlay,
  onOpenArtistFromTrack,
  currentTrack,
  isAudioPlaying,
  favorites,
  toggleFavorite,
  onTrackDownloaded
}) {
  if (loading && !profile) {
    return (
      <div className="flex-center" style={{ height: '50vh', color: 'var(--text-secondary)' }}>
        <p>Chargement du profil…</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex-center" style={{ height: '40vh', flexDirection: 'column', gap: '16px' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Profil introuvable.</p>
        <button
          type="button"
          className="glass"
          onClick={onBack}
          style={{
            border: 'none',
            borderRadius: '20px',
            padding: '10px 20px',
            cursor: 'pointer',
            color: 'var(--text-primary)'
          }}
        >
          Retour
        </button>
      </div>
    );
  }

  const followersLabel = formatFollowers(profile.followerCount);
  const bio = stripHtml(profile.description);

  return (
    <div style={{ paddingBottom: '40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onBack}
          className="glass"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            border: 'none',
            borderRadius: '20px',
            padding: '8px 16px',
            cursor: 'pointer',
            color: 'var(--text-primary)',
            WebkitAppRegion: 'no-drag'
          }}
        >
          <ArrowLeft size={18} />
          Retour
        </button>
        {profile.permalinkUrl && window.electronAPI?.openExternalUrl && (
          <button
            type="button"
            onClick={() => window.electronAPI.openExternalUrl(profile.permalinkUrl)}
            className="glass"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              border: 'none',
              borderRadius: '20px',
              padding: '8px 16px',
              cursor: 'pointer',
              color: 'var(--accent-color)',
              WebkitAppRegion: 'no-drag'
            }}
          >
            <ExternalLink size={16} />
            SoundCloud
          </button>
        )}
      </div>

      <div
        className="glass animate-fade-in"
        style={{
          display: 'flex',
          gap: '24px',
          alignItems: 'flex-start',
          padding: '24px',
          marginBottom: '28px',
          flexWrap: 'wrap'
        }}
      >
        <RemoteAvatar
          url={profile.avatarUrl}
          size={140}
          variant="profile"
          wrapperStyle={{ flexShrink: 0, marginLeft: 0, marginRight: 0 }}
          imgStyle={{
            boxShadow: '0 12px 40px rgba(0,0,0,0.35)'
          }}
        />
        <div style={{ flex: 1, minWidth: '200px' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: '1.75rem', fontWeight: 700 }}>{profile.fullName}</h2>
          <p style={{ margin: '0 0 12px', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            @{profile.username}
            {followersLabel ? (
              <span style={{ marginLeft: '12px', color: 'var(--text-secondary)' }}>{followersLabel}</span>
            ) : null}
            {profile.trackCount != null ? (
              <span style={{ marginLeft: '12px', color: 'var(--text-secondary)' }}>
                {profile.trackCount} titre{profile.trackCount === 1 ? '' : 's'}
              </span>
            ) : null}
          </p>
          {bio ? (
            <p
              style={{
                margin: 0,
                fontSize: '0.9rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
                maxHeight: '4.5em',
                overflow: 'hidden'
              }}
            >
              {bio}
            </p>
          ) : null}
        </div>
      </div>

      <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '14px', color: 'var(--text-primary)' }}>
        Pistes
      </h3>
      {loading && tracks.length === 0 ? (
        <div style={{ color: 'var(--text-secondary)', padding: '24px', textAlign: 'center' }}>Chargement des pistes…</div>
      ) : (
        <TrackList
          tracks={tracks}
          onPlay={(track, index) => onPlay(track, index, tracks)}
          currentTrack={currentTrack}
          isAudioPlaying={isAudioPlaying}
          favorites={favorites}
          toggleFavorite={toggleFavorite}
          onTrackDownloaded={onTrackDownloaded}
          onOpenArtist={onOpenArtistFromTrack}
        />
      )}
    </div>
  );
}
