import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { X, Undo2, Download as DownloadIcon, Heart, FolderOpen, FolderPlus } from 'lucide-react';
import Player, { PLAYER_HEIGHT } from './components/Player';
import Settings from './components/Settings';
import AnimatedBackground from './components/AnimatedBackground';
import CollectionView from './components/CollectionView';
import HomeView from './components/HomeView';
import ArtistProfileView from './components/ArtistProfileView';
import JamView from './components/JamView';
import PlaylistsView from './components/PlaylistsView';
import QueueView from './components/QueueView';
import DownloadToasts from './components/DownloadToasts';
import TrackListSkeleton from './components/TrackListSkeleton';
import TitleBar, { TITLE_BAR_HEIGHT } from './components/TitleBar';
import Sidebar from './components/Sidebar';
import SearchBar from './components/SearchBar';
import SearchResults from './components/SearchResults';
import { TrackArtPlaceholder } from './components/MediaPlaceholder';
import { resolveArtistPermalinkUrl } from './utils/soundcloudArtist';
import useDownloadManager from './hooks/useDownloadManager';
import { buildShuffleOrder, nextIndexFor, prevIndexFor, upcomingIndices } from './utils/playbackOrder';

const emptyDownloadsLibrary = {
  downloadsDir: '',
  tracks: [],
  count: 0,
  totalBytes: 0
};

const LOCAL_PATHS_STORAGE_KEY = 'aura_local_library_paths';

