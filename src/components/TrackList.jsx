import { Heart, AlertCircle, Download, Check, Loader2, MoreVertical, ListPlus, CornerDownRight, User, Trash2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import PlayingIndicator from './PlayingIndicator';
import { TrackArtPlaceholder } from './MediaPlaceholder';
import { resolveArtistPermalinkUrl } from '../utils/soundcloudArtist';
import { formatStreamCount } from '../utils/formatPlayback';

export default function TrackList({
  tracks,
  onPlay,
  currentTrack,
  isAudioPlaying = false,
  favorites,
  toggleFavorite,
  onTrackDownloaded,
  onOpenArtist,
  playlists = [],
  onAddToPlaylist,
  downloadStates = {},
  onDownload,
  onQueueNext,
  onQueueLast,
  onRemoveTrack,
  removeTrackLabel = 'Retirer de la liste'
}) {
  const [fallbackDownloadingIds, setFallbackDownloadingIds] = useState(new Set());
  const [menuOpenId, setMenuOpenId] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!tracks || tracks.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '40px' }}>
        <p>Aucune piste trouvée.</p>
      </div>
    );
  }

  /**
   * Le gestionnaire partagé (progression + notifications) est utilisé dès qu'il
   * est fourni ; sinon on retombe sur un appel IPC direct.
   */
  const handleDownload = async (e, track) => {
    e.stopPropagation();

    if (typeof onDownload === 'function') {
      onDownload(track);
      return;
    }

    if (fallbackDownloadingIds.has(track.id)) return;
    setFallbackDownloadingIds(prev => new Set(prev).add(track.id));
    try {
      const res = await window.electronAPI.downloadTrack(track);
      if (res?.success && res.localPath) {
        onTrackDownloaded?.(track, res);
      } else {
        alert(`Erreur lors du téléchargement :\n${String(res?.error || 'Erreur inconnue').slice(0, 1200)}`);
      }
    } catch (err) {
      console.error('Failed to download track:', err);
      alert(`Erreur lors du téléchargement :\n${String(err?.message || err).slice(0, 400)}`);
    } finally {
      setFallbackDownloadingIds(prev => {
        const next = new Set(prev);
        next.delete(track.id);
        return next;
      });
    }
  };

  const formatDuration = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
  };

  const streamLabel = (playbackCount) => {
    const s = formatStreamCount(playbackCount);
    return s == null ? null : `${s} lectures`;
  };

  const downloadState = (track) => {
    const entry = downloadStates?.[track.id];
    const active = !!entry && entry.stage !== 'done' && entry.stage !== 'error';
    return {
      active: active || fallbackDownloadingIds.has(track.id),
      percent: typeof entry?.percent === 'number' ? Math.round(entry.percent) : null,
      failed: entry?.stage === 'error'
    };
  };

  const renderMenu = (track) => {
    const canQueue = typeof onQueueNext === 'function' || typeof onQueueLast === 'function';
    const canOpenArtist = typeof onOpenArtist === 'function' && !!resolveArtistPermalinkUrl(track);
    const canRemove = typeof onRemoveTrack === 'function';
    if (!canQueue && playlists.length === 0 && !canOpenArtist && !canRemove) return null;

    const itemStyle = {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      width: '100%',
      textAlign: 'left',
      background: 'none',
      border: 'none',
      color: 'var(--text-primary)',
      padding: '8px',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '0.88rem',
      transition: 'background var(--dur-fast) var(--ease-out)'
    };
    const hoverOn = (e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; };
    const hoverOff = (e) => { e.currentTarget.style.background = 'none'; };

    return (
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          className={`btn-icon row-reveal${menuOpenId === track.id ? ' row-reveal--pinned' : ''}`}
          title="Plus d'options"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpenId(menuOpenId === track.id ? null : track.id);
          }}
        >
          <MoreVertical size={20} />
        </button>

        {menuOpenId === track.id && (
          <div
            ref={menuRef}
            className="glass toast-in"
            style={{
              position: 'absolute', right: 0, top: '100%', marginTop: '8px', zIndex: 50,
              background: 'rgba(24, 24, 30, 0.97)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 'var(--radius-md)', padding: '8px', minWidth: '210px',
              boxShadow: '0 16px 40px rgba(0,0,0,0.55)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {typeof onQueueNext === 'function' && (
              <button
                type="button"
                style={itemStyle}
                onMouseOver={hoverOn}
                onMouseOut={hoverOff}
                onClick={() => { onQueueNext(track); setMenuOpenId(null); }}
              >
                <CornerDownRight size={16} /> Lire ensuite
              </button>
            )}
            {typeof onQueueLast === 'function' && (
              <button
                type="button"
                style={itemStyle}
                onMouseOver={hoverOn}
                onMouseOut={hoverOff}
                onClick={() => { onQueueLast(track); setMenuOpenId(null); }}
              >
                <ListPlus size={16} /> Ajouter à la file
              </button>
            )}
            {canOpenArtist && (
              <button
                type="button"
                style={itemStyle}
                onMouseOver={hoverOn}
                onMouseOut={hoverOff}
                onClick={() => { onOpenArtist(track); setMenuOpenId(null); }}
              >
                <User size={16} /> Voir l&apos;artiste
              </button>
            )}
            {canRemove && (
              <button
                type="button"
                style={{ ...itemStyle, color: 'var(--danger-color)' }}
                onMouseOver={hoverOn}
                onMouseOut={hoverOff}
                onClick={() => { onRemoveTrack(track); setMenuOpenId(null); }}
              >
                <Trash2 size={16} /> {removeTrackLabel}
              </button>
            )}
            {playlists.length > 0 && (
              <>
                <div
                  style={{
                    fontSize: '0.74rem', color: 'var(--text-secondary)', padding: '8px 8px 4px',
                    marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.1)'
                  }}
                >
                  Ajouter à une playlist
                </div>
                {playlists.map(pl => (
                  <button
                    key={pl.id}
                    type="button"
                    style={itemStyle}
                    onMouseOver={hoverOn}
                    onMouseOut={hoverOff}
                    onClick={() => { onAddToPlaylist(pl.id, track); setMenuOpenId(null); }}
                  >
                    {pl.name}
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '100px' }}>
      {tracks.map((track, index) => {
        const isCurrentTrack = currentTrack?.id === track.id;
        const isFav = (favorites || []).find(f => f.id === track.id);
        const isUnavailable = track.unavailable;
        const { active: isDownloading, percent, failed } = downloadState(track);
        const isFixed = track.isFixed;
        const isLocalFile = !!track.isLocalFile;
        const canOpenArtist = typeof onOpenArtist === 'function' && !!resolveArtistPermalinkUrl(track);

        if (isUnavailable) {
          return (
            <div
              key={track.id}
              className="glass track-row animate-fade-in"
              onClick={() => !isDownloading && onPlay(track, index)}
              title="Cliquer pour récupérer automatiquement une copie lisible"
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '12px 20px',
                cursor: isDownloading ? 'progress' : 'pointer',
                backgroundColor: 'rgba(120, 120, 130, 0.06)',
                borderColor: 'rgba(255, 255, 255, 0.06)',
                opacity: isDownloading ? 0.95 : 0.78,
                animationDelay: `${index * 0.05}s`
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}>
                  {isDownloading ? (
                    <Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent-color)' }} />
                  ) : (
                    <AlertCircle size={20} style={{ color: failed ? 'var(--danger-color)' : 'var(--text-muted)' }} />
                  )}
                </div>
                {track.artwork ? (
                  <img
                    src={track.artwork}
                    alt=""
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '4px',
                      objectFit: 'cover',
                      filter: isDownloading ? 'none' : 'grayscale(1) brightness(0.75)',
                      opacity: 0.9,
                      transition: 'filter var(--dur-slow) var(--ease-out)'
                    }}
                  />
                ) : (
                  <TrackArtPlaceholder
                    size={48}
                    radius={4}
                    style={{
                      marginRight: '15px',
                      filter: 'grayscale(1) brightness(0.75)',
                      opacity: 0.85
                    }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 className="truncate" style={{ margin: 0, fontSize: '1rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                    {track.title}
                  </h4>
                  <p className="truncate" style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {canOpenArtist ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenArtist(track);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          color: 'inherit',
                          font: 'inherit'
                        }}
                      >
                        {track.artist}
                      </button>
                    ) : (
                      track.artist
                    )}
                  </p>
                  <span style={{ fontSize: '0.72rem', color: failed ? 'var(--danger-color)' : '#52525b', marginTop: '4px', display: 'inline-block' }}>
                    {isDownloading
                      ? `Récupération automatique${percent != null ? ` · ${percent}%` : '…'}`
                      : failed
                        ? 'La récupération a échoué — clique pour réessayer'
                        : 'Indisponible en streaming — clique pour récupérer le son'}
                  </span>
                </div>
                <div style={{ flexShrink: 0, textAlign: 'right', minWidth: '76px' }}>
                  <div style={{ color: '#52525b', fontSize: '0.85rem', fontVariantNumeric: 'tabular-nums' }}>
                    {formatDuration(track.duration)}
                  </div>
                  {streamLabel(track.playbackCount) != null ? (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }} title="Lectures SoundCloud">
                      {streamLabel(track.playbackCount)}
                    </div>
                  ) : null}
                </div>
                {renderMenu(track)}
              </div>

              {isDownloading && (
                <div
                  style={{
                    marginTop: '12px',
                    height: '4px',
                    borderRadius: 'var(--radius-pill)',
                    background: 'rgba(255,255,255,0.08)',
                    overflow: 'hidden'
                  }}
                >
                  <div
                    className={percent == null ? 'pulse-soft' : undefined}
                    style={{
                      height: '100%',
                      width: percent != null ? `${percent}%` : '40%',
                      background: 'var(--accent-color)',
                      borderRadius: 'inherit',
                      transition: 'width var(--dur-med) var(--ease-out)'
                    }}
                  />
                </div>
              )}
            </div>
          );
        }

        return (
          <div
            key={track.id}
            onClick={() => onPlay(track, index)}
            className="glass track-row animate-fade-in"
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '12px 20px',
              cursor: 'pointer',
              backgroundColor: isCurrentTrack ? 'var(--surface-hover)' : 'var(--surface-color)',
              borderColor: isCurrentTrack ? 'var(--accent-color)' : 'var(--border-color)',
              animationDelay: `${index * 0.05}s`,
              overflow: 'visible',
              position: 'relative',
              zIndex: menuOpenId === track.id ? 50 : 1
            }}
          >
            <div
              style={{
                width: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-color)'
              }}
            >
              {isCurrentTrack ? (
                <PlayingIndicator playing={isAudioPlaying} />
              ) : (
                <span style={{ color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{index + 1}</span>
              )}
            </div>

            {track.artwork ? (
              <img
                src={track.artwork}
                alt=""
                style={{ width: '48px', height: '48px', borderRadius: '4px', objectFit: 'cover', marginRight: '15px' }}
              />
            ) : (
              <TrackArtPlaceholder size={48} radius={4} style={{ marginRight: '15px' }} />
            )}

            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h4
                  className="truncate"
                  style={{
                    margin: 0,
                    fontSize: '1rem',
                    fontWeight: isCurrentTrack ? 600 : 500,
                    color: isCurrentTrack ? 'var(--accent-color)' : 'var(--text-primary)'
                  }}
                >
                  {track.title}
                </h4>
                {isFixed && !isLocalFile && <Check size={14} color="var(--accent-color)" />}
              </div>
              <p className="truncate" style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {canOpenArtist ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenArtist(track);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      color: 'var(--text-secondary)',
                      font: 'inherit',
                      textAlign: 'left',
                      maxWidth: '100%'
                    }}
                    className="truncate"
                  >
                    {track.artist}
                  </button>
                ) : (
                  track.artist
                )}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {!isFixed && !isLocalFile && (
                <button
                  type="button"
                  className="btn-pill row-reveal"
                  onClick={(e) => handleDownload(e, track)}
                  disabled={isDownloading}
                  title="Garder une copie locale"
                  style={{ padding: '7px 14px', fontSize: '0.78rem' }}
                >
                  {isDownloading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      {percent != null ? `${percent}%` : '…'}
                    </>
                  ) : (
                    <>
                      <Download size={14} /> Download
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                className={`btn-icon${isFav ? ' is-active' : ''}`}
                onClick={(e) => toggleFavorite(track, e)}
                title={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              >
                <Heart size={20} fill={isFav ? 'currentColor' : 'none'} />
              </button>

              <div style={{ flexShrink: 0, textAlign: 'right', minWidth: '76px' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontVariantNumeric: 'tabular-nums' }}>
                  {formatDuration(track.duration)}
                </div>
                {streamLabel(track.playbackCount) != null ? (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '3px', opacity: 0.92 }} title="Lectures SoundCloud">
                    {streamLabel(track.playbackCount)}
                  </div>
                ) : null}
              </div>

              {renderMenu(track)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
