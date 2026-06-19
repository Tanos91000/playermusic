import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Search, Heart, Home, X, Undo2, Download as DownloadIcon, Settings as SettingsIcon, FolderOpen, Users, ListMusic } from 'lucide-react';
import Player from './components/Player';
import TrackList from './components/TrackList';
import Settings from './components/Settings';
import AnimatedBackground from './components/AnimatedBackground';
import DownloadsView from './components/DownloadsView';
import HomeView from './components/HomeView';
import ArtistProfileView from './components/ArtistProfileView';
import LocalFilesView from './components/LocalFilesView';
import JamView from './components/JamView';
import PlaylistsView from './components/PlaylistsView';
import { TrackArtPlaceholder, RemoteAvatar } from './components/MediaPlaceholder';
import { resolveArtistPermalinkUrl } from './utils/soundcloudArtist';

const emptyDownloadsLibrary = {
  downloadsDir: '',
  tracks: [],
  count: 0,
  totalBytes: 0
};

const LOCAL_PATHS_STORAGE_KEY = 'aura_local_library_paths';

function localPathToTrack(absPath) {
  const norm = typeof absPath === 'string' ? absPath.trim() : '';
  const slashIdx = Math.max(norm.lastIndexOf('/'), norm.lastIndexOf('\\'));
  const file = slashIdx >= 0 ? norm.slice(slashIdx + 1) : norm;
  const title = file.replace(/\.[^/.]+$/, '') || 'Piste locale';
  return {
    id: `local:${norm}`,
    title,
    artist: 'Fichier local',
    localPath: norm,
    url: '',
    isFixed: false,
    isLocalFile: true,
    unavailable: false
  };
}

function persistLocalLibraryPaths(tracks) {
  const paths = tracks.map((t) => t.localPath).filter(Boolean);
  try {
    localStorage.setItem(LOCAL_PATHS_STORAGE_KEY, JSON.stringify(paths));
  } catch {
    /* ignore */
  }
}

