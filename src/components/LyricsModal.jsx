import React, { useState, useEffect, useRef } from 'react';
import { X, Mic2, Loader2 } from 'lucide-react';

export default function LyricsModal({ track, currentTime, onClose }) {
  const [lyrics, setLyrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!track) return;
    setLoading(true);
    setError(null);
    setLyrics([]);

    // Clean track title for better matching
    let cleanTitle = track.title;
    cleanTitle = cleanTitle.replace(/\(feat\..*?\)/i, '');
    cleanTitle = cleanTitle.replace(/\[.*?\]/g, '');
    cleanTitle = cleanTitle.split('-')[0].trim();

    const fetchLyrics = async () => {
      try {
        const query = new URLSearchParams({
          q: `${cleanTitle} ${track.artist || ''}`.trim()
        });
        const res = await fetch(`https://lrclib.net/api/search?${query}`);
        if (!res.ok) throw new Error('Not found');
        const data = await res.json();
        
        if (data && data.length > 0) {
          // Find the best match with synced lyrics
          const bestMatch = data.find(d => d.syncedLyrics) || data[0];
          
          if (bestMatch.syncedLyrics) {
            // Parse LRC format
            const lines = bestMatch.syncedLyrics.split('\n');
            const parsed = lines.map(line => {
              const match = line.match(/^\[(\d{2}):(\d{2}\.\d{2})\](.*)/);
              if (match) {
                const minutes = parseInt(match[1], 10);
                const seconds = parseFloat(match[2]);
                const time = minutes * 60 + seconds;
                return { time, text: match[3].trim() };
              }
              return null;
            }).filter(Boolean);
            setLyrics(parsed);
          } else if (bestMatch.plainLyrics) {
            // Fallback to plain lyrics
            setLyrics([{ time: 0, text: bestMatch.plainLyrics }]);
          } else {
            setError('Aucune parole trouvée.');
          }
        } else {
          setError('Aucune parole trouvée.');
        }
      } catch (err) {
        console.error(err);
        setError('Paroles introuvables pour ce morceau.');
      } finally {
        setLoading(false);
      }
    };

    fetchLyrics();
  }, [track]);

  const currentActiveIndex = lyrics.reduce((acc, line, idx) => {
    return currentTime >= line.time ? idx : acc;
  }, -1);

  // Auto-scroll logic
  useEffect(() => {
    if (!containerRef.current || lyrics.length === 0 || currentActiveIndex === -1) return;
    
    // Select the wrapper that contains all the lines
    const lyricsWrapper = containerRef.current.querySelector('#lyrics-wrapper');
    if (!lyricsWrapper) return;
    
    const activeEl = lyricsWrapper.children[currentActiveIndex];
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentActiveIndex, lyrics]);

  return (
    <div 
      className="animate-fade-in"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: '90px', // above player
        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(40px)',
        zIndex: 50, display: 'flex', flexDirection: 'column',
        WebkitAppRegion: 'no-drag'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 30px' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Mic2 color="var(--accent-color)" />
          Paroles en direct
        </h3>
        <button 
          onClick={onClose}
          style={{ 
            background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', 
            width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'white', transition: 'background 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
        >
          <X size={24} />
        </button>
      </div>

      <div 
        ref={containerRef}
        className="custom-scrollbar"
        style={{ flex: 1, overflowY: 'auto', padding: '0 10vw 60px', scrollBehavior: 'smooth', maskImage: 'linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)', WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)' }}
      >
        {loading ? (
          <div className="flex-center" style={{ height: '100%', flexDirection: 'column', gap: '16px' }}>
            <Loader2 size={40} className="animate-spin" color="var(--accent-color)" />
            <p style={{ color: 'var(--text-secondary)' }}>Recherche des paroles...</p>
          </div>
        ) : error ? (
          <div className="flex-center" style={{ height: '100%', color: 'var(--text-secondary)' }}>
            <p>{error}</p>
          </div>
        ) : lyrics.length === 1 && lyrics[0].time === 0 ? (
          // Plain lyrics
          <p style={{ whiteSpace: 'pre-wrap', fontSize: '1.5rem', lineHeight: 1.8, color: '#e4e4e7', textAlign: 'center', maxWidth: '800px', margin: '0 auto', paddingTop: '10vh' }}>
            {lyrics[0].text}
          </p>
        ) : (
          // Synced lyrics
          <div id="lyrics-wrapper" style={{ maxWidth: '800px', margin: '0 auto', paddingTop: '40vh', paddingBottom: '40vh' }}>
            {lyrics.map((line, idx) => {
              const isActive = idx === currentActiveIndex;
              const isPast = idx < currentActiveIndex;
              return (
                <div 
                  key={idx}
                  style={{
                    fontSize: isActive ? '3rem' : '2.2rem',
                    fontWeight: 800,
                    lineHeight: 1.4,
                    margin: '30px 0',
                    color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.4)',
                    transition: 'all 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)',
                    transform: isActive ? 'scale(1.02)' : 'scale(1)',
                    transformOrigin: 'left center',
                    filter: isActive ? 'blur(0px)' : 'blur(2px)',
                    opacity: isPast ? 0.3 : 1
                  }}
                >
                  {line.text || '♪'}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
