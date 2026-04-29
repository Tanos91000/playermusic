import { Play, Heart, AlertCircle } from 'lucide-react';

export default function TrackList({ tracks, onPlay, currentTrack, favorites, toggleFavorite }) {
  if (!tracks || tracks.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '40px' }}>
        <p>Aucune piste trouvée.</p>
      </div>
    );
  }

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
        
        return (
          <div 
            key={track.id}
            onClick={() => !isUnavailable && onPlay(track, index)}
            className="glass animate-fade-in"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              padding: '12px 20px', 
              cursor: isUnavailable ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              backgroundColor: isPlaying ? 'var(--surface-hover)' : 'var(--surface-color)',
              borderColor: isPlaying ? 'var(--accent-color)' : (isUnavailable ? '#ff4d4d33' : 'var(--border-color)'),
              opacity: isUnavailable ? 0.5 : 1,
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
              {isUnavailable ? <AlertCircle size={20} color="#ff4d4d" /> : (isPlaying ? <Play size={20} fill="currentColor" /> : index + 1)}
            </div>
            
            {track.artwork ? (
              <img src={track.artwork} alt="cover" style={{ width: '48px', height: '48px', borderRadius: '4px', objectFit: 'cover', marginRight: '15px', filter: isUnavailable ? 'grayscale(100%)' : 'none' }} />
            ) : (
              <div style={{ width: '48px', height: '48px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.1)', marginRight: '15px' }}></div>
            )}
            
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <h4 className="truncate" style={{ margin: 0, fontSize: '1rem', fontWeight: isPlaying ? 600 : 500, color: isPlaying ? 'var(--accent-color)' : (isUnavailable ? '#ff4d4d' : 'var(--text-primary)') }}>
                {track.title} {isUnavailable && <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#ff4d4d', marginLeft: '8px' }}>(Non disponible)</span>}
              </h4>
              <p className="truncate" style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {track.artist}
              </p>
            </div>
            
            {!isUnavailable && (
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