/** En dessous, la barre latérale passe en icônes seules. */
const SIDEBAR_COMPACT_BREAKPOINT = 1080;

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
  const [searchFilter, setSearchFilter] = useState('all');
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
  const [crossfadeSeconds, setCrossfadeSeconds] = useState(
    () => Number(localStorage.getItem('aura_crossfade')) || 3
  );
  const [autoRepair, setAutoRepair] = useState(
    () => localStorage.getItem('aura_auto_repair') !== 'false'
  );
  const [showNotifications, setShowNotifications] = useState(
    () => localStorage.getItem('aura_dl_notifications') !== 'false'
  );
  const [updateStatus, setUpdateStatus] = useState(null); // 'available', 'downloaded', null
  const [downloadsLibrary, setDownloadsLibrary] = useState(emptyDownloadsLibrary);
  const [downloadsLoading, setDownloadsLoading] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [sidebarCompact, setSidebarCompact] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < SIDEBAR_COMPACT_BREAKPOINT
  );
  /** Incrémenté pour demander à PlaylistsView d'ouvrir son formulaire de création. */
  const [playlistCreateRequest, setPlaylistCreateRequest] = useState(0);
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

  useEffect(() => {
    const onResize = () => setSidebarCompact(window.innerWidth < SIDEBAR_COMPACT_BREAKPOINT);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  /** Position de lecture : ref à chaque frame, state limité à ~2 Hz pour la Jam. */
  const handlePositionUpdate = useCallback((pos) => {
    playbackPositionRef.current = pos;
    setPlaybackPosition((prev) => (Math.abs(pos - prev) >= 0.5 ? pos : prev));
  }, []);

  const [currentTrack, setCurrentTrack] = useState(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [playlistContext, setPlaylistContext] = useState([]);
  const [contextLabel, setContextLabel] = useState('');
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [playbackManualEpoch, setPlaybackManualEpoch] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const discordTrackStartRef = useRef({ trackId: null, startedAt: 0 });

  /* --- File d'attente / modes de lecture ------------------------------- */
  const [queue, setQueue] = useState([]);
  const [showQueue, setShowQueue] = useState(false);
  const [playingFromQueue, setPlayingFromQueue] = useState(false);
  const [shuffle, setShuffle] = useState(() => localStorage.getItem('aura_shuffle') === 'true');
  const [repeatMode, setRepeatMode] = useState(() => localStorage.getItem('aura_repeat') || 'off');
  const [shuffleOrder, setShuffleOrder] = useState([]);
  /** Position à restaurer après une réparation automatique de la piste courante. */
  const [resumeAt, setResumeAt] = useState(0);
  const playbackPositionRef = useRef(0);
  const playerControlsRef = useRef(null);

  const [isMiniPlayer, setIsMiniPlayer] = useState(false);
  const [showLargeCover, setShowLargeCover] = useState(false);
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

  /* Touches média système + raccourcis clavier globaux. Les handlers sont lus
     via une ref pour ne pas réenregistrer les listeners à chaque rendu. */
  const shortcutHandlersRef = useRef({});
  shortcutHandlersRef.current = {
    'play-pause': () => playerControlsRef.current?.togglePlay?.(),
    stop: () => playerControlsRef.current?.pause?.(),
    next: () => playNextManual(),
    previous: () => playPrev(),
    'seek-forward': () => playerControlsRef.current?.nudge?.(10),
    'seek-backward': () => playerControlsRef.current?.nudge?.(-10),
    shuffle: () => toggleShuffle(),
    repeat: () => cycleRepeat()
  };

  useEffect(() => {
    window.electronAPI?.onMediaKey?.((action) => {
      shortcutHandlersRef.current[action]?.();
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const map = {
        ArrowRight: 'seek-forward',
        ArrowLeft: 'seek-backward',
        KeyN: 'next',
        KeyP: 'previous',
        KeyS: 'shuffle',
        KeyR: 'repeat'
      };
      const action = map[e.code];
      if (!action) return;
      e.preventDefault();
      shortcutHandlersRef.current[action]?.();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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

  const handleCrossfadeChange = (val) => {
    setCrossfadeSeconds(val);
    localStorage.setItem('aura_crossfade', String(val));
  };

  const handleAutoRepairChange = (val) => {
    setAutoRepair(val);
    localStorage.setItem('aura_auto_repair', String(val));
  };

  const handleNotificationsChange = (val) => {
    setShowNotifications(val);
    localStorage.setItem('aura_dl_notifications', String(val));
  };

  const clearRecentTracks = () => {
    setRecentTracks([]);
    localStorage.removeItem('aura_recent_tracks');
  };

  const clearSearchHistory = () => {
    localStorage.removeItem('aura_search_history');
  };

  const handleSetJamUsername = (name) => {
    setJamUsername(name);
    localStorage.setItem('aura_jam_username', name);
  };

  /** Au-delà de cet écart avec l'hôte, on se recale (en secondes). */
  const JAM_DRIFT_TOLERANCE = 2.5;

  /**
   * Synchronisation Jam côté auditeur : piste, lecture/pause et position.
   * Appelée à chaque état publié par l'hôte (~2 fois par seconde).
   */
  const handleJamSync = ({ track, playing, position, hostTimestamp }) => {
    if (!track) return;

    // Latence réseau : l'hôte a avancé depuis l'envoi du message.
    const latency = hostTimestamp ? Math.max(0, (Date.now() - hostTimestamp) / 1000) : 0;
    const expected = (Number(position) || 0) + (playing ? latency : 0);

    // 1. Nouvelle piste → on la charge en reprenant à la position de l'hôte.
    if (!currentTrack || String(currentTrack.id) !== String(track.id)) {
      setPlaybackManualEpoch((n) => n + 1);
      setResumeAt(expected > 1 ? expected : 0);
      setPlayingFromQueue(false);
      setCurrentTrack(track);
      setPlaylistContext([track]);
      setCurrentIndex(0);
      setContextLabel('Jam');
      return;
    }

    const controls = playerControlsRef.current;
    if (!controls) return;

    // 2. Aligner lecture / pause sur l'hôte.
    if (playing !== isAudioPlaying) {
      controls.togglePlay();
      return;
    }

    // 3. Recaler la position si on a dérivé.
    if (playing) {
      const actual = controls.getPosition?.() ?? 0;
      if (Math.abs(actual - expected) > JAM_DRIFT_TOLERANCE) {
        controls.seek(expected);
      }
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

  /** `query` optionnel : la barre de recherche lance la requête sans passer par l'état. */
  const handleSearch = async (query) => {
    const q = (typeof query === 'string' ? query : searchQuery).trim();
    if (!q) return;

    setSearchSubView('list');
    setArtistProfile(null);
    setArtistProfileTracks([]);
    setIsLoading(true);
    try {
      const data = await window.electronAPI.searchSoundCloud(q);
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

  const pushRecent = (track) => {
    if (!track) return;
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

  /** Une piste bloquée sur SoundCloud n'est jouable qu'une fois récupérée localement. */
  const needsRepair = (track) =>
    autoRepair && !!track && !track.localPath && !track.isLocalFile && !!track.unavailable && track.id != null;

  const startPlayback = (track, index, contextList, label) => {
    const list = Array.isArray(contextList) && contextList.length > 0 ? contextList : [track];
    const safeIndex = index >= 0 && index < list.length ? index : 0;

    setPlaybackManualEpoch((n) => n + 1);
    setResumeAt(0);
    setPlayingFromQueue(false);
    setCurrentTrack(track);
    setPlaylistContext(list);
    setCurrentIndex(safeIndex);
    setShuffleOrder(shuffle ? buildShuffleOrder(list.length, safeIndex) : []);
    if (typeof label === 'string') setContextLabel(label);
    if (!isMiniPlayer) setShowLargeCover(true);
    pushRecent(track);
  };

  /**
   * Lecture d'une piste. Si elle est indisponible en streaming, on lance la
   * récupération locale automatiquement puis on enchaîne la lecture.
   */
  const playTrack = async (track, index, contextList, label) => {
    if (!track) return;

    if (!needsRepair(track)) {
      startPlayback(track, index, contextList, label);
      return;
    }

    const localPath = await downloads.start(track);
    if (!localPath) {
      setStreamUnavailableNotice({
        title: track.title?.trim() || 'Ce titre',
        artist: track.artist?.trim() || '',
        repairFailed: true
      });
      return;
    }

    const repaired = markTrackDownloaded(track, localPath);
    const list = (Array.isArray(contextList) ? contextList : [track]).map((t) =>
      t.id === track.id ? repaired : t
    );
    startPlayback(repaired, index, list, label);
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
    setQueue(prev => prev.map(updateTrack));
    loadDownloadedLibrary();
  };

  const handleTrackDownloadedRef = useRef(handleTrackDownloaded);
  handleTrackDownloadedRef.current = handleTrackDownloaded;

  const downloads = useDownloadManager({
    onDownloaded: useCallback((track, result) => {
      handleTrackDownloadedRef.current(track, result);
    }, [])
  });

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

  /* --- File d'attente --------------------------------------------------- */

  const enqueue = (track, { next = false } = {}) => {
    if (!track) return;
    setQueue(prev => (next ? [track, ...prev] : [...prev, track]));
  };

  const removeFromQueue = (index) => {
    setQueue(prev => prev.filter((_, i) => i !== index));
  };

  const playQueuedAt = (index) => {
    const track = queue[index];
    if (!track) return;
    setQueue(prev => prev.filter((_, i) => i !== index));
    setPlaybackManualEpoch((n) => n + 1);
    setResumeAt(0);
    setPlayingFromQueue(true);
    setCurrentTrack(track);
    pushRecent(track);
  };

  /** Lance une collection dans un ordre aléatoire, quel que soit l'état du bouton shuffle. */
  const shufflePlay = (list, label) => {
    if (!Array.isArray(list) || list.length === 0) return;
    const index = Math.floor(Math.random() * list.length);
    if (!shuffle) toggleShuffle();
    playTrack(list[index], index, list, label);
  };

  const toggleShuffle = () => {
    const next = !shuffle;
    localStorage.setItem('aura_shuffle', String(next));
    setShuffle(next);
    setShuffleOrder(next ? buildShuffleOrder(playlistContext.length, currentIndex) : []);
  };

  const cycleRepeat = () => {
    const next = repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off';
    localStorage.setItem('aura_repeat', next);
    setRepeatMode(next);
  };

  /** Passage auto en fin de morceau — ne doit pas lever le blocage après erreur réseau. */
  const playNextAuto = () => {
    if (queue.length > 0) {
      playQueuedAt(0);
      return;
    }

    const nextIndex = nextIndexFor({
      length: playlistContext.length,
      currentIndex,
      shuffle,
      shuffleOrder,
      repeatMode
    });
    if (nextIndex < 0) return;

    setResumeAt(0);
    setPlayingFromQueue(false);
    setCurrentTrack(playlistContext[nextIndex]);
    setCurrentIndex(nextIndex);
    pushRecent(playlistContext[nextIndex]);
  };

  /** Bouton suivant / intention utilisateur — débloque la lecture après une erreur. */
  const playNextManual = () => {
    setPlaybackManualEpoch((n) => n + 1);
    playNextAuto();
  };

  const playPrev = () => {
    // Comportement type Spotify : au-delà de 3 s, « précédent » relance la piste.
    if (playbackPositionRef.current > 3 && playerControlsRef.current?.seek) {
      playerControlsRef.current.seek(0);
      return;
    }

    setPlaybackManualEpoch((n) => n + 1);

    // On sortait d'une piste de la file : on revient au contexte laissé en plan.
    if (playingFromQueue && playlistContext[currentIndex]) {
      setResumeAt(0);
      setPlayingFromQueue(false);
      setCurrentTrack(playlistContext[currentIndex]);
      return;
    }

    const prevIndex = prevIndexFor({
      length: playlistContext.length,
      currentIndex,
      shuffle,
      shuffleOrder,
      repeatMode
    });
    if (prevIndex < 0) return;

    setResumeAt(0);
    setCurrentTrack(playlistContext[prevIndex]);
    setCurrentIndex(prevIndex);
  };

  /**
   * Le stream SoundCloud a échoué : on tente une récupération locale automatique
   * et on reprend la lecture là où elle s'était arrêtée. Le message d'erreur
   * n'apparaît qu'en cas d'échec de cette réparation.
   */
  const handleStreamError = async () => {
    const track = currentTrack;
    if (!track) return;

    const canRepair = autoRepair && !track.isLocalFile && !track.localPath && track.id != null;
    if (canRepair) {
      const resumeTarget = playbackPositionRef.current;
      setResumeAt(resumeTarget > 2 ? resumeTarget : 0);

      const localPath = await downloads.start(track);
      if (localPath) {
        setPlaybackManualEpoch((n) => n + 1);
        setCurrentTrack(prev => (prev?.id === track.id ? markTrackDownloaded(prev, localPath) : prev));
        return;
      }
      setResumeAt(0);
    }

    console.error('Stream failed');
    const el = mainScrollRef.current;
    if (el) streamNoticeScrollRestoreRef.current = el.scrollTop;
    setStreamUnavailableNotice({
      title: track.title?.trim() || 'Ce titre',
      artist: track.artist?.trim() || '',
      repairFailed: canRepair
    });
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

  /** Props partagées par toutes les listes de pistes. */
  const trackListCommonProps = {
    currentTrack,
    isAudioPlaying,
    favorites,
    toggleFavorite,
    onTrackDownloaded: handleTrackDownloaded,
    downloadStates: downloads.downloads,
    onDownload: downloads.start,
    playlists,
    onAddToPlaylist: addToPlaylist,
    onQueueNext: (track) => enqueue(track, { next: true }),
    onQueueLast: (track) => enqueue(track)
  };

  /** Pistes restant à jouer dans le contexte courant (panneau file d'attente). */
  const upNext = useMemo(
    () =>
      upcomingIndices({
        length: playlistContext.length,
        currentIndex,
        shuffle,
        shuffleOrder
      })
        .map((index) => ({ track: playlistContext[index], index }))
        .filter((entry) => !!entry.track),
    [playlistContext, currentIndex, shuffle, shuffleOrder]
  );

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', maxWidth: '100%', overflow: 'hidden', boxSizing: 'border-box' }}>
      {/* Dynamic Background */}
      <AnimatedBackground imageUrl={currentTrack?.artwork} />

      {/* Barre de titre : zone de déplacement + recherche toujours accessible */}
      <TitleBar>
        {!isMiniPlayer && (
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            onSearch={(q) => {
              setActiveTab('search');
              handleSearch(q);
            }}
            onFocusSearch={() => setActiveTab('search')}
          />
        )}
      </TitleBar>

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
            Lecture impossible
          </h3>
          <p style={{ margin: '0 0 8px', fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            « {streamUnavailableNotice.title} »
            {streamUnavailableNotice.artist ? ` — ${streamUnavailableNotice.artist}` : ''} ne peut pas être lu en streaming depuis
            SoundCloud.
          </p>
          <p style={{ margin: '0 0 18px', fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            {streamUnavailableNotice.repairFailed
              ? 'La récupération automatique d’une copie locale a échoué. Réessaie dans un instant, ou passe à la piste suivante.'
              : 'Télécharge la piste pour l’écouter localement (bouton Download sur la piste).'}
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {currentIndex > 0 && (
              <button
                type="button"
                className="btn-pill"
                onClick={() => {
                  setStreamUnavailableNotice(null);
                  playPrev();
                }}
              >
                <Undo2 size={18} />
                Demi-tour
              </button>
            )}
            {streamUnavailableNotice.repairFailed && currentTrack && (
              <button
                type="button"
                className="btn-pill btn-pill--accent"
                onClick={() => {
                  setStreamUnavailableNotice(null);
                  downloads.retry(currentTrack);
                }}
              >
                <DownloadIcon size={18} />
                Réessayer
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Full UI */}
      {!isMiniPlayer && (
        <div
          style={{
            display: 'flex',
            // La barre du lecteur est fixée en bas : on lui réserve sa hauteur
            // pour que le bas de la navigation (Paramètres) reste atteignable.
            height: `calc(100vh - ${TITLE_BAR_HEIGHT}px - ${currentTrack ? PLAYER_HEIGHT : 0}px)`,
            marginTop: `${TITLE_BAR_HEIGHT}px`,
            boxSizing: 'border-box',
            minWidth: 0,
            transition: 'height var(--dur-med) var(--ease-out)'
          }}
        >
          <Sidebar
            activeTab={activeTab}
            compact={sidebarCompact}
            counts={{ favorites: favorites.length, downloads: downloadsLibrary.count, playlists: playlists.length }}
            onCreatePlaylist={() => {
              setActiveTab('playlists');
              setPlaylistCreateRequest((n) => n + 1);
            }}
            onSelect={(key) => {
              setActiveTab(key);
              if (key === 'downloads') loadDownloadedLibrary();
            }}
          />

          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
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
              padding: '10px clamp(16px, 3vw, 34px) 40px',
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
                crossfadeSeconds={crossfadeSeconds} setCrossfadeSeconds={handleCrossfadeChange}
                autoRepair={autoRepair} setAutoRepair={handleAutoRepairChange}
                showNotifications={showNotifications} setShowNotifications={handleNotificationsChange}
                downloadsLibrary={downloadsLibrary}
                onClearRecent={clearRecentTracks}
                onClearSearchHistory={clearSearchHistory}
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
                onPlay={(track, index, list) => playTrack(track, index, list, 'Accueil')}
                onNavigateSearch={() => setActiveTab('search')}
                onNavigateFavorites={() => setActiveTab('favorites')}
                onNavigateDownloads={() => { setActiveTab('downloads'); loadDownloadedLibrary(); }}
                onNavigateLocal={() => setActiveTab('local')}
              />
            ) : activeTab === 'search' && searchSubView === 'artist' ? (
              <ArtistProfileView
                {...trackListCommonProps}
                profile={artistProfile}
                tracks={artistProfileTracks}
                loading={artistProfileLoading}
                onBack={() => {
                  setSearchSubView('list');
                  setArtistProfile(null);
                  setArtistProfileTracks([]);
                }}
                onPlay={(track, index, list) =>
                  playTrack(track, index, list, artistProfile?.username ? `Artiste · ${artistProfile.username}` : 'Artiste')
                }
                onOpenArtistFromTrack={openArtistFromTrack}
              />
            ) : activeTab === 'search' ? (
              <SearchResults
                query={searchQuery}
                loading={isLoading}
                tracks={tracks}
                artists={searchArtists}
                filter={searchFilter}
                onFilterChange={setSearchFilter}
                currentTrack={currentTrack}
                isAudioPlaying={isAudioPlaying}
                favorites={favorites}
                toggleFavorite={toggleFavorite}
                onQueueLast={(track) => enqueue(track)}
                onOpenArtist={openArtistProfile}
                onPlay={(track, index, list) => playTrack(track, index, list, `Recherche · ${searchQuery}`)}
              />
            ) : activeTab === 'local' ? (
              <CollectionView
                kicker="Depuis ton disque"
                title="Fichiers locaux"
                description="Des fichiers audio lus directement depuis ton disque, sans passer par SoundCloud."
                icon={FolderOpen}
                tint="linear-gradient(140deg, #5e5ce6, #0a84ff)"
                tracks={localLibraryTracks}
                currentTrack={currentTrack}
                isAudioPlaying={isAudioPlaying}
                favorites={favorites}
                toggleFavorite={toggleFavorite}
                onQueueLast={(t) => enqueue(t)}
                onPlay={(track, index, list) => playTrack(track, index, list, 'Fichiers locaux')}
                onShuffle={() => shufflePlay(localLibraryTracks, 'Fichiers locaux')}
                emptyTitle="Aucun fichier importé"
                emptyHint="Utilise « Ajouter des fichiers » pour construire ta bibliothèque locale."
                actions={
                  <button type="button" className="btn-pill" onClick={handleImportLocalFiles}>
                    <FolderPlus size={16} /> Ajouter des fichiers
                  </button>
                }
              />
            ) : activeTab === 'playlists' ? (
              <PlaylistsView
                {...trackListCommonProps}
                playlists={playlists}
                onCreatePlaylist={handleCreatePlaylist}
                onDeletePlaylist={handleDeletePlaylist}
                onPlayPlaylist={(pl) => playTrack(pl.tracks[0], 0, pl.tracks, `Playlist · ${pl.name}`)}
                onPlayTrack={playTrack}
                onShufflePlaylist={(pl) => shufflePlay(pl.tracks, `Playlist · ${pl.name}`)}
                onRemoveFromPlaylist={removeFromPlaylist}
                createRequest={playlistCreateRequest}
                onQueueLast={(t) => enqueue(t)}
              />
            ) : activeTab === 'downloads' ? (
              downloadsLoading ? (
                <TrackListSkeleton rows={5} />
              ) : (
                <CollectionView
                  kicker="Disponible hors connexion"
                  title="Téléchargements"
                  icon={DownloadIcon}
                  tint="linear-gradient(140deg, #30d158, #0a84ff)"
                  tracks={downloadsLibrary.tracks}
                  currentTrack={currentTrack}
                  isAudioPlaying={isAudioPlaying}
                  favorites={favorites}
                  toggleFavorite={toggleFavorite}
                  onQueueLast={(t) => enqueue(t)}
                  onRemoveTrack={handleDeleteDownloadedTrack}
                  removeLabel="Supprimer le téléchargement"
                  onPlay={(track, index, list) => playTrack(track, index, list, 'Téléchargements')}
                  onShuffle={() => shufflePlay(downloadsLibrary.tracks, 'Téléchargements')}
                  emptyTitle="Aucun son téléchargé"
                  emptyHint="Les titres que tu gardes en local apparaîtront ici."
                />
              )
            ) : activeTab === 'favorites' ? (
              <CollectionView
                kicker="Ta collection"
                title="Titres likés"
                icon={Heart}
                tint="linear-gradient(140deg, #ff375f, #5e5ce6)"
                tracks={favorites}
                currentTrack={currentTrack}
                isAudioPlaying={isAudioPlaying}
                favorites={favorites}
                toggleFavorite={toggleFavorite}
                onQueueLast={(t) => enqueue(t)}
                onDownload={downloads.start}
                downloadStates={downloads.downloads}
                showDownload
                onPlay={(track, index, list) => playTrack(track, index, list, 'Favoris')}
                onShuffle={() => shufflePlay(favorites, 'Favoris')}
                emptyTitle="Aucun favori"
                emptyHint="Appuie sur le cœur d'un titre pour le retrouver ici."
              />
            ) : null}

            {/* JamView reste monté : démonter couperait la connexion MQTT. */}
            <div style={{ display: activeTab === 'jam' ? 'block' : 'none' }}>
              <JamView
                currentTrack={currentTrack}
                isAudioPlaying={isAudioPlaying}
                onPlayTrack={playTrack}
                onJamSync={handleJamSync}
                playbackPosition={playbackPosition}
                username={jamUsername}
                onSetUsername={handleSetJamUsername}
              />
            </div>
            </main>
          </div>
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

      <QueueView
        open={showQueue}
        onClose={() => setShowQueue(false)}
        topOffset={TITLE_BAR_HEIGHT}
        bottomOffset={currentTrack && !isMiniPlayer ? PLAYER_HEIGHT : 0}
        currentTrack={currentTrack}
        isAudioPlaying={isAudioPlaying}
        queue={queue}
        upNext={upNext}
        contextLabel={contextLabel ? `Ensuite · ${contextLabel}` : 'Ensuite'}
        onPlayQueued={playQueuedAt}
        onRemoveQueued={removeFromQueue}
        onClearQueue={() => setQueue([])}
        onPlayUpNext={(index) => playTrack(playlistContext[index], index, playlistContext, contextLabel)}
      />

      <DownloadToasts
        downloads={showNotifications ? downloads.downloads : {}}
        onRetry={(entry) => downloads.retry(entry)}
        onDismiss={downloads.dismiss}
        bottomOffset={currentTrack && !isMiniPlayer ? 118 : 24}
      />

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
        crossfadeSeconds={crossfadeSeconds}
        onPlaybackChange={setIsAudioPlaying}
        onOpenArtist={openArtistFromTrack}
        onPositionUpdate={handlePositionUpdate}
        controlsRef={playerControlsRef}
        resumeAt={resumeAt}
        shuffle={shuffle}
        onToggleShuffle={toggleShuffle}
        repeatMode={repeatMode}
        onCycleRepeat={cycleRepeat}
        queueCount={queue.length}
        onToggleQueue={() => setShowQueue((v) => !v)}
        isRepairing={currentTrack ? downloads.isDownloading(currentTrack.id) : false}
        titleBarOffset={TITLE_BAR_HEIGHT}
      />
    </div>
  );
}
