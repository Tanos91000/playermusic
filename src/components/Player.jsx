import { useState, useRef, useEffect } from 'react';
import {
  Play, Pause, SkipForward, SkipBack, Volume2, Volume1, VolumeX, Heart, Minimize2, Maximize2,
  Image as ImageIcon, Repeat, Repeat1, Shuffle, ListMusic, Mic2, Loader2
} from 'lucide-react';
import { TrackArtPlaceholder } from './MediaPlaceholder';
import { resolveArtistPermalinkUrl } from '../utils/soundcloudArtist';
import { formatStreamCount } from '../utils/formatPlayback';
import LyricsModal from './LyricsModal';

function prepareAudioElementForSrc(audio, url) {
  if (!audio || !url) return;
  if (url.startsWith('file:')) {
    audio.removeAttribute('crossorigin');
  } else {
    audio.crossOrigin = 'anonymous';
  }
}

async function resolvePlaybackUrl(track) {
  if (!track) return '';
  if (track.localPath) {
    try {
      const fileUrl = await window.electronAPI?.localPathToAudioUrl?.(track.localPath);
      if (typeof fileUrl === 'string' && fileUrl.startsWith('file:')) return fileUrl;
    } catch {
      /* fallback proxy */
    }
    return `http://127.0.0.1:3006/?url=${encodeURIComponent(`file://${track.localPath}`)}`;
  }
  return `http://127.0.0.1:3006/?url=${encodeURIComponent(track.url)}`;
}

function createReverbBuffer(audioCtx, duration = 2.5, decay = 2.0) {
  const sampleRate = audioCtx.sampleRate;
  const length = sampleRate * duration;
  const impulse = audioCtx.createBuffer(2, length, sampleRate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);
  for (let i = 0; i < length; i++) {
    const mult = Math.pow(1 - i / length, decay);
    left[i] = (Math.random() * 2 - 1) * mult;
    right[i] = (Math.random() * 2 - 1) * mult;
  }
  return impulse;
}

