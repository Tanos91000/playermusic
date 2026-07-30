import { useMemo } from 'react';
import { Play, Search as SearchIcon, Heart, Plus } from 'lucide-react';
import { TrackArtPlaceholder, RemoteAvatar } from './MediaPlaceholder';
import PlayingIndicator from './PlayingIndicator';
import TrackListSkeleton from './TrackListSkeleton';
import { formatStreamCount } from '../utils/formatPlayback';

const FILTERS = [
  { key: 'all', label: 'Tout' },
  { key: 'tracks', label: 'Titres' },
  { key: 'artists', label: 'Artistes' }
];

function formatDuration(ms) {
  if (!ms) return '';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Grande carte « meilleur résultat », comme sur Spotify. */
function TopResult({ track, onPlay, isCurrent, isAudioPlaying }) {
  return (
    <button type="button" className="top-result" onClick={onPlay}>
      {track.artwork ? (
        <img src={track.artwork} alt="" className="top-result__art" />
      ) : (
        <TrackArtPlaceholder size={92} radius={10} style={{ boxShadow: '0 10px 30px rgba(0,0,0,0.45)' }} />
      )}
      <span className="top-result__meta">
        <span className="top-result__title truncate">{track.title}</span>
        <span className="top-result__sub truncate">
          Titre <span style={{ opacity: 0.5 }}>•</span> {track.artist || '—'}
        </span>
      </span>
      <span className="top-result__play" aria-hidden>
        {isCurrent ? <PlayingIndicator playing={isAudioPlaying} /> : <Play size={20} fill="currentColor" />}
      </span>
    </button>
  );
}

/** Ligne compacte de résultat (densité proche de Spotify). */
function ResultRow({ track, index, onPlay, isCurrent, isAudioPlaying, isFav, onToggleFavorite, onQueueLast }) {
  return (
    <div className="res-row" onClick={onPlay}>
      <span className="res-row__index">
        {isCurrent ? <PlayingIndicator playing={isAudioPlaying} /> : index + 1}
      </span>
      {track.artwork ? (
        <img src={track.artwork} alt="" className="res-row__art" />
      ) : (
        <TrackArtPlaceholder size={40} radius={6} />
      )}
      <span className="res-row__meta">
        <span className={`truncate res-row__title${isCurrent ? ' is-current' : ''}`}>{track.title}</span>
        <span className="truncate res-row__artist">{track.artist || '—'}</span>
      </span>
      {formatStreamCount(track.playbackCount) != null && (
        <span className="res-row__plays">{formatStreamCount(track.playbackCount)}</span>
      )}
      <span className="res-row__actions row-reveal">
        {onQueueLast && (
          <button
            type="button"
            className="btn-icon"
            title="Ajouter à la file"
            onClick={(e) => { e.stopPropagation(); onQueueLast(track); }}
          >
            <Plus size={16} />
          </button>
        )}
        <button
          type="button"
          className={`btn-icon${isFav ? ' is-active' : ''}`}
          title={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(track, e); }}
        >
          <Heart size={16} fill={isFav ? 'currentColor' : 'none'} />
        </button>
      </span>
      <span className="res-row__time">{formatDuration(track.duration)}</span>
    </div>
  );
}

export default function SearchResults({
  query,
  loading,
  tracks = [],
  artists = [],
  filter,
  onFilterChange,
  onPlay,
  onOpenArtist,
  currentTrack,
  isAudioPlaying,
  favorites = [],
  toggleFavorite,
  onQueueLast
}) {
  const favIds = useMemo(() => new Set(favorites.map((f) => String(f.id))), [favorites]);
  const topResult = tracks[0] || null;
  const restTracks = useMemo(() => (filter === 'tracks' ? tracks : tracks.slice(1, 9)), [tracks, filter]);

  if (loading) {
    return (
      <div className="view-enter">
        <div className="chip-row">
          {FILTERS.map((f) => (
            <span key={f.key} className="skeleton" style={{ width: '76px', height: '30px', borderRadius: '999px' }} />
          ))}
        </div>
        <TrackListSkeleton rows={7} />
      </div>
    );
  }

  if (!query.trim()) {
    return (
      <div className="search-empty view-enter">
        <SearchIcon size={40} strokeWidth={1.5} />
        <h3>Que veux-tu écouter&nbsp;?</h3>
        <p>Cherche un titre, un artiste ou colle un nom d’album.</p>
      </div>
    );
  }

  if (tracks.length === 0 && artists.length === 0) {
    return (
      <div className="search-empty view-enter">
        <SearchIcon size={40} strokeWidth={1.5} />
        <h3>Aucun résultat pour «&nbsp;{query}&nbsp;»</h3>
        <p>Vérifie l’orthographe, ou essaie avec moins de mots.</p>
      </div>
    );
  }

  const showTracks = filter !== 'artists' && tracks.length > 0;
  const showArtists = filter !== 'tracks' && artists.length > 0;

  return (
    <div className="view-enter">
      <div className="chip-row">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`chip${filter === f.key ? ' is-active' : ''}`}
            onClick={() => onFilterChange(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {showTracks && filter === 'all' && topResult && (
        <div className="search-split">
          <section style={{ minWidth: 0 }}>
            <h3 className="artist-section-title">Meilleur résultat</h3>
            <TopResult
              track={topResult}
              isCurrent={currentTrack?.id === topResult.id}
              isAudioPlaying={isAudioPlaying}
              onPlay={() => onPlay(topResult, 0, tracks)}
            />
          </section>

          <section style={{ minWidth: 0 }}>
            <h3 className="artist-section-title">Titres</h3>
            <div className="res-list">
              {restTracks.map((track) => {
                const realIndex = tracks.indexOf(track);
                return (
                  <ResultRow
                    key={track.id}
                    track={track}
                    index={realIndex}
                    isCurrent={currentTrack?.id === track.id}
                    isAudioPlaying={isAudioPlaying}
                    isFav={favIds.has(String(track.id))}
                    onToggleFavorite={toggleFavorite}
                    onQueueLast={onQueueLast}
                    onPlay={() => onPlay(track, realIndex, tracks)}
                  />
                );
              })}
            </div>
          </section>
        </div>
      )}

      {showTracks && filter === 'tracks' && (
        <div className="res-list" style={{ marginBottom: '32px' }}>
          {tracks.map((track, index) => (
            <ResultRow
              key={track.id}
              track={track}
              index={index}
              isCurrent={currentTrack?.id === track.id}
              isAudioPlaying={isAudioPlaying}
              isFav={favIds.has(String(track.id))}
              onToggleFavorite={toggleFavorite}
              onQueueLast={onQueueLast}
              onPlay={() => onPlay(track, index, tracks)}
            />
          ))}
        </div>
      )}

      {showArtists && (
        <section style={{ marginTop: filter === 'artists' ? 0 : '34px' }}>
          <h3 className="artist-section-title">Artistes</h3>
          <div className="artist-cards">
            {artists.map((a) => (
              <button key={a.id} type="button" className="artist-card" onClick={() => onOpenArtist(a.permalinkUrl)}>
                <RemoteAvatar url={a.avatarUrl} size={112} variant="list" wrapperStyle={{ marginBottom: '14px' }} />
                <span className="truncate artist-card__name">{a.fullName || a.username}</span>
                <span className="artist-card__role">Artiste</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