function loadRecentTracks() {
  try {
    const raw = localStorage.getItem('aura_recent_tracks');
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function homeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

export default function App() {
  const [searchQuery, setSearchQuery] = useState('Drake');
  const [tracks, setTracks] = useState([]);
  const [searchArtists, setSearchArtists] = useState([]);
  const [searchSubView, setSearchSubView] = useState('list');
  const [artistProfile, setArtistProfile] = useState(null);
  const [artistProfileTracks, setArtistProfileTracks] = useState([]);
  const [artistProfileLoading, setArtistProfileLoading] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [recentTracks, setRecentTracks] = useState(loadRecentTracks);
  const [localLibraryTracks, setLocalLibraryTracks] = useState([]);
  const [activeTab, setActiveTab] = useState('home');
  const [eqBands, setEqBands] = useState([0, 0, 0, 0, 0]);
  const [reverb, setReverb] = useState(0);
  const [reverbEnabled, setReverbEnabled] = useState(false);
  const [djMode, setDjMode] = useState(false);
  const [updateStatus, setUpdateStatus] = useState(null); // 'available', 'downloaded', null
  const [downloadsLibrary, setDownloadsLibrary] = useState(emptyDownloadsLibrary);
  const [downloadsLoading, setDownloadsLoading] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [jamUsername, setJamUsername] = useState(() => localStorage.getItem('aura_jam_username') || '');
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playlists, setPlaylists] = useState(() => {
    try {
      const raw = localStorage.getItem('aura_playlists');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  const loadDownloadedLibrary = async () => {
    if (!window.electronAPI?.getDownloadLibrary) return;

    setDownloadsLoading(true);
    try {
      const library = await window.electronAPI.getDownloadLibrary();
      setDownloadsLibrary(library || emptyDownloadsLibrary);
    } catch (error) {
      console.error('Failed to load downloads library', error);
      setDownloadsLibrary(emptyDownloadsLibrary);
    } finally {
      setDownloadsLoading(false);
    }
  };

  const refreshFavoritesWithDownloads = async (favs) => {
    try {
      const downloads = await window.electronAPI.getDownloadedTracks();
      const enriched = favs.map(f => {
        if (downloads[f.id]) {
          return { ...f, localPath: downloads[f.id], unavailable: false, isFixed: true };
        }
        return f;
      });
      setFavorites(enriched);
    } catch (e) { console.error('Failed to enrich favorites', e); }
  };

  useEffect(() => {
    if (window.electronAPI?.onUpdateAvailable) {
      window.electronAPI.onUpdateAvailable(() => setUpdateStatus('available'));
      window.electronAPI.onUpdateDownloaded(() => setUpdateStatus('downloaded'));
    }
  }, []);

  const [currentTrack, setCurrentTrack] = useState(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [playlistContext, setPlaylistContext] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [playbackManualEpoch, setPlaybackManualEpoch] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const discordTrackStartRef = useRef({ trackId: null, startedAt: 0 });
  
  const [isMiniPlayer, setIsMiniPlayer] = useState(false);
  const [showLargeCover, setShowLargeCover] = useState(false);
  const [favoritesSearch, setFavoritesSearch] = useState('');
  const [streamUnavailableNotice, setStreamUnavailableNotice] = useState(null);
  const mainScrollRef = useRef(null);
  const streamNoticeScrollRestoreRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem('aura_favorites');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setFavorites(parsed);
        refreshFavoritesWithDownloads(parsed);
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
    loadDownloadedLibrary();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const api = window.electronAPI;
        if (!api?.filterExistingLocalPaths) return;
        const raw = localStorage.getItem(LOCAL_PATHS_STORAGE_KEY);
        if (!raw) return;
        const paths = JSON.parse(raw);
        if (!Array.isArray(paths) || paths.length === 0) return;
        const ok = await api.filterExistingLocalPaths(paths);
        if (cancelled || !Array.isArray(ok)) return;
        const tracks = ok.map(localPathToTrack);
        setLocalLibraryTracks(tracks);
        persistLocalLibraryPaths(tracks);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (activeTab !== 'search') {
      setSearchSubView('list');
      setArtistProfile(null);
      setArtistProfileTracks([]);
      setArtistProfileLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (currentTrack && isAudioPlaying) {
      if (discordTrackStartRef.current.trackId !== currentTrack.id) {
        discordTrackStartRef.current = { trackId: currentTrack.id, startedAt: Date.now() };
      }
    }
  }, [currentTrack, isAudioPlaying]);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.updateDiscordPresence) return;

    const storedId = localStorage.getItem('aura_discord_client_id');
    if (storedId?.trim() && api.setDiscordClientId) {
      api.setDiscordClientId(storedId.trim());
    }

    if (!currentTrack) {
      api.updateDiscordPresence({ mode: 'idle' });
      return;
    }

    const startedAt =
      discordTrackStartRef.current.trackId === currentTrack.id
        ? discordTrackStartRef.current.startedAt
        : Date.now();

    api.updateDiscordPresence({
      mode: isAudioPlaying ? 'playing' : 'paused',
      title: currentTrack.title,
      artist: currentTrack.artist || '',
      startedAt: isAudioPlaying ? startedAt : undefined
    });
  }, [currentTrack, isAudioPlaying]);

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

  const handleSetJamUsername = (name) => {
    setJamUsername(name);
    localStorage.setItem('aura_jam_username', name);
  };

  /** Synchronisation Jam — appelée par JamView quand un host state arrive (listener uniquement) */
  const handleJamSync = ({ track, playing, position, hostTimestamp }) => {
    if (!track) return;
    // Ne pas synchro si on est host
    // Vérifier si le morceau a changé
    if (!currentTrack || currentTrack.id !== track.id) {
      // Nouveau morceau : lancer la lecture
      setPlaybackManualEpoch((n) => n + 1);
      setCurrentTrack(track);
      setPlaylistContext([track]);
      setCurrentIndex(0);
    }
    // Synchro play/pause
    if (playing !== isAudioPlaying) {
      // toggle play via keyboard event simulation n'est pas propre,
      // on laisse le Player gérer son état, on sync juste les infos
    }
  };

  const handleCreatePlaylist = (name) => {
    const newPlaylist = { id: Date.now().toString(), name, tracks: [] };
    const next = [...playlists, newPlaylist];
    setPlaylists(next);
    localStorage.setItem('aura_playlists', JSON.stringify(next));
  };

  const handleDeletePlaylist = (id) => {
    const next = playlists.filter(p => p.id !== id);
    setPlaylists(next);
    localStorage.setItem('aura_playlists', JSON.stringify(next));
  };

  const addToPlaylist = (playlistId, track) => {
    const next = playlists.map(p => {
      if (p.id === playlistId) {
        if (p.tracks.find(t => t.id === track.id)) return p; // prevent duplicate
        return { ...p, tracks: [...p.tracks, track] };
      }
      return p;
    });
    setPlaylists(next);
    localStorage.setItem('aura_playlists', JSON.stringify(next));
  };

  const removeFromPlaylist = (playlistId, trackId) => {
    const next = playlists.map(p => {
      if (p.id === playlistId) {
        return { ...p, tracks: p.tracks.filter(t => t.id !== trackId) };
      }
      return p;
    });
    setPlaylists(next);
    localStorage.setItem('aura_playlists', JSON.stringify(next));
  };

  const saveFavorites = (newFavs) => {
    setFavorites(newFavs);
    localStorage.setItem('aura_favorites', JSON.stringify(newFavs));
  };

  const mergeSpotifyLikesIntoFavorites = (incomingTracks) => {
    if (!Array.isArray(incomingTracks) || incomingTracks.length === 0) {
      return { added: 0, duplicates: 0 };
    }
    const ids = new Set(favorites.map((t) => t.id));
    const merged = [...favorites];
    let added = 0;
    let duplicates = 0;
    for (const t of incomingTracks) {
      if (ids.has(t.id)) {
        duplicates += 1;
        continue;
      }
      ids.add(t.id);
      merged.push(t);
      added += 1;
    }
    saveFavorites(merged);
    refreshFavoritesWithDownloads(merged);
    return { added, duplicates };
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

  const openArtistProfile = async (permalinkUrl) => {
    if (!permalinkUrl?.trim() || !window.electronAPI?.getSoundCloudArtist) return;
    setSearchSubView('artist');
    setArtistProfileLoading(true);
    setArtistProfile(null);
    setArtistProfileTracks([]);
    try {
      const bundle = await window.electronAPI.getSoundCloudArtist(permalinkUrl.trim());
      if (bundle?.profile) setArtistProfile(bundle.profile);
      setArtistProfileTracks(Array.isArray(bundle?.tracks) ? bundle.tracks : []);
    } catch (error) {
      console.error('Artist profile failed', error);
      alert('Impossible de charger le profil artiste.');
      setSearchSubView('list');
    } finally {
      setArtistProfileLoading(false);
    }
  };

  const openArtistFromTrack = (track) => {
    const permalink = resolveArtistPermalinkUrl(track);
    if (!permalink) return;
    setActiveTab('search');
    openArtistProfile(permalink);
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearchSubView('list');
    setArtistProfile(null);
    setArtistProfileTracks([]);
    setIsLoading(true);
    try {
      const data = await window.electronAPI.searchSoundCloud(searchQuery);
      if (data && typeof data === 'object' && Array.isArray(data.tracks)) {
        setTracks(data.tracks);
        setSearchArtists(Array.isArray(data.artists) ? data.artists : []);
      } else if (Array.isArray(data)) {
        setTracks(data);
        setSearchArtists([]);
      } else {
        setTracks([]);
        setSearchArtists([]);
      }
    } catch (error) {
      setTracks([]);
      setSearchArtists([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportLocalFiles = async () => {
    try {
      const api = window.electronAPI;
      if (!api?.openLocalAudioFiles) return;
      const res = await api.openLocalAudioFiles();
      if (!res || res.canceled || !Array.isArray(res.paths) || res.paths.length === 0) return;
      setLocalLibraryTracks((prev) => {
        const seen = new Set(prev.map((t) => t.localPath));
        const added = [];
        for (const p of res.paths) {
          if (!p || seen.has(p)) continue;
          seen.add(p);
          added.push(localPathToTrack(p));
        }
        const next = [...prev, ...added];
        persistLocalLibraryPaths(next);
        return next;
      });
    } catch (e) {
      console.error('Import fichiers locaux:', e);
    }
  };

  const playTrack = (track, index, contextList) => {
    setPlaybackManualEpoch((n) => n + 1);
    setCurrentTrack(track);
    setPlaylistContext(contextList);
    setCurrentIndex(index);
    if (!isMiniPlayer) setShowLargeCover(true);

    setRecentTracks(prev => {
      const next = [{ ...track }, ...prev.filter(t => t.id !== track.id)].slice(0, 20);
      try {
        localStorage.setItem('aura_recent_tracks', JSON.stringify(next));
      } catch (e) {
        console.error('Failed to persist recent tracks', e);
      }
      return next;
    });
  };

  const markTrackDownloaded = (track, localPath) => ({
    ...track,
    unavailable: false,
    isFixed: true,
    localPath
  });

  const clearTrackDownload = (track, deletedTrack) => {
    if (track.id !== deletedTrack.id) return track;

    return {
      ...track,
      localPath: null,
      isFixed: false,
      unavailable: !!deletedTrack.sourceUnavailable
    };
  };

  const handleTrackDownloaded = (track, result) => {
    const updateTrack = (item) => item.id === track.id ? markTrackDownloaded(item, result.localPath) : item;

    setTracks(prev => prev.map(updateTrack));
    setArtistProfileTracks(prev => prev.map(updateTrack));
    setFavorites(prev => {
      const next = prev.map(updateTrack);
      localStorage.setItem('aura_favorites', JSON.stringify(next));
      return next;
    });
    setPlaylistContext(prev => prev.map(updateTrack));
    if (currentTrack?.id === track.id) {
      setCurrentTrack(prev => prev ? markTrackDownloaded(prev, result.localPath) : prev);
    }
    loadDownloadedLibrary();
  };

  const handleDeleteDownloadedTrack = async (track) => {
    const confirmed = window.confirm(`Supprimer "${track.title}" des téléchargements ?`);
    if (!confirmed) return;

    try {
      const library = await window.electronAPI.deleteDownloadedTrack(track.id);
      setDownloadsLibrary(library || emptyDownloadsLibrary);

      setTracks(prev => prev.map(item => clearTrackDownload(item, track)));
      setArtistProfileTracks(prev => prev.map(item => clearTrackDownload(item, track)));
      setFavorites(prev => {
        const next = prev.map(item => clearTrackDownload(item, track));
        localStorage.setItem('aura_favorites', JSON.stringify(next));
        return next;
      });
      setPlaylistContext(prev => (
        activeTab === 'downloads'
          ? prev.filter(item => item.id !== track.id)
          : prev.map(item => clearTrackDownload(item, track))
      ));

      if (currentTrack?.id === track.id) {
        setCurrentTrack(null);
        setCurrentIndex(-1);
      }
    } catch (error) {
      console.error('Failed to delete downloaded track', error);
      alert('Erreur lors de la suppression du téléchargement.');
    }
  };

  /** Passage auto en fin de morceau — ne doit pas lever le blocage après erreur réseau. */
  const playNextAuto = () => {
    if (currentIndex < playlistContext.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentTrack(playlistContext[nextIndex]);
      setCurrentIndex(nextIndex);
    }
  };

  /** Bouton suivant / intention utilisateur — débloque la lecture après une erreur. */
  const playNextManual = () => {
    setPlaybackManualEpoch((n) => n + 1);
    playNextAuto();
  };

  const playPrev = () => {
    if (currentIndex > 0) {
      setPlaybackManualEpoch((n) => n + 1);
      const prevIndex = currentIndex - 1;
      setCurrentTrack(playlistContext[prevIndex]);
      setCurrentIndex(prevIndex);
    }
  };

  const handleStreamError = () => {
    console.error('Stream failed');
    const el = mainScrollRef.current;
    if (el) streamNoticeScrollRestoreRef.current = el.scrollTop;
    const title = currentTrack?.title?.trim() || 'Ce titre';
    const artist = currentTrack?.artist?.trim() || '';
    setStreamUnavailableNotice({ title, artist });
  };

  useLayoutEffect(() => {
    if (!streamUnavailableNotice) return;
    const target = streamNoticeScrollRestoreRef.current;
    const mainEl = mainScrollRef.current;
    if (mainEl && typeof target === 'number') {
      mainEl.scrollTop = target;
    }
    streamNoticeScrollRestoreRef.current = null;
  }, [streamUnavailableNotice]);

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

  const currentList = activeTab === 'downloads'
      ? downloadsLibrary.tracks
      : activeTab === 'favorites'
      ? favorites.filter(t => {
        if (!favoritesSearch) return true;
        const search = favoritesSearch.toLowerCase();
        const titleMatch = t.title ? t.title.toLowerCase().includes(search) : false;
        const artistMatch = t.artist ? t.artist.toLowerCase().includes(search) : false;
        return titleMatch || artistMatch;
      })
      : [];

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', maxWidth: '100%', overflow: 'hidden', boxSizing: 'border-box' }}>
      {/* Dynamic Background */}
      <AnimatedBackground imageUrl={currentTrack?.artwork} />

      {updateStatus && (
        <div
          className="glass animate-fade-in"
          style={{
            position: 'fixed',
            top: 14,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            maxWidth: 'min(560px, calc(100vw - 28px))',
            width: '100%',
            padding: '12px 18px',
            borderRadius: '14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            backgroundColor: 'rgba(255, 255, 255, 0.12)',
            WebkitAppRegion: 'no-drag',
            boxSizing: 'border-box'
          }}
        >
          <div style={{ minWidth: 0 }}>
            <span style={{ fontWeight: 'bold' }}>Mise à jour {updateStatus === 'downloaded' ? 'prête !' : 'disponible...'}</span>
            <span style={{ marginLeft: '10px', color: 'var(--text-secondary)' }}>
              {updateStatus === 'downloaded' ? 'La nouvelle version est prête à être installée.' : 'Téléchargement en cours...'}
            </span>
          </div>
          {updateStatus === 'downloaded' && (
            <button
              type="button"
              onClick={() => window.electronAPI.restartApp()}
              style={{
                background: 'var(--accent-color)',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '20px',
                cursor: 'pointer',
                fontWeight: 600,
                flexShrink: 0
              }}
            >
              Redémarrer
            </button>
          )}
        </div>
      )}

      {streamUnavailableNotice && (
        <div
          role="dialog"
          aria-labelledby="stream-unavail-title"
          className="glass animate-fade-in"
          style={{
            position: 'fixed',
            bottom: '96px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 90,
            width: 'min(440px, calc(100vw - 32px))',
            padding: '16px 18px',
            borderRadius: '16px',
            boxSizing: 'border-box',
            WebkitAppRegion: 'no-drag',
            backgroundColor: 'rgba(30, 30, 36, 0.94)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 18px 50px rgba(0,0,0,0.45)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '6px' }}>
            <button
              type="button"
              aria-label="Fermer"
              onClick={() => setStreamUnavailableNotice(null)}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: 'none',
                borderRadius: '50%',
                width: '34px',
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-secondary)'
              }}
            >
              <X size={18} />
            </button>
          </div>
          <h3 id="stream-unavail-title" style={{ margin: '0 0 10px', fontSize: '1.05rem', fontWeight: 700 }}>
            Streaming indisponible
          </h3>
          <p style={{ margin: '0 0 8px', fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            « {streamUnavailableNotice.title} »
            {streamUnavailableNotice.artist ? ` — ${streamUnavailableNotice.artist}` : ''} ne peut pas être lu en streaming depuis
            SoundCloud.
          </p>
          <p style={{ margin: '0 0 18px', fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            Télécharge la piste pour l&apos;écouter localement (bouton Download sur la piste).
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {currentIndex > 0 && (
              <button
                type="button"
                onClick={() => {
                  setStreamUnavailableNotice(null);
                  playPrev();
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: 'var(--text-primary)',
                  padding: '10px 16px',
                  borderRadius: '22px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.88rem'
                }}
              >
                <Undo2 size={18} />
                Demi-tour
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Full UI */}
      {!isMiniPlayer && (
        <div
          style={{
            width: '100%',
            maxWidth: '1200px',
            margin: '0 auto',
            padding: 'clamp(16px, 3vw, 40px) clamp(12px, 2vw, 20px)',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box',
            minWidth: 0
          }}
        >
          
          <header
            style={{
              marginBottom: 'clamp(16px, 3vw, 30px)',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '14px 18px',
              WebkitAppRegion: 'drag',
              width: '100%',
              minWidth: 0
            }}
          >
            <div style={{ flex: '1 1 240px', minWidth: 0 }}>
              <h1 className="text-gradient" style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>Aura Player</h1>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '15px', WebkitAppRegion: 'no-drag' }}>
                <button className="glass" onClick={() => setActiveTab('home')} style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', fontSize: '1.1rem', color: activeTab === 'home' ? 'var(--accent-color)' : 'var(--text-secondary)', fontWeight: activeTab === 'home' ? 600 : 400, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px' }}><Home size={16} /> Accueil</button>
                <button className="glass" onClick={() => setActiveTab('favorites')} style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', fontSize: '1.1rem', color: activeTab === 'favorites' ? 'var(--accent-color)' : 'var(--text-secondary)', fontWeight: activeTab === 'favorites' ? 600 : 400, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px' }}><Heart size={16} /> Favoris</button>
                <button className="glass" onClick={() => { setActiveTab('downloads'); loadDownloadedLibrary(); }} style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', fontSize: '1.1rem', color: activeTab === 'downloads' ? 'var(--accent-color)' : 'var(--text-secondary)', fontWeight: activeTab === 'downloads' ? 600 : 400, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px' }}><DownloadIcon size={16} /> Téléchargés</button>
                <button className="glass" onClick={() => setActiveTab('local')} style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', fontSize: '1.1rem', color: activeTab === 'local' ? 'var(--accent-color)' : 'var(--text-secondary)', fontWeight: activeTab === 'local' ? 600 : 400, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px' }}><FolderOpen size={16} /> Fichiers locaux</button>
                <button className="glass" onClick={() => setActiveTab('playlists')} style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', fontSize: '1.1rem', color: activeTab === 'playlists' ? 'var(--accent-color)' : 'var(--text-secondary)', fontWeight: activeTab === 'playlists' ? 600 : 400, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px' }}><ListMusic size={16} /> Playlists</button>
                <button className="glass" onClick={() => setActiveTab('jam')} style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', fontSize: '1.1rem', color: activeTab === 'jam' ? 'var(--accent-color)' : 'var(--text-secondary)', fontWeight: activeTab === 'jam' ? 600 : 400, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px' }}><Users size={16} /> Jam</button>
                <button className="glass" onClick={() => setActiveTab('settings')} style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', fontSize: '1.1rem', color: activeTab === 'settings' ? 'var(--accent-color)' : 'var(--text-secondary)', fontWeight: activeTab === 'settings' ? 600 : 400, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px' }}><SettingsIcon size={16} /> Paramètres</button>
              </div>
            </div>
            
            <div
              style={{
                flex: '1 1 200px',
                minWidth: 0,
                maxWidth: '100%',
                WebkitAppRegion: 'no-drag',
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'flex-start',
                gap: '12px'
              }}
            >
                <form 
                  onSubmit={(e) => { e.preventDefault(); setActiveTab('search'); handleSearch(); }} 
                  className="glass" 
                  style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', width: '100%', maxWidth: '400px', borderRadius: '30px', boxSizing: 'border-box' }}
                >
                  <Search size={20} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
                  <input 
                    type="text" 
                    placeholder="Rechercher musiques, artistes..." 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)} 
                    onFocus={() => setActiveTab('search')}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', width: '100%', minWidth: 0, marginLeft: '10px', fontSize: '1rem' }} 
                  />
                </form>

                {activeTab === 'favorites' && (
                  <div className="glass" style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', width: '100%', maxWidth: '250px', borderRadius: '30px', boxSizing: 'border-box' }}>
                    <Search size={18} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
                    <input type="text" placeholder="Filtrer favoris..." value={favoritesSearch} onChange={(e) => setFavoritesSearch(e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', width: '100%', minWidth: 0, marginLeft: '10px', fontSize: '0.9rem' }} />
                  </div>
                )}
            </div>
          </header>

          <main
            ref={mainScrollRef}
            onScroll={(e) => setIsScrolled(e.target.scrollTop > 10)}
            style={{
              flex: 1,
              minHeight: 0,
              minWidth: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
              overflowAnchor: 'none',
              paddingRight: '10px',
              paddingBottom: '120px',
              WebkitAppRegion: 'no-drag',
              maskImage: isScrolled ? 'linear-gradient(to bottom, transparent 0px, black 30px, black calc(100% - 30px), transparent 100%)' : 'linear-gradient(to bottom, black 0px, black calc(100% - 30px), transparent 100%)',
              WebkitMaskImage: isScrolled ? 'linear-gradient(to bottom, transparent 0px, black 30px, black calc(100% - 30px), transparent 100%)' : 'linear-gradient(to bottom, black 0px, black calc(100% - 30px), transparent 100%)',
              transition: 'mask-image 0.3s, -webkit-mask-image 0.3s'
            }}
          >
            {activeTab === 'settings' ? (
              <Settings 
                eqBands={eqBands} setEqBands={handleEqChange} 
                reverb={reverb} setReverb={handleReverbChange}
                reverbEnabled={reverbEnabled} setReverbEnabled={handleReverbEnabledChange}
                djMode={djMode} setDjMode={handleDjModeChange}
                mergeSpotifyLikesIntoFavorites={mergeSpotifyLikesIntoFavorites}
              />
            ) : activeTab === 'home' ? (
              <HomeView
                greeting={homeGreeting()}
                recentTracks={recentTracks}
                favorites={favorites}
                downloadTracks={downloadsLibrary.tracks}
                currentTrack={currentTrack}
                isAudioPlaying={isAudioPlaying}
                onPlay={(track, index, list) => playTrack(track, index, list)}
                onNavigateSearch={() => setActiveTab('search')}
                onNavigateFavorites={() => setActiveTab('favorites')}
                onNavigateDownloads={() => { setActiveTab('downloads'); loadDownloadedLibrary(); }}
                onNavigateLocal={() => setActiveTab('local')}
              />
            ) : activeTab === 'search' && isLoading ? (
              <div className="flex-center" style={{ height: '50vh', color: 'var(--text-secondary)' }}>
                <p>Recherche en cours...</p>
              </div>
            ) : activeTab === 'search' && searchSubView === 'artist' ? (
              <ArtistProfileView
                profile={artistProfile}
                tracks={artistProfileTracks}
                loading={artistProfileLoading}
                onBack={() => {
                  setSearchSubView('list');
                  setArtistProfile(null);
                  setArtistProfileTracks([]);
                }}
                onPlay={(track, index, list) => playTrack(track, index, list)}
                onOpenArtistFromTrack={openArtistFromTrack}
                currentTrack={currentTrack}
                isAudioPlaying={isAudioPlaying}
                favorites={favorites}
                toggleFavorite={toggleFavorite}
                onTrackDownloaded={handleTrackDownloaded}
              />
            ) : activeTab === 'search' ? (
              <>
                {searchArtists.length > 0 && (
                  <div style={{ marginBottom: '28px' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '14px', color: 'var(--text-primary)' }}>
                      Artistes
                    </h3>
                    <div
                      className="custom-scrollbar"
                      style={{
                        display: 'flex',
                        gap: '12px',
                        overflowX: 'auto',
                        overflowY: 'hidden',
                        paddingBottom: '8px',
                        WebkitOverflowScrolling: 'touch',
                        overscrollBehaviorX: 'contain',
                        contain: 'content'
                      }}
                    >
                      {searchArtists.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => openArtistProfile(a.permalinkUrl)}
                          style={{
                            flex: '0 0 auto',
                            width: '112px',
                            border: 'none',
                            borderRadius: '14px',
                            padding: '12px 10px',
                            cursor: 'pointer',
                            textAlign: 'center',
                            backgroundColor: 'rgba(255,255,255,0.06)',
                            color: 'var(--text-primary)',
                            WebkitAppRegion: 'no-drag',
                            contain: 'layout style paint',
                            isolation: 'isolate'
                          }}
                        >
                          <RemoteAvatar
                            url={a.avatarUrl}
                            size={72}
                            variant="list"
                            wrapperStyle={{ marginBottom: '10px' }}
                          />
                          <span className="truncate" style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block' }}>
                            {a.fullName || a.username}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {tracks.length === 0 && searchArtists.length === 0 ? (
                  <div className="flex-center" style={{ height: '40vh', color: 'var(--text-secondary)' }}>
                    <p>Aucun résultat.</p>
                  </div>
                ) : tracks.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '24px' }}>
                    Aucune piste pour cette recherche.
                  </p>
                ) : (
                  <>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '14px', color: 'var(--text-primary)' }}>
                      Pistes
                    </h3>
                    <TrackList
                      tracks={tracks}
                      onPlay={(track, index) => playTrack(track, index, tracks)}
                      currentTrack={currentTrack}
                      isAudioPlaying={isAudioPlaying}
                      favorites={favorites}
                      toggleFavorite={toggleFavorite}
                      onTrackDownloaded={handleTrackDownloaded}
                      onOpenArtist={openArtistFromTrack}
                      playlists={playlists}
                      onAddToPlaylist={addToPlaylist}
                    />
                  </>
                )}
              </>
            ) : activeTab === 'local' ? (
              <LocalFilesView
                tracks={localLibraryTracks}
                currentTrack={currentTrack}
                isAudioPlaying={isAudioPlaying}
                onPlay={(track, index) => playTrack(track, index, localLibraryTracks)}
                onImport={handleImportLocalFiles}
                favorites={favorites}
                toggleFavorite={toggleFavorite}
                onOpenArtist={openArtistFromTrack}
              />
            ) : activeTab === 'playlists' ? (
              <PlaylistsView
                playlists={playlists}
                onCreatePlaylist={handleCreatePlaylist}
                onDeletePlaylist={handleDeletePlaylist}
                onPlayPlaylist={(pl) => playTrack(pl.tracks[0], 0, pl.tracks)}
                currentTrack={currentTrack}
                isAudioPlaying={isAudioPlaying}
                onPlayTrack={playTrack}
                favorites={favorites}
                toggleFavorite={toggleFavorite}
                onTrackDownloaded={handleTrackDownloaded}
                onRemoveFromPlaylist={removeFromPlaylist}
              />
            ) : activeTab === 'downloads' ? (
              downloadsLoading ? (
                <div className="flex-center" style={{ height: '50vh', color: 'var(--text-secondary)' }}>
                  <p>Chargement...</p>
                </div>
              ) : (
                <DownloadsView
                  library={downloadsLibrary}
                  currentTrack={currentTrack}
                  isAudioPlaying={isAudioPlaying}
                  onPlay={(track, index) => playTrack(track, index, downloadsLibrary.tracks)}
                  onDelete={handleDeleteDownloadedTrack}
                />
              )
            ) : (
              <TrackList 
                tracks={currentList} 
                onPlay={(track, index) => playTrack(track, index, currentList)} 
                currentTrack={currentTrack}
                isAudioPlaying={isAudioPlaying}
                favorites={favorites}
                toggleFavorite={toggleFavorite}
                onTrackDownloaded={handleTrackDownloaded}
                playlists={playlists}
                onAddToPlaylist={addToPlaylist}
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
                <TrackArtPlaceholder size={220} radius={16} style={{ boxShadow: '0 10px 30px rgba(0,0,0,0.5)', pointerEvents: 'none' }} />
            )}
        </div>
      )}

      {/* Large Cover Overlay */}
      {showLargeCover && currentTrack && !isMiniPlayer && (
        <div onClick={() => setShowLargeCover(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 40, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(15px)', WebkitAppRegion: 'no-drag' }}>
          <button onClick={(e) => { e.stopPropagation(); setShowLargeCover(false); }} style={{ position: 'absolute', top: '40px', right: '40px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', color: '#fff' }}>
            <X size={24} />
          </button>
          {currentTrack.artwork ? (
            <img
              onClick={(e) => e.stopPropagation()}
              src={currentTrack.artwork.replace('t500x500', 't500x500')}
              alt="Large Cover"
              style={{ width: '40vw', height: '40vw', maxWidth: '500px', maxHeight: '500px', borderRadius: '20px', boxShadow: '0 30px 60px rgba(0,0,0,0.6)' }}
            />
          ) : (
            <div onClick={(e) => e.stopPropagation()}>
              <TrackArtPlaceholder size={280} radius={20} style={{ boxShadow: '0 30px 60px rgba(0,0,0,0.6)' }} />
            </div>
          )}
        </div>
      )}

      {/* Always rendered Player to prevent unmounting! */}
      <Player 
        currentTrack={currentTrack} 
        onNext={playNextAuto} 
        onManualNext={playNextManual}
        playbackManualEpoch={playbackManualEpoch}
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
        onPlaybackChange={setIsAudioPlaying}
        onOpenArtist={openArtistFromTrack}
        onPositionUpdate={(pos, dur) => {
          setPlaybackPosition(pos);
        }}
      />
    </div>
  );
}
