import { useMemo } from 'react';
import { Play } from 'lucide-react';
import PlayingIndicator from './PlayingIndicator';
import { TrackArtPlaceholder } from './MediaPlaceholder';
import { formatStreamCount } from '../utils/formatPlayback';

function formatDuration(ms) {
  if (ms == null || Number.isNaN(ms)) return '';
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

function HorizontalRow({ title, subtitle, children }) {
  return (
    <section style={{ marginBottom: '40px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>{title}</h2>
        {subtitle && (
          <p style={{ margin: '6px 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{subtitle}</p>
        )}
      </div>
      <div
        className="custom-scrollbar"
        style={{
          display: 'flex',
          gap: '24px',
          overflowX: 'auto',
          paddingBottom: '16px',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {children}
      </div>
    </section>
  );
}

function QuickPlayCard({ track, index, list, onPlay, currentTrack, isAudioPlaying }) {
  const isCurrent = currentTrack?.id === track.id;

  return (
    <button
      type="button"
      onClick={() => onPlay(track, index, list)}
      className="glass animate-fade-in quick-play-btn"
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: 0,
        borderRadius: '8px',
        border: 'none',
        background: isCurrent ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.2s, transform 0.1s',
        height: '64px',
        overflow: 'hidden',
        position: 'relative'
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
      onMouseLeave={(e) => e.currentTarget.style.background = isCurrent ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)'}
    >
      <div style={{ width: '64px', height: '64px', flexShrink: 0, position: 'relative', boxShadow: '2px 0 10px rgba(0,0,0,0.2)' }}>
        {track.artwork ? (
          <img
            src={track.artwork.includes('large') ? track.artwork.replace('large', 't300x300') : track.artwork}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <TrackArtPlaceholder
            size={64}
            radius={0}
            style={{ width: '100%', height: '100%' }}
          />
        )}
        {isCurrent && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}>
            <PlayingIndicator playing={isAudioPlaying} />
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0, padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 700, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isCurrent ? 'var(--accent-color)' : 'var(--text-primary)' }}>
          {track.title}
        </div>
        <div 
          className="quick-play-icon"
          style={{ 
            width: '40px', 
            height: '40px', 
            borderRadius: '50%', 
            background: 'var(--accent-color)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            opacity: 0,
            transition: 'opacity 0.2s',
            marginLeft: '10px'
          }}
        >
           <Play fill="#fff" color="#fff" size={20} style={{ marginLeft: '2px' }} />
        </div>
      </div>
      <style>{`
        .quick-play-btn:hover .quick-play-icon {
          opacity: 1 !important;
        }
      `}</style>
    </button>
  );
}

function TrackCard({
  track,
  index,
  list,
  onPlay,
  currentTrack,
  isAudioPlaying,
  compact
}) {
  const isCurrent = currentTrack?.id === track.id;
  const w = compact ? 160 : 180;

  return (
    <button
      type="button"
      onClick={() => onPlay(track, index, list)}
      className="glass animate-fade-in"
      style={{
        flex: '0 0 auto',
        width: w,
        padding: '16px',
        borderRadius: '12px',
        border: 'none',
        background: isCurrent ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
        cursor: 'pointer',
        textAlign: 'left',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        transition: 'background 0.2s',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
      onMouseLeave={(e) => e.currentTarget.style.background = isCurrent ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)'}
    >
      <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', width: '100%', aspectRatio: '1 / 1', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
        {track.artwork ? (
          <img
            src={track.artwork.includes('large') ? track.artwork.replace('large', 't300x300') : track.artwork}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <TrackArtPlaceholder
            size={w}
            radius={8}
            style={{ width: '100%', height: '100%', borderRadius: '8px' }}
          />
        )}
        {isCurrent && (
          <div style={{ position: 'absolute', bottom: '12px', right: '12px', background: 'rgba(0,0,0,0.6)', padding: '6px', borderRadius: '50%', backdropFilter: 'blur(4px)' }}>
            <PlayingIndicator playing={isAudioPlaying} />
          </div>
        )}
      </div>
      <div style={{ minWidth: 0, width: '100%' }}>
        <div style={{ fontWeight: 700, fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '4px', color: isCurrent ? 'var(--accent-color)' : 'var(--text-primary)' }}>
          {track.title}
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {track.artist || '—'}
        </div>
        {track.duration != null && !compact && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{formatDuration(track.duration)}</span>
            {formatStreamCount(track.playbackCount) != null && (
              <>
                <span style={{ opacity: 0.5 }}>•</span>
                <span title="Lectures SoundCloud">
                  {formatStreamCount(track.playbackCount)}
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

export default function HomeView({
  greeting,
  recentTracks,
  favorites,
  downloadTracks,
  currentTrack,
  isAudioPlaying,
  onPlay,
  onNavigateSearch,
  onNavigateFavorites,
  onNavigateDownloads,
  onNavigateLocal
}) {
  const favSlice = (favorites || []).slice(0, 12);
  const dlSlice = (downloadTracks || []).slice(0, 12);
  
  // Combine recents and favorites for the top grid, ensuring no duplicates
  const quickPlayList = [];
  const quickPlayIds = new Set();
  
  if (recentTracks) {
    for (const t of recentTracks) {
      if (quickPlayList.length >= 6) break;
      if (!quickPlayIds.has(t.id)) {
        quickPlayList.push(t);
        quickPlayIds.add(t.id);
      }
    }
  }
  if (favorites) {
    for (const t of favorites) {
      if (quickPlayList.length >= 6) break;
      if (!quickPlayIds.has(t.id)) {
        quickPlayList.push(t);
        quickPlayIds.add(t.id);
      }
    }
  }

  const recommendedList = useMemo(() => {
    const list = [];
    const pool = [...(favorites || []), ...(recentTracks || [])];
    const shuffled = pool.sort(() => 0.5 - Math.random());
    const seen = new Set(quickPlayIds);
    for (const t of shuffled) {
      if (list.length >= 12) break;
      if (!seen.has(t.id)) {
        list.push(t);
        seen.add(t.id);
      }
    }
    return list;
  }, [favorites, recentTracks]); // re-shuffle when favorites or recents update

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: '0', letterSpacing: '-0.03em' }}>{greeting}</h2>
        </div>
      </div>

      {quickPlayList.length > 0 && (
        <div 
          style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', 
            gap: '12px',
            marginBottom: '48px'
          }}
        >
          {quickPlayList.map((track, index) => (
            <QuickPlayCard
              key={track.id}
              track={track}
              index={index}
              list={quickPlayList}
              onPlay={onPlay}
              currentTrack={currentTrack}
              isAudioPlaying={isAudioPlaying}
            />
          ))}
        </div>
      )}

      {recommendedList.length > 0 && (
        <HorizontalRow title="Recommandé pour vous" subtitle="Basé sur ce que tu écoutes">
          {recommendedList.map((track, index) => (
            <TrackCard
              key={track.id}
              track={track}
              index={index}
              list={recommendedList}
              onPlay={onPlay}
              currentTrack={currentTrack}
              isAudioPlaying={isAudioPlaying}
            />
          ))}
        </HorizontalRow>
      )}

      {recentTracks?.length > 0 && (
        <HorizontalRow title="Récemment écouté">
          {recentTracks.map((track, index) => (
            <TrackCard
              key={track.id}
              track={track}
              index={index}
              list={recentTracks}
              onPlay={onPlay}
              currentTrack={currentTrack}
              isAudioPlaying={isAudioPlaying}
              compact
            />
          ))}
        </HorizontalRow>
      )}

      {favSlice.length > 0 && (
        <HorizontalRow title="Tes favoris">
          {favSlice.map((track, index) => (
            <TrackCard
              key={track.id}
              track={track}
              index={index}
              list={favSlice}
              onPlay={onPlay}
              currentTrack={currentTrack}
              isAudioPlaying={isAudioPlaying}
              compact
            />
          ))}
        </HorizontalRow>
      )}

      {dlSlice.length > 0 && (
        <HorizontalRow title="Sur cet appareil">
          {dlSlice.map((track, index) => (
            <TrackCard
              key={track.id}
              track={track}
              index={index}
              list={dlSlice}
              onPlay={onPlay}
              currentTrack={currentTrack}
              isAudioPlaying={isAudioPlaying}
              compact
            />
          ))}
        </HorizontalRow>
      )}

      {!recentTracks?.length && !favSlice.length && !dlSlice.length && (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '48px 20px' }}>
          <p style={{ marginBottom: '16px' }}>Commence par l&apos;onglet Fichiers locaux, une recherche SoundCloud ou des favoris.</p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {typeof onNavigateLocal === 'function' && (
              <button
                type="button"
                onClick={onNavigateLocal}
                style={{
                  padding: '12px 28px',
                  borderRadius: '999px',
                  border: 'none',
                  background: 'rgba(255,255,255,0.12)',
                  color: 'var(--text-primary)',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Fichiers locaux
              </button>
            )}
            <button
              type="button"
              onClick={onNavigateSearch}
              style={{
                padding: '12px 28px',
                borderRadius: '999px',
                border: 'none',
                background: 'var(--accent-color)',
                color: '#fff',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Explorer SoundCloud
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
