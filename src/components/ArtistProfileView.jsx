import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ExternalLink, Play, Shuffle, Users, Music2, Headphones, ListPlus } from 'lucide-react';
import TrackList from './TrackList';
import { RemoteAvatar } from './MediaPlaceholder';
import { normalizeSoundCloudAvatarUrl } from '../utils/soundcloudArtist';
import { formatStreamCount } from '../utils/formatPlayback';
import { extractPalette, FALLBACK_PALETTE } from '../utils/dominantColor';

function formatFollowers(n) {
  if (n == null || Number.isNaN(n)) return null;
  const x = Number(n);
  if (x >= 1e6) return `${(x / 1e6).toFixed(1)} M`;
  if (x >= 1e3) return `${Math.round(x / 1e3)} k`;
  return `${x}`;
}

function stripHtml(html) {
  if (!html || typeof html !== 'string') return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function Stat({ Icon, value, label }) {
  if (value == null) return null;
  return (
    <div className="artist-stat">
      <Icon size={15} style={{ opacity: 0.8, flexShrink: 0 }} />
      <span style={{ fontWeight: 700 }}>{value}</span>
      <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>{label}</span>
    </div>
  );
}

export default function ArtistProfileView({
  profile,
  tracks,
  loading,
  onBack,
  onPlay,
  onOpenArtistFromTrack,
  onQueueLast,
  ...trackListProps
}) {
  const [palette, setPalette] = useState(FALLBACK_PALETTE);
  const [bioOpen, setBioOpen] = useState(false);

  const avatarUrl = useMemo(
    () => normalizeSoundCloudAvatarUrl(profile?.avatarUrl, 'profile'),
    [profile?.avatarUrl]
  );

  /** La page entière se teinte de la couleur dominante de la photo de profil. */
  useEffect(() => {
    let cancelled = false;
    setPalette(FALLBACK_PALETTE);
    setBioOpen(false);
    if (!avatarUrl) return undefined;
    extractPalette(avatarUrl).then((p) => {
      if (!cancelled) setPalette(p);
    });
    return () => {
      cancelled = true;
    };
  }, [avatarUrl]);

  const totalPlays = useMemo(() => {
    if (!Array.isArray(tracks) || tracks.length === 0) return null;
    const sum = tracks.reduce((acc, t) => acc + (Number(t.playbackCount) || 0), 0);
    return sum > 0 ? sum : null;
  }, [tracks]);

  const topTracks = useMemo(() => {
    if (!Array.isArray(tracks)) return [];
    return [...tracks]
      .sort((a, b) => (Number(b.playbackCount) || 0) - (Number(a.playbackCount) || 0))
      .slice(0, 5);
  }, [tracks]);

  if (loading && !profile) {
    return (
      <div className="view-enter" style={{ paddingBottom: '40px' }}>
        <div className="skeleton" style={{ height: '280px', borderRadius: 'var(--radius-lg)', marginBottom: '28px' }} />
        <div className="skeleton" style={{ height: '18px', width: '30%', marginBottom: '16px' }} />
        <div className="skeleton" style={{ height: '64px', borderRadius: 'var(--radius-md)' }} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex-center" style={{ height: '40vh', flexDirection: 'column', gap: '16px' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Profil introuvable.</p>
        <button type="button" className="btn-pill" onClick={onBack}>Retour</button>
      </div>
    );
  }

  const followersLabel = formatFollowers(profile.followerCount);
  const bio = stripHtml(profile.description);
  const bioIsLong = bio.length > 220;

  return (
    <div
      className="artist-page view-enter"
      style={{
        '--artist-primary': palette.primary,
        '--artist-soft': palette.soft,
        '--artist-glow': palette.glow,
        '--artist-deep': palette.deep,
        '--artist-on-primary': palette.onPrimary
      }}
    >
      {/* Bandeau immersif teinté par la photo de profil */}
      <header className="artist-hero" style={{ background: palette.gradient }}>
        {avatarUrl && (
          <div className="artist-hero__bleed" style={{ backgroundImage: `url(${avatarUrl})` }} aria-hidden />
        )}
        <div className="artist-hero__veil" aria-hidden />

        <div className="artist-hero__top">
          <button type="button" className="btn-icon artist-hero__back" onClick={onBack} title="Retour">
            <ArrowLeft size={20} />
          </button>
          {profile.permalinkUrl && window.electronAPI?.openExternalUrl && (
            <button
              type="button"
              className="btn-pill"
              onClick={() => window.electronAPI.openExternalUrl(profile.permalinkUrl)}
            >
              <ExternalLink size={15} />
              SoundCloud
            </button>
          )}
        </div>

        <div className="artist-hero__body">
          <div className="artist-hero__avatar">
            <RemoteAvatar
              url={profile.avatarUrl}
              size={148}
              variant="profile"
              wrapperStyle={{ marginLeft: 0, marginRight: 0 }}
              imgStyle={{ boxShadow: `0 18px 60px ${palette.glow}, 0 0 0 4px rgba(255,255,255,0.1)` }}
            />
          </div>

          <div className="artist-hero__meta">
            <span className="artist-hero__kicker">Artiste</span>
            <h2 className="artist-hero__name">{profile.fullName || profile.username}</h2>
            <div className="artist-hero__stats">
              <Stat Icon={Users} value={followersLabel} label="abonnés" />
              <Stat Icon={Music2} value={profile.trackCount != null ? profile.trackCount : null} label="titres" />
              <Stat Icon={Headphones} value={formatStreamCount(totalPlays)} label="lectures" />
            </div>

            {bio && (
              <p className={`artist-hero__bio${bioOpen ? ' is-open' : ''}`}>
                {bio}
                {bioIsLong && (
                  <button type="button" className="artist-hero__more" onClick={() => setBioOpen((v) => !v)}>
                    {bioOpen ? 'voir moins' : 'voir plus'}
                  </button>
                )}
              </p>
            )}
          </div>
        </div>

        <div className="artist-hero__actions">
          <button
            type="button"
            className="artist-cta"
            disabled={!tracks?.length}
            onClick={() => tracks?.length && onPlay(tracks[0], 0, tracks)}
          >
            <Play size={20} fill="currentColor" />
            Lecture
          </button>
          <button
            type="button"
            className="btn-pill"
            disabled={!tracks?.length}
            onClick={() => {
              if (!tracks?.length) return;
              const i = Math.floor(Math.random() * tracks.length);
              onPlay(tracks[i], i, tracks);
            }}
          >
            <Shuffle size={17} />
            Aléatoire
          </button>
          {typeof onQueueLast === 'function' && (
            <button
              type="button"
              className="btn-pill"
              disabled={!tracks?.length}
              onClick={() => tracks.forEach((t) => onQueueLast(t))}
              title="Ajouter tous les titres à la file d'attente"
            >
              <ListPlus size={17} />
              Tout mettre en file
            </button>
          )}
        </div>
      </header>

      {topTracks.length > 0 && (
        <section style={{ marginBottom: '34px' }}>
          <h3 className="artist-section-title">Les plus écoutés</h3>
          <div className="artist-top-grid">
            {topTracks.map((track, index) => (
              <button
                key={track.id}
                type="button"
                className="artist-top-card"
                onClick={() => onPlay(track, tracks.indexOf(track), tracks)}
              >
                <span className="artist-top-card__rank">{index + 1}</span>
                {track.artwork ? (
                  <img src={track.artwork} alt="" className="artist-top-card__art" />
                ) : (
                  <span className="artist-top-card__art artist-top-card__art--empty" aria-hidden />
                )}
                <span className="artist-top-card__meta">
                  <span className="truncate" style={{ fontWeight: 650, fontSize: '0.9rem' }}>{track.title}</span>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                    {formatStreamCount(track.playbackCount) ?? '—'} lectures
                  </span>
                </span>
                <span className="artist-top-card__play" aria-hidden>
                  <Play size={14} fill="currentColor" />
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <h3 className="artist-section-title">Discographie</h3>
      {loading && tracks.length === 0 ? (
        <div style={{ color: 'var(--text-secondary)', padding: '24px', textAlign: 'center' }}>Chargement des pistes…</div>
      ) : (
        <TrackList
          {...trackListProps}
          onQueueLast={onQueueLast}
          tracks={tracks}
          onPlay={(track, index) => onPlay(track, index, tracks)}
          onOpenArtist={onOpenArtistFromTrack}
        />
      )}
    </div>
  );
}
