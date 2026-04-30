import { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Heart, Minimize2, Maximize2, Image as ImageIcon, Repeat } from 'lucide-react';

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
  onPlaybackChange
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  
  const audioARef = useRef(null);
  const audioBRef = useRef(null);
  const [activeDeck, setActiveDeck] = useState('A');
  
  const gainARef = useRef(null);
  const gainBRef = useRef(null);
  
  const audioCtxRef = useRef(null);
  const filtersRef = useRef([]);
  const reverbWetGainRef = useRef(null);
  const reverbDryGainRef = useRef(null);
  const sourceConnected = useRef(false);
  
  const requestRef = useRef();
  const isDraggingRef = useRef(false);

  const getActiveAudio = () => activeDeck === 'A' ? audioARef.current : audioBRef.current;

  const updateProgress = () => {
    const audio = getActiveAudio();
    if (audio && currentTrack) {
      const current = audio.currentTime;
      const durationSec = currentTrack.duration / 1000;
      
      if (!isDraggingRef.current) {
        setProgress((current / durationSec) * 100 || 0);
      }
      
      if (djMode && !isLooping && durationSec > 10) {
          if (current >= durationSec - 3.0 && audio.dataset.fading !== "true") {
              audio.dataset.fading = "true";
              onNext();
          }
      }
    }
    if (audio && !audio.paused) {
      requestRef.current = requestAnimationFrame(updateProgress);
    }
  };

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
      if (isPlaying) {
        audio.pause();
        cancelAnimationFrame(requestRef.current);
      } else {
        audio.play();
        requestRef.current = requestAnimationFrame(updateProgress);
      }
      setIsPlaying(!isPlaying);
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

  useEffect(() => {
    if (!currentTrack) {
      [audioARef.current, audioBRef.current].forEach((audio) => {
        if (!audio) return;
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      });
      setIsPlaying(false);
      setProgress(0);
      return;
    }

    if (!audioCtxRef.current) return;
    
    setIsPlaying(true);
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();

    // Use localPath if available, otherwise SoundCloud proxy
    // Ensure the URL is correctly formed for the proxy
    const finalUrl = currentTrack.localPath 
      ? `http://127.0.0.1:3006/?url=${encodeURIComponent('file://' + currentTrack.localPath)}`
      : `http://127.0.0.1:3006/?url=${encodeURIComponent(currentTrack.url)}`;

    const streamUrl = finalUrl;
    const newDeck = activeDeck === 'A' ? 'B' : 'A';
    const activeAudio = activeDeck === 'A' ? audioARef.current : audioBRef.current;
    const nextAudio = activeDeck === 'A' ? audioBRef.current : audioARef.current;
    
    const activeGain = activeDeck === 'A' ? gainARef.current : gainBRef.current;
    const nextGain = activeDeck === 'A' ? gainBRef.current : gainARef.current;

    // Detect if this is an automatic transition (DJ mode triggers at 3 seconds before end)
    const isAutomaticTransition = activeAudio && activeAudio.dataset.fading === "true";

    if (djMode && isAutomaticTransition) {
      nextAudio.src = streamUrl;
      nextAudio.dataset.fading = "false";
      nextAudio.play().catch(() => {});
      
      nextGain.gain.setValueAtTime(0, audioCtxRef.current.currentTime);
      nextGain.gain.linearRampToValueAtTime(1, audioCtxRef.current.currentTime + 3);
      
      if (activeAudio && !activeAudio.paused) {
        activeGain.gain.setValueAtTime(1, audioCtxRef.current.currentTime);
        activeGain.gain.linearRampToValueAtTime(0, audioCtxRef.current.currentTime + 3);
        setTimeout(() => {
          activeAudio.pause();
          activeAudio.removeAttribute('src');
        }, 3000);
      }
    } else {
      if (activeAudio) {
        activeAudio.pause();
        activeAudio.removeAttribute('src');
      }
      nextAudio.src = streamUrl;
      nextAudio.dataset.fading = "false";
      nextAudio.play().catch(() => {});
      nextGain.gain.setValueAtTime(1, audioCtxRef.current.currentTime);
      activeGain.gain.setValueAtTime(0, audioCtxRef.current.currentTime);
    }
    
    setActiveDeck(newDeck);
  }, [currentTrack]);

  useEffect(() => {
    onPlaybackChange?.(isPlaying);
  }, [isPlaying, onPlaybackChange]);

  const togglePlay = () => togglePlayRef.current();

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
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

  const handleEnded = () => {
    if (isLooping) {
      const audio = getActiveAudio();
      audio.currentTime = 0;
      audio.play();
    } else if (!djMode) {
      onNext();
    }
  };

  const isFav = currentTrack ? (favorites || []).find(f => f.id === currentTrack.id) : false;

  const renderProgressBar = () => (
    <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '10px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
      <span style={{ width: '40px', textAlign: 'right' }}>{getActiveAudio() ? formatTime(getActiveAudio().currentTime) : '0:00'}</span>
      <input 
        type="range" min="0" max="100" step="any" value={progress} 
        onPointerDown={() => { isDraggingRef.current = true; }}
        onPointerUp={() => { isDraggingRef.current = false; }}
        onChange={(e) => {
          const val = parseFloat(e.target.value);
          setProgress(val);
          const audio = getActiveAudio();
          if (audio && currentTrack) {
            audio.currentTime = (val / 100) * (currentTrack.duration / 1000);
          }
        }}
        style={{ flex: 1, height: '4px', appearance: 'none', background: 'var(--surface-color)', borderRadius: '2px', cursor: 'pointer' }} 
      />
      <span style={{ width: '40px' }}>{formatTime(currentTrack ? currentTrack.duration / 1000 : 0)}</span>
    </div>
  );

  return (
    <>
      <audio ref={audioARef} onEnded={handleEnded} onError={onError} crossOrigin="anonymous" />
      <audio ref={audioBRef} onEnded={handleEnded} onError={onError} crossOrigin="anonymous" />

      {currentTrack && isMini && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', WebkitAppRegion: 'no-drag', zIndex: 100 }}>
          <h4 className="truncate" style={{ margin: '0 0 5px 0', fontSize: '1rem', fontWeight: 600, width: '100%', textAlign: 'center' }}>{currentTrack.title}</h4>
          <p className="truncate" style={{ margin: '0 0 15px 0', fontSize: '0.85rem', color: 'var(--text-secondary)', width: '100%', textAlign: 'center' }}>{currentTrack.artist}</p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '15px' }}>
            <button onClick={onPrev} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><SkipBack size={20} /></button>
            <button onClick={togglePlay} style={{ background: 'var(--text-primary)', border: 'none', color: 'var(--bg-color)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" style={{ marginLeft: '3px' }} />}
            </button>
            <button onClick={onNext} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><SkipForward size={20} /></button>
          </div>

          {renderProgressBar()}

          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: '15px' }}>
            <button onClick={(e) => toggleFavorite(currentTrack, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isFav ? 'var(--accent-color)' : 'var(--text-secondary)' }}>
              <Heart size={20} fill={isFav ? "currentColor" : "none"} />
            </button>
            <button onClick={() => setIsLooping(!isLooping)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isLooping ? 'var(--accent-color)' : 'var(--text-secondary)' }}>
              <Repeat size={18} />
            </button>
            <button onClick={toggleMiniPlayer} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
              <Maximize2 size={20} />
            </button>
          </div>
        </div>
      )}

      {currentTrack && !isMini && (
        <div className="glass-panel" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 50, WebkitAppRegion: 'no-drag' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', width: '30%', flexShrink: 0 }}>
            {currentTrack.artwork ? (
              <img src={currentTrack.artwork} alt="cover" style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div style={{ width: '60px', height: '60px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.1)', flexShrink: 0 }}></div>
            )}
            
            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
              <h4 className="truncate" style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{currentTrack.title}</h4>
              <p className="truncate" style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{currentTrack.artist}</p>
            </div>
            
            <button onClick={(e) => toggleFavorite(currentTrack, e)} style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: isFav ? 'var(--accent-color)' : 'var(--text-secondary)' }}>
              <Heart size={20} fill={isFav ? "currentColor" : "none"} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '40%', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', position: 'relative', width: '100%', justifyContent: 'center' }}>
              <button onClick={onPrev} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><SkipBack size={24} /></button>
              <button onClick={togglePlay} style={{ background: 'var(--text-primary)', border: 'none', color: 'var(--bg-color)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" style={{ marginLeft: '3px' }} />}
              </button>
              <button onClick={onNext} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><SkipForward size={24} /></button>
              <button onClick={() => setIsLooping(!isLooping)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isLooping ? 'var(--accent-color)' : 'var(--text-secondary)', position: 'absolute', right: '10%' }}>
                <Repeat size={18} />
              </button>
            </div>
            
            {renderProgressBar()}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', width: '30%', gap: '15px' }}>
            <button onClick={toggleCover} title="Afficher la Cover" style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <ImageIcon size={20} />
            </button>
            <button onClick={toggleMiniPlayer} title="Mini-Lecteur" style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <Minimize2 size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '10px' }}>
                <button onClick={toggleMute} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
                <input type="range" min="0" max="1" step="0.01" value={isMuted ? 0 : volume} onChange={handleVolumeChange} style={{ width: '80px', height: '4px', appearance: 'none', background: 'var(--surface-color)', borderRadius: '2px', cursor: 'pointer' }} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
