import { useState, useEffect } from 'react';
import { Search, Heart, X, Minimize2, Settings as SettingsIcon } from 'lucide-react';
import Player from './components/Player';
import TrackList from './components/TrackList';
import Settings from './components/Settings';
import AnimatedBackground from './components/AnimatedBackground';

export default function App() {
  const [searchQuery, setSearchQuery] = useState('Drake');
  const [tracks, setTracks] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [activeTab, setActiveTab] = useState('search');
  const [eqBands, setEqBands] = useState([0, 0, 0, 0, 0]);
  const [reverb, setReverb] = useState(0);
  const [reverbEnabled, setReverbEnabled] = useState(false);
  const [djMode, setDjMode] = useState(false);
  const [updateStatus, setUpdateStatus] = useState(null); // 'available', 'downloaded', null

  useEffect(() => {
    if (window.electronAPI?.onUpdateAvailable) {
      window.electronAPI.onUpdateAvailable(() => setUpdateStatus('available'));
      window.electronAPI.onUpdateDownloaded(() => setUpdateStatus('downloaded'));
    }
  }, []);

  const [currentTrack, setCurrentTrack] = useState(null);
  const [playlistContext, setPlaylistContext] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  
  const [isMiniPlayer, setIsMiniPlayer] = useState(false);
  const [showLargeCover, setShowLargeCover] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('aura_favorites');
    if (saved) {
      try {
        setFavorites(JSON.parse(saved));
      } catch (e) { console.error('Failed to parse favorites'); }
    }
    const savedEq = localStorage.getItem('aura_eq_bands');
    if (savedEq) {
      try {
        setEqBands(JSON.parse(savedEq));
      } catch (e) {}
    }
    const savedReverb = localStorage.getItem('aura_reverb');
    if (savedReverb) setReverb(parseFloat(savedReverb));
    const savedReverbEn = localStorage.getItem('aura_reverb_en');
    if (savedReverbEn) setReverbEnabled(savedReverbEn === 'true');
    const savedDjMode = localStorage.getItem('aura_djmode');
    if (savedDjMode) setDjMode(savedDjMode === 'true');
    
    handleSearch();
  }, []);

  const handleEqChange = (bands) => {
    setEqBands(bands);
    localStorage.setItem('aura_eq_bands', JSON.stringify(bands));
  };

  const handleReverbChange = (val) => {
    setReverb(val);
    localStorage.setItem('aura_reverb', val);
  };

  const handleReverbEnabledChange = (val) => {
    setReverbEnabled(val);
    localStorage.setItem('aura_reverb_en', val);
  };

  const handleDjModeChange = (val) => {
    setDjMode(val);
    localStorage.setItem('aura_djmode', val);
  };

  const saveFavorites = (newFavs) => {
    setFavorites(newFavs);
    localStorage.setItem('aura_favorites', JSON.stringify(newFavs));
  };

  const toggleFavorite = (track, e) => {
    if (e) e.stopPropagation();
    const isFav = favorites.find(f => f.id === track.id);
    if (isFav) {
      saveFavorites(favorites.filter(f => f.id !== track.id));
    } else {
      saveFavorites([...favorites, track]);
    }
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    try {
      const data = await window.electronAPI.searchSoundCloud(searchQuery);
      if (Array.isArray(data)) {
        setTracks(data);
      } else {
        setTracks([]);
      }
    } catch (error) {
      setTracks([]);
    } finally {
      setIsLoading(false);
    }
  };

  const playTrack = (track, index, contextList) => {
    setCurrentTrack(track);
    setPlaylistContext(contextList);
    setCurrentIndex(index);
    if (!isMiniPlayer) setShowLargeCover(true);
  };

  const playNext = () => {
    if (currentIndex < playlistContext.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentTrack(playlistContext[nextIndex]);
      setCurrentIndex(nextIndex);
    }
  };

  const playPrev = () => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      setCurrentTrack(playlistContext[prevIndex]);
      setCurrentIndex(prevIndex);
    }
  };

  const handleStreamError = () => {
    console.error("Stream failed, skipping to next track...");
    playNext();
  };

  const [favoritesSearch, setFavoritesSearch] = useState('');

  const toggleMiniPlayer = () => {
    const newMini = !isMiniPlayer;
    setIsMiniPlayer(newMini);
    setShowLargeCover(false);
    if (newMini) {
      window.electronAPI.resizeWindow(350, 450, true);
    } else {
      window.electronAPI.resizeWindow(1200, 800, false);
    }
  };

  const currentList = activeTab === 'search' 
    ? tracks 
    : favorites.filter(t => {
        if (!favoritesSearch) return true;
        const search = favoritesSearch.toLowerCase();
        const titleMatch = t.title ? t.title.toLowerCase().includes(search) : false;
        const artistMatch = t.artist ? t.artist.toLowerCase().includes(search) : false;
        return titleMatch || artistMatch;
      });

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* Dynamic Background */}
      <AnimatedBackground imageUrl={currentTrack?.artwork} />

      {/* Main Full UI */}
      {!isMiniPlayer && (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px', height: '100vh', display: 'flex', flexDirection: 'column' }}>
          
          <header style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', WebkitAppRegion: 'drag' }}>
            <div>
              <h1 className="text-gradient" style={{ fontSize: '2.5rem', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>Aura Player</h1>
              <div style={{ display: 'flex', gap: '20px', marginTop: '15px', WebkitAppRegion: 'no-drag' }}>
                <button onClick={() => setActiveTab('search')} style={{ background: 'none', border: 'none', fontSize: '1.1rem', color: activeTab === 'search' ? 'var(--accent-color)' : 'var(--text-secondary)', fontWeight: activeTab === 'search' ? 600 : 400, cursor: 'pointer', transition: 'color 0.2s' }}>Recherche</button>
                <button onClick={() => setActiveTab('favorites')} style={{ background: 'none', border: 'none', fontSize: '1.1rem', color: activeTab === 'favorites' ? 'var(--accent-color)' : 'var(--text-secondary)', fontWeight: activeTab === 'favorites' ? 600 : 400, cursor: 'pointer', transition: 'color 0.2s' }}>Favoris</button>
                <button onClick={() => setActiveTab('settings')} style={{ background: 'none', border: 'none', fontSize: '1.1rem', color: activeTab === 'settings' ? 'var(--accent-color)' : 'var(--text-secondary)', fontWeight: activeTab === 'settings' ? 600 : 400, cursor: 'pointer', transition: 'color 0.2s', display: 'flex', alignItems: 'center', gap: '5px' }}><SettingsIcon size={16} /> Paramètres</button>
              </div>
            </div>
            
            <div style={{ WebkitAppRegion: 'no-drag' }}>
                {activeTab === 'search' && (
                  <form onSubmit={handleSearch} className="glass" style={{ display: 'flex', alignItems: 'center', padding: '10px 20px', width: '400px', borderRadius: '30px' }}>
                    <Search size={20} color="var(--text-secondary)" />
                    <input type="text" placeholder="Rechercher musiques, artistes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', width: '100%', marginLeft: '10px', fontSize: '1rem' }} />
                  </form>
                )}
                {activeTab === 'favorites' && (
                  <div className="glass" style={{ display: 'flex', alignItems: 'center', padding: '10px 20px', width: '400px', borderRadius: '30px' }}>
                    <Search size={20} color="var(--text-secondary)" />
                    <input type="text" placeholder="Rechercher dans les favoris..." value={favoritesSearch} onChange={(e) => setFavoritesSearch(e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', width: '100%', marginLeft: '10px', fontSize: '1rem' }} />
                  </div>
                )}
            </div>
          </header>

          {updateStatus && (
            <div className="glass" style={{ marginBottom: '20px', padding: '15px 20px', borderRadius: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
              <div>
                <span style={{ fontWeight: 'bold' }}>Mise à jour {updateStatus === 'downloaded' ? 'prête !' : 'disponible...'}</span>
                <span style={{ marginLeft: '10px', color: 'var(--text-secondary)' }}>
                  {updateStatus === 'downloaded' ? 'La nouvelle version est prête à être installée.' : 'Téléchargement en cours...'}
                </span>
              </div>
              {updateStatus === 'downloaded' && (
                <button 
                  onClick={() => window.electronAPI.restartApp()}
                  style={{ background: 'var(--accent-color)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Redémarrer
                </button>
              )}
            </div>
          )}

          <main style={{ flex: 1, overflowY: 'auto', paddingRight: '10px', paddingBottom: '120px', WebkitAppRegion: 'no-drag' }}>
            {activeTab === 'settings' ? (
              <Settings 
                eqBands={eqBands} setEqBands={handleEqChange} 
                reverb={reverb} setReverb={handleReverbChange}
                reverbEnabled={reverbEnabled} setReverbEnabled={handleReverbEnabledChange}
                djMode={djMode} setDjMode={handleDjModeChange}
              />
            ) : activeTab === 'search' && isLoading ? (
              <div className="flex-center" style={{ height: '50vh', color: 'var(--text-secondary)' }}>
                <p>Recherche en cours...</p>
              </div>
            ) : (
              <TrackList 
                tracks={currentList} 
                onPlay={(track, index) => playTrack(track, index, currentList)} 
                currentTrack={currentTrack}
                favorites={favorites}
                toggleFavorite={toggleFavorite}
              />
            )}
          </main>
        </div>
      )}

      {/* Mini Player specifics */}
      {isMiniPlayer && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: '200px', display: 'flex', justifyContent: 'center', alignItems: 'center', WebkitAppRegion: 'drag' }}>
            {currentTrack?.artwork ? (
                <img src={currentTrack.artwork.replace('t500x500', 't300x300')} alt="cover" style={{ width: '220px', height: '220px', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', pointerEvents: 'none' }} />
            ) : (
                <div style={{ width: '220px', height: '220px', borderRadius: '16px', backgroundColor: 'rgba(255,255,255,0.1)' }}></div>
            )}
        </div>
      )}

      {/* Large Cover Overlay */}
      {showLargeCover && currentTrack && !isMiniPlayer && (
        <div onClick={() => setShowLargeCover(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 40, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(15px)', WebkitAppRegion: 'no-drag' }}>
          <button onClick={(e) => { e.stopPropagation(); setShowLargeCover(false); }} style={{ position: 'absolute', top: '40px', right: '40px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', color: '#fff' }}>
            <X size={24} />
          </button>
          <img onClick={(e) => e.stopPropagation()} src={currentTrack.artwork ? currentTrack.artwork.replace('t500x500', 't500x500') : ''} alt="Large Cover" style={{ width: '40vw', height: '40vw', maxWidth: '500px', maxHeight: '500px', borderRadius: '20px', boxShadow: '0 30px 60px rgba(0,0,0,0.6)' }} />
        </div>
      )}

      {/* Always rendered Player to prevent unmounting! */}
      <Player 
        currentTrack={currentTrack} 
        onNext={playNext} 
        onPrev={playPrev} 
        onError={handleStreamError}
        isMini={isMiniPlayer}
        toggleMiniPlayer={toggleMiniPlayer}
        favorites={favorites}
        toggleFavorite={toggleFavorite}
        toggleCover={() => setShowLargeCover(!showLargeCover)}
        eqBands={eqBands}
        reverb={reverb}
        reverbEnabled={reverbEnabled}
        djMode={djMode}
      />
    </div>
  );
}
