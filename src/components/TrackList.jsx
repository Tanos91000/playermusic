import { Heart, AlertCircle, Download, Check, Loader2 } from 'lucide-react';
import { useState } from 'react';
import PlayingIndicator from './PlayingIndicator';
import { TrackArtPlaceholder } from './MediaPlaceholder';
import { resolveArtistPermalinkUrl } from '../utils/soundcloudArtist';
import { formatStreamCount } from '../utils/formatPlayback';

export default function TrackList({ tracks, onPlay, currentTrack, isAudioPlaying = false, favorites, toggleFavorite, onTrackDownloaded, onOpenArtist }) {
  const [downloadingIds, setDownloadingIds] = useState(new Set());

  if (!tracks || tracks.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '40px' }}>
        <p>Aucune piste trouvée.</p>
      </div>
    );
  }

  const handleDownload = async (e, track) => {
    e.stopPropagation();
    if (downloadingIds.has(track.id)) return;

    setDownloadingIds(prev => new Set(prev).add(track.id));
    try {
      const res = await window.electronAPI.downloadTrack(track);
      if (res?.success && res.localPath) {
        track.unavailable = false;
        track.isFixed = true;
        track.localPath = res.localPath;
        if (onTrackDownloaded) onTrackDownloaded(track, res);
      } else if (res?.success === false) {
        const detail = res.error || 'Erreur inconnue';
        alert(`Erreur lors du téléchargement :\n${String(detail).slice(0, 1200)}`);
      } else {
        alert('Réponse inattendue du téléchargement. Réessaie ou ouvre la console (DevTools).');
      }
    } catch (err) {
      console.error('Failed to download track:', err);
      const detail = err?.message || String(err);
      alert(
        detail
          ? `Erreur lors du téléchargement :\n${String(detail).slice(0, 400)}`
          : 'Erreur lors du téléchargement. Réessaie plus tard.'
      );
    } finally {
      setDownloadingIds(prev => {
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
  const downloadBtnStyle = (isUnavailable, isDownloading, accentUnavailable) => ({
    background: isDownloading ? 'rgba(255,255,255,0.06)' : accentUnavailable ? 'var(--accent-color)' : 'rgba(255,255,255,0.1)',
    color: 'white',
    border: 'none',
    borderRadius: '22px',
    padding: '8px 20px',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: isDownloading ? 'default' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    ...(isUnavailable ? { minWidth: '160px' } : {}),
    justifyContent: 'center',
    transition: 'opacity 0.2s, transform 0.15s'
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '100px' }}>
      {tracks.map((track, index) => {
        const isCurrentTrack = currentTrack?.id === track.id;
        const isFav = (favorites || []).find(f => f.id === track.id);
        const isUnavailable = track.unavailable;
        const isDownloading = downloadingIds.has(track.id);
        const isFixed = track.isFixed;
        const canOpenArtist = typeof onOpenArtist === 'function' && !!resolveArtistPermalinkUrl(track);

        if (isUnavailable) {
          return (
            <div
              key={track.id}
              className="glass animate-fade-in"
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '12px 20px',
                cursor: 'default',
                backgroundColor: 'rgba(120, 120, 130, 0.06)',
                borderColor: 'rgba(255, 255, 255, 0.06)',
                opacity: isDownloading ? 0.88 : 0.72,
                animationDelay: `${index * 0.05}s`
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', display: 'flex', justifyContent: 'center', color: '#71717a' }}>
                  {isDownloading ? (
                    <Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent-color)' }} />
                  ) : (
                    <AlertCircle size={20} style={{ color: '#71717a' }} />
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
                      filter: 'grayscale(1) brightness(0.75)',
                      opacity: 0.85
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
                  <h4 className="truncate" style={{ margin: 0, fontSize: '1rem', fontWeight: 500, color: '#a1a1aa' }}>
                    {track.title}
                  </h4>
                  <p className="truncate" style={{ margin: 0, fontSize: '0.85rem', color: '#71717a' }}>
                    {onOpenArtist && canOpenArtist ? (
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
                  <span style={{ fontSize: '0.72rem', color: '#52525b', marginTop: '4px', display: 'inline-block' }}>
                    Non disponible sur SoundCloud — récupère une copie locale
                  </span>
                </div>
                <div style={{ flexShrink: 0, textAlign: 'right', minWidth: '76px' }}>
                  <div style={{ color: '#52525b', fontSize: '0.85rem', fontVariantNumeric: 'tabular-nums' }}>
                    {formatDuration(track.duration)}
                  </div>
                  {streamLabel(track.playbackCount) != null ? (
                    <div style={{ fontSize: '0.72rem', color: '#71717a', marginTop: '3px' }} title="Lectures SoundCloud">
                      {streamLabel(track.playbackCount)}
                    </div>
                  ) : null}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  paddingTop: '14px',
                  paddingBottom: '4px'
                }}
              >
                <button
                  type="button"
                  onClick={(e) => handleDownload(e, track)}
                  disabled={isDownloading}
                  title="Télécharger via une source alternative"
                  style={downloadBtnStyle(true, isDownloading, true)}
                >
                  {isDownloading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Téléchargement…
                    </>
                  ) : (
                    <>
                      <Download size={16} />
                      Récupérer le son
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        }

        return (
          <div
            key={track.id}
            onClick={() => onPlay(track, index)}
            className="glass animate-fade-in"
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '12px 20px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              backgroundColor: isCurrentTrack ? 'var(--surface-hover)' : 'var(--surface-color)',
              borderColor: isCurrentTrack ? 'var(--accent-color)' : 'var(--border-color)',
              animationDelay: `${index * 0.05}s`
            }}
            onMouseEnter={(e) => {
              if (!isCurrentTrack) e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
            }}
            onMouseLeave={(e) => {
              if (!isCurrentTrack) e.currentTarget.style.backgroundColor = 'var(--surface-color)';
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
                {isFixed && <Check size={14} color="var(--accent-color)" />}
              </div>
              <p className="truncate" style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {onOpenArtist && canOpenArtist ? (
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {!isFixed && (
                <button
                  type="button"
                  onClick={(e) => handleDownload(e, track)}
                  disabled={isDownloading}
                  title="Télécharger localement"
                  style={downloadBtnStyle(false, isDownloading, false)}
                >
                  {isDownloading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      …
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
                onClick={(e) => toggleFavorite(track, e)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: isFav ? 'var(--accent-color)' : 'var(--text-secondary)',
                  transition: 'transform 0.1s'
                }}
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
            </div>
          </div>
        );
      })}
    </div>
  );
}
