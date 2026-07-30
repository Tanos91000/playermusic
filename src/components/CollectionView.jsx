import { useMemo, useState } from 'react';
import { Play, Shuffle, Search, X, Heart, Plus, Trash2, MoreVertical, Check, Loader2, Download } from 'lucide-react';
import PlayingIndicator from './PlayingIndicator';
import { TrackArtPlaceholder } from './MediaPlaceholder';
import { formatStreamCount } from '../utils/formatPlayback';

function formatDuration(ms) {
  if (!ms) return '';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function totalDurationLabel(tracks) {
  const ms = tracks.reduce((acc, t) => acc + (Number(t.duration) || 0), 0);
  if (!ms) return null;
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h} h ${min % 60} min`;
}

/** Mosaïque des 4 premières pochettes, comme la couverture d'une playlist. */
function CollectionCover({ tracks, icon: Icon, tint }) {
  const arts = tracks.map((t) => t.artwork).filter(Boolean).slice(0, 4);

  if (arts.length === 0) {
    return (
      <div className="coll-cover coll-cover--empty" style={{ background: tint }}>
        {Icon && <Icon size={54} strokeWidth={1.4} />}
      </div>
    );
  }
  if (arts.length < 4) {
    return <img src={arts[0]} alt="" className="coll-cover" />;
  }
  return (
    <div className="coll-cover coll-cover--grid">
      {arts.map((src, i) => (
        <img key={`${src}-${i}`} src={src} alt="" />
      ))}
    </div>
  );
}

function Row({
  track, index, isCurrent, isAudioPlaying, isFav, downloadState,
  onPlay, onToggleFavorite, onQueueLast, onRemove, removeLabel, onDownload, showDownload
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const busy = downloadState?.active;

  return (
    <div className="res-row" onClick={onPlay} style={{ position: 'relative', zIndex: menuOpen ? 20 : 1 }}>
      <span className="res-row__index">
        {isCurrent ? <PlayingIndicator playing={isAudioPlaying} /> : index + 1}
      </span>

      {track.artwork ? (
        <img src={track.artwork} alt="" className="res-row__art" />
      ) : (
        <TrackArtPlaceholder size={40} radius={6} />
      )}

      <span className="res-row__meta">
        <span className={`truncate res-row__title${isCurrent ? ' is-current' : ''}`}>
          {track.title}
          {track.isFixed && !track.isLocalFile && <Check size={12} style={{ marginLeft: 6, color: 'var(--accent-color)' }} />}
        </span>
        <span className="truncate res-row__artist">{track.artist || '—'}</span>
      </span>

      {formatStreamCount(track.playbackCount) != null && (
        <span className="res-row__plays">{formatStreamCount(track.playbackCount)}</span>
      )}

      <span className="res-row__actions row-reveal">
        {showDownload && !track.isFixed && !track.isLocalFile && (
          <button
            type="button"
            className="btn-icon"
            title="Garder une copie locale"
            disabled={busy}
            onClick={(e) => { e.stopPropagation(); onDownload?.(track); }}
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
          </button>
        )}
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
        {onToggleFavorite && (
          <button
            type="button"
            className={`btn-icon${isFav ? ' is-active' : ''}`}
            title={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(track, e); }}
          >
            <Heart size={16} fill={isFav ? 'currentColor' : 'none'} />
          </button>
        )}
        {onRemove && (
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="btn-icon"
              title="Plus d'options"
              onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
            >
              <MoreVertical size={16} />
            </button>
            {menuOpen && (
              <div className="row-menu toast-in" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => { onRemove(track); setMenuOpen(false); }}
                  style={{ color: 'var(--danger-color)' }}
                >
                  <Trash2 size={15} /> {removeLabel || 'Retirer'}
                </button>
              </div>
            )}
          </div>
        )}
      </span>

      <span className="res-row__time">{formatDuration(track.duration)}</span>
    </div>
  );
}

/**
 * Page de collection (favoris, playlist, téléchargements, fichiers locaux).
 * Même densité et même langage visuel que les résultats de recherche.
 */
export default function CollectionView({
  kicker = 'Collection',
  title,
  description,
  icon,
  tint = 'linear-gradient(140deg, #0a84ff, #5e5ce6)',
  tracks = [],
  onPlay,
  onShuffle,
  currentTrack,
  isAudioPlaying,
  favorites = [],
  toggleFavorite,
  onQueueLast,
  onRemoveTrack,
  removeLabel,
  onDownload,
  downloadStates = {},
  showDownload = false,
  emptyTitle = 'Rien pour le moment',
  emptyHint,
  headerExtra,
  actions
}) {
  const [filter, setFilter] = useState('');

  const favIds = useMemo(() => new Set(favorites.map((f) => String(f.id))), [favorites]);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return tracks;
    return tracks.filter(
      (t) =>
        (t.title || '').toLowerCase().includes(q) ||
        (t.artist || '').toLowerCase().includes(q)
    );
  }, [tracks, filter]);

  const durationLabel = totalDurationLabel(tracks);

  return (
    <div className="view-enter">
      <header className="coll-hero">
        <CollectionCover tracks={tracks} icon={icon} tint={tint} />

        <div className="coll-hero__meta">
          <span className="coll-hero__kicker">{kicker}</span>
          <h2 className="coll-hero__title">{title}</h2>
          {description && <p className="coll-hero__desc">{description}</p>}
          <p className="coll-hero__stats">
            {tracks.length} titre{tracks.length > 1 ? 's' : ''}
            {durationLabel ? ` · ${durationLabel}` : ''}
          </p>
          {headerExtra}
        </div>
      </header>

      <div className="coll-actions">
        <button
          type="button"
          className="coll-play"
          disabled={tracks.length === 0}
          onClick={() => tracks.length && onPlay(tracks[0], 0, tracks)}
          title="Lecture"
        >
          <Play size={22} fill="currentColor" style={{ marginLeft: '2px' }} />
        </button>
        <button
          type="button"
          className="btn-icon"
          disabled={tracks.length === 0}
          onClick={onShuffle}
          title="Lecture aléatoire"
        >
          <Shuffle size={20} />
        </button>
        {actions}

        <div className="coll-filter">
          <Search size={15} style={{ flexShrink: 0, color: 'var(--text-secondary)' }} />
          <input
            type="text"
            placeholder="Filtrer"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filtrer la liste"
          />
          {filter && (
            <button type="button" className="btn-icon" style={{ padding: '3px' }} onClick={() => setFilter('')}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {tracks.length === 0 ? (
        <div className="search-empty" style={{ height: '32vh' }}>
          <h3>{emptyTitle}</h3>
          {emptyHint && <p>{emptyHint}</p>}
        </div>
      ) : visible.length === 0 ? (
        <div className="search-empty" style={{ height: '24vh' }}>
          <p>Aucun titre ne correspond à «&nbsp;{filter}&nbsp;».</p>
        </div>
      ) : (
        <div className="res-list">
          {visible.map((track) => {
            const realIndex = tracks.indexOf(track);
            const entry = downloadStates?.[track.id];
            return (
              <Row
                key={track.id}
                track={track}
                index={realIndex}
                isCurrent={currentTrack?.id === track.id}
                isAudioPlaying={isAudioPlaying}
                isFav={favIds.has(String(track.id))}
                downloadState={{ active: !!entry && entry.stage !== 'done' && entry.stage !== 'error' }}
                onPlay={() => onPlay(track, realIndex, tracks)}
                onToggleFavorite={toggleFavorite}
                onQueueLast={onQueueLast}
                onRemove={onRemoveTrack}
                removeLabel={removeLabel}
                onDownload={onDownload}
                showDownload={showDownload}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