export default function Player({
  currentTrack,
  onNext,
  onManualNext,
  playbackManualEpoch,
  onPrev,
  onError,
  isMini,
  toggleMiniPlayer,
  favorites,
  toggleFavorite,
  toggleCover,
  eqBands,
  reverb,
  reverbEnabled,
  djMode,
  onPlaybackChange,
  onOpenArtist,
  onPositionUpdate,
  controlsRef,
  resumeAt = 0,
  shuffle = false,
  onToggleShuffle,
  repeatMode = 'off',
  onCycleRepeat,
  queueCount = 0,
  onToggleQueue,
  isRepairing = false
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(() => {
    const saved = parseFloat(localStorage.getItem('aura_volume'));
    return Number.isFinite(saved) ? Math.min(1, Math.max(0, saved)) : 1;
  });
  const [isMuted, setIsMuted] = useState(false);
  const isLooping = repeatMode === 'one';
  const resumeAtRef = useRef(0);
  resumeAtRef.current = resumeAt;

  const audioARef = useRef(null);
  const audioBRef = useRef(null);
  const [activeDeck, setActiveDeck] = useState('A');
  const activeDeckRef = useRef('A');

  const gainARef = useRef(null);
  const gainBRef = useRef(null);
  
  const audioCtxRef = useRef(null);
  const filtersRef = useRef([]);
  const reverbWetGainRef = useRef(null);
  const reverbDryGainRef = useRef(null);
  const sourceConnected = useRef(false);
  
  const requestRef = useRef();
  const isDraggingRef = useRef(false);
  /** Après erreur streaming : pas de auto-next tant que l'utilisateur n'a pas choisi une autre piste / suivant manuel. */
  const blockEndedAdvanceRef = useRef(false);
  /** Empêche le double-déclenchement du crossfade DJ (onNext appelé plusieurs fois). */
  const crossfadeLockRef = useRef(false);
  /** Timeout ID pour le nettoyage du deck après crossfade. */
  const crossfadeTimeoutRef = useRef(null);
  /** Interval IDs pour le fade-in/fade-out du togglePlay. */
  const fadeIntervalRef = useRef(null);

  const getActiveAudio = () => (activeDeckRef.current === 'A' ? audioARef.current : audioBRef.current);

  /**
   * Reprise après réparation automatique : la position n'est applicable qu'une
   * fois les métadonnées décodées.
   */
  const applyResumePosition = (audio) => {
    const target = resumeAtRef.current;
    if (!audio || !(target > 0)) return;
    const onMeta = () => {
      audio.removeEventListener('loadedmetadata', onMeta);
      try {
        if (Number.isFinite(audio.duration) && target < audio.duration) {
          audio.currentTime = target;
        }
      } catch {
        /* seek impossible : on repart du début */
      }
    };
    audio.addEventListener('loadedmetadata', onMeta);
  };


  /** Prefer decoded file duration so seeks match local/downloaded files (metadata ms can differ). */
  const durationSecForTrack = (audio, track) => {
    if (audio && Number.isFinite(audio.duration) && audio.duration > 0) return audio.duration;
    const metaMs = track?.duration;
    if (typeof metaMs === 'number' && metaMs > 0) return metaMs / 1000;
    return 0;
  };

  const updateProgress = () => {
    const audio = getActiveAudio();
    if (audio && currentTrack) {
      const current = audio.currentTime;
      const durationSec = durationSecForTrack(audio, currentTrack);

      if (!isDraggingRef.current && durationSec > 0) {
        setProgress((current / durationSec) * 100 || 0);
      }

      if (onPositionUpdate && durationSec > 0) {
        onPositionUpdate(current, durationSec);
      }

      if (djMode && !isLooping && !blockEndedAdvanceRef.current && !crossfadeLockRef.current && durationSec > 10) {
          if (current >= durationSec - 3.0 && audio.dataset.fading !== "true") {
              audio.dataset.fading = "true";
              crossfadeLockRef.current = true;
              onNext();
          }
      }
    }
    if (audio && !audio.paused) {
      requestRef.current = requestAnimationFrame(updateProgress);
    }
  };

  useEffect(() => {
    blockEndedAdvanceRef.current = false;
  }, [playbackManualEpoch]);

  useEffect(() => {
    if (isPlaying) {
      requestRef.current = requestAnimationFrame(updateProgress);
    } else if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [isPlaying, currentTrack, activeDeck, djMode]);

  useEffect(() => {
    if (audioARef.current && audioBRef.current && !audioCtxRef.current && !sourceConnected.current) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtxRef.current = new AudioContext();
        
        const sourceA = audioCtxRef.current.createMediaElementSource(audioARef.current);
        const sourceB = audioCtxRef.current.createMediaElementSource(audioBRef.current);
        
        gainARef.current = audioCtxRef.current.createGain();
        gainBRef.current = audioCtxRef.current.createGain();
        
        sourceA.connect(gainARef.current);
        sourceB.connect(gainBRef.current);

        const mixer = audioCtxRef.current.createGain();
        gainARef.current.connect(mixer);
        gainBRef.current.connect(mixer);
        
        const freqs = [60, 230, 910, 3600, 14000];
        filtersRef.current = freqs.map((freq, i) => {
          const filter = audioCtxRef.current.createBiquadFilter();
          filter.type = i === 0 ? 'lowshelf' : i === freqs.length - 1 ? 'highshelf' : 'peaking';
          filter.frequency.value = freq;
          return filter;
        });

        const compressor = audioCtxRef.current.createDynamicsCompressor();
        compressor.threshold.value = -2;
        compressor.ratio.value = 20;

        const convolver = audioCtxRef.current.createConvolver();
        convolver.buffer = createReverbBuffer(audioCtxRef.current);
        
        reverbDryGainRef.current = audioCtxRef.current.createGain();
        reverbWetGainRef.current = audioCtxRef.current.createGain();
        reverbWetGainRef.current.gain.value = 0;
        
        mixer.connect(filtersRef.current[0]);
        for (let i = 0; i < filtersRef.current.length - 1; i++) {
          filtersRef.current[i].connect(filtersRef.current[i + 1]);
        }
        filtersRef.current[filtersRef.current.length - 1].connect(compressor);
        
        compressor.connect(reverbDryGainRef.current);
        compressor.connect(convolver);
        convolver.connect(reverbWetGainRef.current);
        
        reverbDryGainRef.current.connect(audioCtxRef.current.destination);
        reverbWetGainRef.current.connect(audioCtxRef.current.destination);
        
        sourceConnected.current = true;
      } catch (err) {}
    }
  }, []);

  useEffect(() => {
    if (filtersRef.current.length > 0 && audioCtxRef.current) {
      (eqBands || [0,0,0,0,0]).forEach((gain, index) => {
        if (filtersRef.current[index]) {
          filtersRef.current[index].gain.setTargetAtTime(gain, audioCtxRef.current.currentTime, 0.1);
        }
      });
    }
  }, [eqBands]);

  useEffect(() => {
    if (reverbWetGainRef.current && reverbDryGainRef.current && audioCtxRef.current) {
      const wet = reverbEnabled ? reverb : 0;
      const dry = reverbEnabled ? 1 - (reverb * 0.5) : 1;
      reverbWetGainRef.current.gain.setTargetAtTime(wet, audioCtxRef.current.currentTime, 0.1);
      reverbDryGainRef.current.gain.setTargetAtTime(dry, audioCtxRef.current.currentTime, 0.1);
    }
  }, [reverb, reverbEnabled]);

  const togglePlayRef = useRef();
  togglePlayRef.current = () => {
    const audio = getActiveAudio();
    if (audio) {
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
      
      const targetVol = isMuted ? 0 : volume;
      const fadeStep = 0.05;
      const fadeIntervalMs = 10;
      
      // Nettoie tout interval de fade précédent pour éviter les fuites
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
        fadeIntervalRef.current = null;
      }
      
      if (isPlaying) {
        setIsPlaying(false);
        cancelAnimationFrame(requestRef.current);
        
        let v = audio.volume;
        fadeIntervalRef.current = setInterval(() => {
          v = Math.max(0, v - fadeStep);
          audio.volume = v;
          if (v <= 0) {
            clearInterval(fadeIntervalRef.current);
            fadeIntervalRef.current = null;
            audio.pause();
            audio.volume = targetVol; // Restore for next play
          }
        }, fadeIntervalMs);
      } else {
        setIsPlaying(true);
        requestRef.current = requestAnimationFrame(updateProgress);
        
        audio.volume = 0;
        audio.play().then(() => {
          let v = 0;
          fadeIntervalRef.current = setInterval(() => {
            v = Math.min(targetVol, v + fadeStep);
            audio.volume = v;
            if (v >= targetVol) {
              clearInterval(fadeIntervalRef.current);
              fadeIntervalRef.current = null;
            }
          }, fadeIntervalMs);
        }).catch(err => {
          console.error("Play failed", err);
          setIsPlaying(false);
          audio.volume = targetVol;
          if (fadeIntervalRef.current) {
            clearInterval(fadeIntervalRef.current);
            fadeIntervalRef.current = null;
          }
        });
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        togglePlayRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const currentTrackRef = useRef(currentTrack);
  currentTrackRef.current = currentTrack;

  /** Contrôles exposés au parent : touches média, raccourcis clavier, « précédent » intelligent. */
  useEffect(() => {
    if (!controlsRef) return undefined;

    const seekTo = (seconds) => {
      const audio = getActiveAudio();
      const duration = durationSecForTrack(audio, currentTrackRef.current);
      if (!audio || !(duration > 0)) return;
      const clamped = Math.min(Math.max(0, seconds), duration - 0.25);
      audio.currentTime = clamped;
      setProgress((clamped / duration) * 100);
    };

    controlsRef.current = {
      togglePlay: () => togglePlayRef.current(),
      pause: () => {
        const audio = getActiveAudio();
        if (audio && !audio.paused) togglePlayRef.current();
      },
      seek: seekTo,
      nudge: (delta) => {
        const audio = getActiveAudio();
        if (!audio) return;
        seekTo(audio.currentTime + delta);
      },
      getPosition: () => getActiveAudio()?.currentTime ?? 0
    };

    return () => {
      controlsRef.current = null;
    };
  }, [controlsRef]);

  useEffect(() => {
    // Nettoie le timeout de crossfade précédent quand on change de piste
    if (crossfadeTimeoutRef.current) {
      clearTimeout(crossfadeTimeoutRef.current);
      crossfadeTimeoutRef.current = null;
    }
    crossfadeLockRef.current = false;

    if (!currentTrack) {
      [audioARef.current, audioBRef.current].forEach((audio) => {
        if (!audio) return;
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      });
      setIsPlaying(false);
      setProgress(0);
      blockEndedAdvanceRef.current = false;
      activeDeckRef.current = 'A';
      setActiveDeck('A');
      return;
    }

    if (!audioCtxRef.current) return;

    let cancelled = false;

    (async () => {
      const streamUrl = await resolvePlaybackUrl(currentTrack);
      if (cancelled) return;

      setIsPlaying(true);
      if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();

      // Toujours utiliser le ref pour la cohérence (pas le state qui peut être stale)
      const previousDeck = activeDeckRef.current;
      const newDeck = previousDeck === 'A' ? 'B' : 'A';
      activeDeckRef.current = newDeck;

      const activeAudio = previousDeck === 'A' ? audioARef.current : audioBRef.current;
      const nextAudio = previousDeck === 'A' ? audioBRef.current : audioARef.current;

      const activeGain = previousDeck === 'A' ? gainARef.current : gainBRef.current;
      const nextGain = previousDeck === 'A' ? gainBRef.current : gainARef.current;

      const isAutomaticTransition = djMode && activeAudio && activeAudio.dataset.fading === "true";

      if (isAutomaticTransition) {
        prepareAudioElementForSrc(nextAudio, streamUrl);
        nextAudio.src = streamUrl;
        nextAudio.dataset.fading = "false";
        nextAudio.volume = isMuted ? 0 : volume;
        nextAudio.play().catch(() => {});

        // Récupérer le currentTime AVANT de planifier les ramps (évite les races après resume())
        const now = audioCtxRef.current.currentTime;
        nextGain.gain.setValueAtTime(0, now);
        nextGain.gain.linearRampToValueAtTime(1, now + 3);

        if (activeAudio && !activeAudio.paused) {
          activeGain.gain.setValueAtTime(1, now);
          activeGain.gain.linearRampToValueAtTime(0, now + 3);
          // Capture les références pour le timeout pour éviter de manipuler le mauvais audio
          const prevAudio = activeAudio;
          crossfadeTimeoutRef.current = setTimeout(() => {
            crossfadeTimeoutRef.current = null;
            if (prevAudio) {
              prevAudio.pause();
              prevAudio.removeAttribute('src');
            }
          }, 3000);
        }
      } else {
        if (activeAudio) {
          activeAudio.pause();
          activeAudio.removeAttribute('src');
        }
        prepareAudioElementForSrc(nextAudio, streamUrl);
        nextAudio.src = streamUrl;
        nextAudio.dataset.fading = "false";
        nextAudio.volume = isMuted ? 0 : volume;
        applyResumePosition(nextAudio);
        nextAudio.play().catch(() => {});
        // Planifier les gains après resume() potentiel
        const now = audioCtxRef.current.currentTime;
        nextGain.gain.setValueAtTime(1, now);
        activeGain.gain.setValueAtTime(0, now);
      }

      if (cancelled) return;
      setActiveDeck(newDeck);
    })();

    return () => {
      cancelled = true;
    };
  }, [currentTrack]);

  useEffect(() => {
    onPlaybackChange?.(isPlaying);
  }, [isPlaying, onPlaybackChange]);

  /** Le volume restauré (localStorage) doit s'appliquer aux deux platines. */
  useEffect(() => {
    const level = isMuted ? 0 : volume;
    if (audioARef.current) audioARef.current.volume = level;
    if (audioBRef.current) audioBRef.current.volume = level;
  }, [volume, isMuted]);

  const togglePlay = () => togglePlayRef.current();

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    localStorage.setItem('aura_volume', String(val));
    if (audioARef.current) audioARef.current.volume = val;
    if (audioBRef.current) audioBRef.current.volume = val;
    setIsMuted(val === 0);
  };

  const toggleMute = () => {
    const vol = isMuted ? (volume || 1) : 0;
    if (audioARef.current) audioARef.current.volume = vol;
    if (audioBRef.current) audioBRef.current.volume = vol;
    setIsMuted(!isMuted);
  };

  const formatTime = (time) => {
    if (!time || isNaN(time)) return '0:00';
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleAudioError = (e) => {
    const activeEl = getActiveAudio();
    if (!activeEl || e.target !== activeEl) return;
    blockEndedAdvanceRef.current = true;
    activeEl.pause();
    setIsPlaying(false);
    onError?.();
  };

  const handleEnded = (e) => {
    const activeEl = getActiveAudio();
    if (!activeEl || e.target !== activeEl) return;
    if (blockEndedAdvanceRef.current) return;
    if (activeEl.error != null) return;
    const dur = durationSecForTrack(activeEl, currentTrack);
    // Ignore bogus immediate `ended` (often after failed stream / teardown) while metadata duration looks long.
    if (Number.isFinite(dur) && dur > 8 && activeEl.currentTime < 0.5) return;
    if (isLooping) {
      const audio = getActiveAudio();
      audio.currentTime = 0;
      audio.play();
    } else if (!djMode) {
      onNext();
    }
  };

  const skipForward = onManualNext ?? onNext;

  const isFav = currentTrack ? (favorites || []).find(f => f.id === currentTrack.id) : false;
  const streamsFmt = currentTrack ? formatStreamCount(currentTrack.playbackCount) : null;
  const playbackLabel = streamsFmt != null ? `${streamsFmt} lectures` : null;

  const renderArtistLabel = (align = 'left') => {
    if (!currentTrack?.artist) return null;
    const permalink = resolveArtistPermalinkUrl(currentTrack);
    const canOpen = typeof onOpenArtist === 'function' && !!permalink;
    const color = 'var(--text-secondary)';
    const base = {
      margin: 0,
      fontSize: '0.85rem',
      color,
      width: '100%',
      textAlign: align
    };
    if (!canOpen) {
      return <p className="truncate" style={base}>{currentTrack.artist}</p>;
    }
    return (
      <button
        type="button"
        className="truncate"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onOpenArtist(currentTrack);
        }}
        title="Voir le profil"
        style={{
          ...base,
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          font: 'inherit',
          display: 'block',
          WebkitAppRegion: 'no-drag',
          position: 'relative',
          zIndex: 5,
          pointerEvents: 'auto'
        }}
      >
        {currentTrack.artist}
      </button>
    );
  };

  const renderProgressBar = () => {
    const audio = getActiveAudio();
    const durationSec = durationSecForTrack(audio, currentTrack);
    const seekFromInput = (e) => {
      const val = parseFloat(e.target.value);
      setProgress(val);
      const el = getActiveAudio();
      const dur = durationSecForTrack(el, currentTrack);
      if (el && dur > 0) el.currentTime = (val / 100) * dur;
    };

    return (
      <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '10px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
        <span style={{ width: '40px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          {audio ? formatTime(audio.currentTime) : '0:00'}
        </span>
        <input
          className="range"
          aria-label="Progression"
          type="range" min="0" max="100" step="any" value={progress}
          onPointerDown={() => { isDraggingRef.current = true; }}
          onPointerUp={() => { isDraggingRef.current = false; }}
          onInput={seekFromInput}
          onChange={seekFromInput}
          style={{ flex: 1, '--range-fill': `${Math.min(100, Math.max(0, progress))}%` }}
        />
        <span style={{ width: '40px', fontVariantNumeric: 'tabular-nums' }}>{formatTime(durationSec)}</span>
      </div>
    );
  };

  const repeatTitle = repeatMode === 'one'
    ? 'Répéter la piste'
    : repeatMode === 'all'
      ? 'Répéter la sélection'
      : 'Répétition désactivée';

  const renderTransport = (size = 24) => (
    <>
      <button type="button" className="btn-icon" onClick={onPrev} title="Précédent" aria-label="Piste précédente">
        <SkipBack size={size} />
      </button>
      <button type="button" className="btn-play" onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Lecture'}>
        {isRepairing ? (
          <Loader2 size={20} className="animate-spin" />
        ) : isPlaying ? (
          <Pause size={20} fill="currentColor" />
        ) : (
          <Play size={20} fill="currentColor" style={{ marginLeft: '3px' }} />
        )}
      </button>
      <button type="button" className="btn-icon" onClick={skipForward} title="Suivant" aria-label="Piste suivante">
        <SkipForward size={size} />
      </button>
    </>
  );

  const renderShuffleButton = (size = 18) => (
    <button
      type="button"
      className={`btn-icon${shuffle ? ' is-active' : ''}`}
      onClick={onToggleShuffle}
      title={shuffle ? 'Lecture aléatoire activée' : 'Lecture aléatoire'}
      aria-pressed={shuffle}
    >
      <Shuffle size={size} />
    </button>
  );

  const renderRepeatButton = (size = 18) => (
    <button
      type="button"
      className={`btn-icon${repeatMode !== 'off' ? ' is-active' : ''}`}
      onClick={onCycleRepeat}
      title={repeatTitle}
    >
      {repeatMode === 'one' ? <Repeat1 size={size} /> : <Repeat size={size} />}
    </button>
  );

  return (
    <>
      <audio ref={audioARef} onEnded={handleEnded} onError={handleAudioError} />
      <audio ref={audioBRef} onEnded={handleEnded} onError={handleAudioError} />

      {currentTrack && isMini && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '18px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', background: 'linear-gradient(180deg, #0b0b0e 0%, #000000 100%)', borderTop: '1px solid var(--border-color)', WebkitAppRegion: 'no-drag', zIndex: 100, pointerEvents: 'auto', transform: 'translateZ(0)' }}>
          <h4 className="truncate" style={{ margin: '0 0 5px 0', fontSize: '1rem', fontWeight: 600, width: '100%', textAlign: 'center' }}>{currentTrack.title}</h4>
          <div style={{ margin: '0 0 15px 0', width: '100%', WebkitAppRegion: 'no-drag', position: 'relative', zIndex: 5, pointerEvents: 'auto' }}>
            {renderArtistLabel('center')}
            {playbackLabel ? (
              <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)', width: '100%', textAlign: 'center' }} title="Lectures SoundCloud">
                {playbackLabel}
              </p>
            ) : null}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '15px' }}>
            {renderTransport(20)}
          </div>

          {renderProgressBar()}

          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: '10px' }}>
            <button
              type="button"
              className={`btn-icon${isFav ? ' is-active' : ''}`}
              onClick={(e) => toggleFavorite(currentTrack, e)}
              title="Favori"
            >
              <Heart size={20} fill={isFav ? 'currentColor' : 'none'} />
            </button>
            {renderShuffleButton(18)}
            {renderRepeatButton(18)}
            <button type="button" className="btn-icon" onClick={toggleMiniPlayer} title="Agrandir">
              <Maximize2 size={20} />
            </button>
          </div>
        </div>
      )}

      {currentTrack && !isMini && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(180deg, #0b0b0e 0%, #000000 100%)',
            borderTop: '1px solid var(--border-color)',
            boxShadow: '0 -12px 40px rgba(0,0,0,0.55)',
            zIndex: 50,
            WebkitAppRegion: 'no-drag',
            pointerEvents: 'auto',
            transform: 'translateZ(0)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', width: '30%', flexShrink: 0 }}>
            <button
              type="button"
              onClick={toggleCover}
              title="Afficher la pochette"
              style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', flexShrink: 0, borderRadius: '8px' }}
              className="card-hover"
            >
              {currentTrack.artwork ? (
                <img
                  src={currentTrack.artwork}
                  alt="cover"
                  style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <TrackArtPlaceholder size={60} radius={8} />
              )}
            </button>

            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', WebkitAppRegion: 'no-drag', position: 'relative', zIndex: 5, pointerEvents: 'auto' }}>
              <h4 className="truncate" style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{currentTrack.title}</h4>
              {renderArtistLabel('left')}
              {playbackLabel ? (
                <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }} title="Lectures SoundCloud">
                  {playbackLabel}
                </p>
              ) : null}
            </div>
            
            <button
              type="button"
              className={`btn-icon${isFav ? ' is-active' : ''}`}
              onClick={(e) => toggleFavorite(currentTrack, e)}
              title={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              style={{ flexShrink: 0 }}
            >
              <Heart size={20} fill={isFav ? 'currentColor' : 'none'} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '40%', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', justifyContent: 'center' }}>
              {renderShuffleButton(18)}
              {renderTransport(24)}
              {renderRepeatButton(18)}
            </div>

            {renderProgressBar()}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', width: '30%', gap: '4px' }}>
            <button
              type="button"
              className={`btn-icon${showLyrics ? ' is-active' : ''}`}
              onClick={() => setShowLyrics(!showLyrics)}
              title="Paroles"
            >
              <Mic2 size={20} />
            </button>

            <button
              type="button"
              className="btn-icon"
              onClick={onToggleQueue}
              title="File d'attente"
              style={{ position: 'relative' }}
            >
              <ListMusic size={20} />
              {queueCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    minWidth: '16px',
                    height: '16px',
                    padding: '0 4px',
                    borderRadius: 'var(--radius-pill)',
                    background: 'var(--accent-color)',
                    color: '#fff',
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {queueCount > 9 ? '9+' : queueCount}
                </span>
              )}
            </button>

            <button type="button" className="btn-icon" onClick={toggleCover} title="Afficher la pochette">
              <ImageIcon size={20} />
            </button>
            <button type="button" className="btn-icon" onClick={toggleMiniPlayer} title="Mini-lecteur">
              <Minimize2 size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '6px' }}>
              <button type="button" className="btn-icon" onClick={toggleMute} title={isMuted ? 'Réactiver le son' : 'Couper le son'}>
                {isMuted || volume === 0 ? <VolumeX size={20} /> : volume < 0.5 ? <Volume1 size={20} /> : <Volume2 size={20} />}
              </button>
              <input
                className="range range--slim"
                aria-label="Volume"
                type="range" min="0" max="1" step="0.01"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                style={{ width: '84px', '--range-fill': `${(isMuted ? 0 : volume) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}
      {showLyrics && currentTrack && (
        <LyricsModal 
          track={currentTrack} 
          currentTime={getActiveAudio()?.currentTime || 0} 
          onClose={() => setShowLyrics(false)} 
        />
      )}
    </>
  );
}
