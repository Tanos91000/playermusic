import { HardDrive, Play, Trash2 } from 'lucide-react';

function formatBytes(bytes) {
  if (!bytes) return '0 o';
  const units = ['o', 'Ko', 'Mo', 'Go'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDuration(ms) {
  if (!ms) return '--:--';
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function DownloadsView({ library, currentTrack, onPlay, onDelete }) {
  const tracks = library?.tracks || [];
  const totalBytes = library?.totalBytes || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingBottom: '120px' }}>
      <div className="glass" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <HardDrive size={22} color="var(--accent-color)" />
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Téléchargés</h3>
            <p className="truncate" style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              {tracks.length} son{tracks.length > 1 ? 's' : ''} · {formatBytes(totalBytes)}
            </p>
          </div>
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'right', maxWidth: '45%' }} className="truncate">
          {library?.downloadsDir || ''}
        </div>
      </div>

      {tracks.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '40px' }}>
          <p>Aucun son téléchargé.</p>
        </div>
      ) : (
        tracks.map((track, index) => {
          const isPlaying = currentTrack?.id === track.id;

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
                backgroundColor: isPlaying ? 'var(--surface-hover)' : 'var(--surface-color)',
                borderColor: isPlaying ? 'var(--accent-color)' : 'var(--border-color)',
                animationDelay: `${index * 0.05}s`
              }}
              onMouseEnter={(e) => {
                if (!isPlaying) e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
              }}
              onMouseLeave={(e) => {
                if (!isPlaying) e.currentTarget.style.backgroundColor = 'var(--surface-color)';
              }}
            >
              <div style={{ width: '40px', color: isPlaying ? 'var(--accent-color)' : 'var(--text-secondary)' }}>
                {isPlaying ? <Play size={20} fill="currentColor" /> : index + 1}
              </div>

              {track.artwork ? (
                <img src={track.artwork} alt="cover" style={{ width: '48px', height: '48px', borderRadius: '4px', objectFit: 'cover', marginRight: '15px' }} />
              ) : (
                <div style={{ width: '48px', height: '48px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.1)', marginRight: '15px' }} />
              )}

              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <h4 className="truncate" style={{ margin: 0, fontSize: '1rem', fontWeight: isPlaying ? 600 : 500, color: isPlaying ? 'var(--accent-color)' : 'var(--text-primary)' }}>
                  {track.title}
                </h4>
                <p className="truncate" style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {track.artist}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: '16px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', minWidth: '58px', textAlign: 'right' }}>
                  {formatBytes(track.sizeBytes)}
                </span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', width: '50px', textAlign: 'right' }}>
                  {formatDuration(track.duration)}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(track);
                  }}
                  title="Supprimer"
                  style={{ background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center' }}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
