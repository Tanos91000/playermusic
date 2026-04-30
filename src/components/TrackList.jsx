import { Play, Heart, AlertCircle, Download, Check, Loader2 } from 'lucide-react';
import { useState } from 'react';

export default function TrackList({ tracks, onPlay, currentTrack, favorites, toggleFavorite }) {
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
      if (res.success) {
        // We notify the parent that data has changed (simplest is to just re-search or refresh)
        // But for better UX we just update the local object for now
        track.unavailable = false;
        track.isFixed = true;
        track.localPath = res.localPath;
      }
    } catch (err) {
      console.error('Failed to download track:', err);
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
    return minutes + ":" + (seconds < 10 ? '0' : '') + seconds;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '100px' }}>
      {tracks.map((track, index) => {
        const isPlaying = currentTrack?.id === track.id;
        const isFav = (favorites || []).find(f => f.id === track.id);
        const isUnavailable = track.unavailable;
        const isDownloading = downloadingIds.has(track.id);
        
        return (
          <div 
            key={track.id}
            onClick={() => !isUnavailable && onPlay(track, index)}
            className="glass animate-fade-in"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              padding: '12px 20px', 
              cursor: isUnavailable ? 'default' : 'pointer',
              transition: 'all 0.2s ease',
              backgroundColor: isPlaying ? 'var(--surface-hover)' : 'var(--surface-color)',
              borderColor: isPlaying ? 'var(--accent-color)' : (isUnavailable ? '#ff4d4d33' : 'var(--border-color)'),
              opacity: isUnavailable && !isDownloading ? 0.5 : 1,
              animationDelay: `${index * 0.05}s`
            }}
            onMouseEnter={(e) => {
              if (!isPlaying && !isUnavailable) e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
            }}
            onMouseLeave={(e) => {
              if (!isPlaying && !isUnavailable) e.currentTarget.style.backgroundColor = 'var(--surface-color)';
            }}
          >
            <div style={{ width: '40px', color: isPlaying ? 'var(--accent-color)' : 'var(--text-secondary)' }}>
              {isUnavailable ? (
                isDownloading ? <Loader2 size={20} className="animate-spin" color="var(--accent-color)" /> : <AlertCircle size={20} color="#ff4d4d" />
              ) : (isPlaying ? <Play size={20} fill="currentColor" /> : index + 1)}
            </div>
            
            {track.artwork ? (
              <img src={track.artwork} alt="cover" style={{ width: '48px', height: '48px', borderRadius: '4px', objectFit: 'cover', marginRight: '15px', filter: isUnavailable ? 'grayscale(100%)' : 'none' }} />
            ) : (
              <div style={{ width: '48px', height: '48px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.1)', marginRight: '15px' }}></div>
            )}
            
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h4 className="truncate" style={{ margin: 0, fontSize: '1rem', fontWeight: isPlaying ? 600 : 500, color: isPlaying ? 'var(--accent-color)' : (isUnavailable ? '#ff4d4d' : 'var(--text-primary)') }}>
                  {track.title}
                </h4>
                {track.isFixed && <Check size={14} color="var(--accent-color)" />}
                {isUnavailable && !isDownloading && <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#ff4d4d' }}>(Non disponible)</span>}
              </div>
              <p className="truncate" style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {track.artist}
              </p>
            </div>
            
            {isUnavailable ? (
              <button 
                onClick={(e) => handleDownload(e, track)}
                disabled={isDownloading}
                style={{ 
                  background: isDownloading ? 'transparent' : 'var(--accent-color)', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '20px', 
                  padding: '5px 12px', 
                  fontSize: '0.75rem', 
                  fontWeight: 600, 
                  cursor: isDownloading ? 'default' : 'pointer',
                  marginRight: '15px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                {isDownloading ? 'Récupération...' : <><Download size={14} /> Récupérer</>}
              </button>
            ) : (
              <button 
                onClick={(e) => toggleFavorite(track, e)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: isFav ? 'var(--accent-color)' : 'var(--text-secondary)', marginRight: '20px', transition: 'transform 0.1s' }}
              >
                <Heart size={20} fill={isFav ? "currentColor" : "none"} />
              </button>
            )}

            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              {formatDuration(track.duration)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
