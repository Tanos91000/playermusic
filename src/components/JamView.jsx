import React, { useState, useEffect, useRef, useCallback } from 'react';
import mqtt from 'mqtt';
import { Users, Play, Music, User, Copy, Wifi, WifiOff, Crown, Radio, LogOut, ArrowRight } from 'lucide-react';
import { TrackArtPlaceholder } from './MediaPlaceholder';

const BROKER_URL = 'wss://broker.emqx.io:8084/mqtt';
const TOPIC_PREFIX = 'playermusic_jam_v2';
const HOST_PUBLISH_MS = 500;
const PEER_TIMEOUT_MS = 15000;
const LISTENER_PRESENCE_MS = 8000;

function makeSessionId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function topicHost(sessionId) { return `${TOPIC_PREFIX}/${sessionId}/host`; }
function topicListener(sessionId, peerId) { return `${TOPIC_PREFIX}/${sessionId}/listener/${peerId}`; }
function topicAllListeners(sessionId) { return `${TOPIC_PREFIX}/${sessionId}/listener/+`; }

export default function JamView({ 
  currentTrack, 
  isAudioPlaying, 
  onPlayTrack,
  onJamSync,
  playbackPosition,
  username,
  onSetUsername
}) {
  // ---- Session state ----
  const [role, setRole] = useState(null); // null | 'host' | 'listener'
  const [sessionId, setSessionId] = useState(null);
  const [joinCode, setJoinCode] = useState('');
  const [inputName, setInputName] = useState(username || '');
  const [isConnected, setIsConnected] = useState(false);
  const [copiedLabel, setCopiedLabel] = useState(false);
  
  // ---- Peers ----
  const [hostPeer, setHostPeer] = useState(null); // used by listeners
  const [listeners, setListeners] = useState({});
  
  // ---- Refs ----
  const clientRef = useRef(null);
  const myIdRef = useRef(Math.random().toString(36).substring(2, 10));
  const hostPublishTimerRef = useRef(null);
  const presenceTimerRef = useRef(null);
  const sessionRef = useRef(null); // { sessionId, role }
  const lastHostStateRef = useRef(null);

  // ---- Cleanup all timers & MQTT ----
  const disconnect = useCallback(() => {
    if (hostPublishTimerRef.current) { clearInterval(hostPublishTimerRef.current); hostPublishTimerRef.current = null; }
    if (presenceTimerRef.current) { clearInterval(presenceTimerRef.current); presenceTimerRef.current = null; }
    const c = clientRef.current;
    if (c && !c.disconnected && !c.reconnecting) {
      try {
        const sid = sessionRef.current?.sessionId;
        if (sid) {
          c.publish(topicHost(sid), '', { retain: true });
          c.publish(topicListener(sid, myIdRef.current), '', { retain: true });
        }
      } catch {}
      try { c.end(true); } catch {}
    }
    clientRef.current = null;
    sessionRef.current = null;
    setSessionId(null);
    setRole(null);
    setHostPeer(null);
    setListeners({});
    setIsConnected(false);
  }, []);

  // ---- Publish host state ----
  const publishHostState = useCallback(() => {
    const c = clientRef.current;
    const sid = sessionRef.current?.sessionId;
    if (!c || !c.connected || !sid) return;
    const state = {
      type: 'host_state',
      sessionId: sid,
      hostId: myIdRef.current,
      hostUsername: username,
      track: currentTrack ? {
        id: currentTrack.id,
        title: currentTrack.title,
        artist: currentTrack.artist,
        artwork: currentTrack.artwork,
        url: currentTrack.url,
        localPath: currentTrack.localPath,
        duration: currentTrack.duration,
      } : null,
      playing: isAudioPlaying,
      position: playbackPosition || 0,
      timestamp: Date.now()
    };
    c.publish(topicHost(sid), JSON.stringify(state), { retain: true });
  }, [username, currentTrack, isAudioPlaying, playbackPosition]);

  // ---- Publish listener presence ----
  const publishPresence = useCallback(() => {
    const c = clientRef.current;
    const sid = sessionRef.current?.sessionId;
    if (!c || !c.connected || !sid) return;
    c.publish(topicListener(sid, myIdRef.current), JSON.stringify({
      type: 'listener_presence',
      sessionId: sid,
      listenerId: myIdRef.current,
      username,
      timestamp: Date.now()
    }), { retain: false });
  }, [username]);

  // ---- Start hosting ----
  const startHosting = useCallback(() => {
    disconnect();
    const sid = makeSessionId();
    sessionRef.current = { sessionId: sid, role: 'host' };
    setSessionId(sid);
    setRole('host');
  }, [disconnect]);

  // ---- Join session as listener ----
  const joinAsListener = useCallback((code) => {
    const sid = (code || '').trim().toUpperCase();
    if (!sid || sid.length < 4) return;
    disconnect();
    sessionRef.current = { sessionId: sid, role: 'listener' };
    setSessionId(sid);
    setRole('listener');
    setJoinCode('');
  }, [disconnect]);

  // ---- MQTT connection effect ----
  useEffect(() => {
    if (!sessionId || !role) return;

    const sid = sessionId;
    let cancelled = false;

    const mqttClient = mqtt.connect(BROKER_URL, {
      clientId: `aura_jam_${myIdRef.current}_${Date.now()}`,
      clean: true,
      connectTimeout: 4000,
      reconnectPeriod: 2000,
      keepalive: 10,
    });

    mqttClient.on('connect', () => {
      if (cancelled) { mqttClient.end(true); return; }
      setIsConnected(true);
      clientRef.current = mqttClient;

      if (role === 'host') {
        // Host subscribes to all listener topics
        mqttClient.subscribe(topicAllListeners(sid), (err) => {
          if (err) return;
          // Publish initial state
          publishHostState();
          // Start periodic publish
          hostPublishTimerRef.current = setInterval(() => {
            publishHostState();
          }, HOST_PUBLISH_MS);
        });
      } else {
        // Listener subscribes to host topic
        mqttClient.subscribe(topicHost(sid), (err) => {
          if (err) return;
          // Announce presence
          publishPresence();
          presenceTimerRef.current = setInterval(() => {
            publishPresence();
          }, LISTENER_PRESENCE_MS);
        });
      }
    });

    mqttClient.on('message', (topic, message) => {
      if (cancelled) return;
      try {
        const data = JSON.parse(message.toString());
        if (!data || data.sessionId !== sid) return;

        if (role === 'host' && data.type === 'listener_presence') {
          if (data.listenerId === myIdRef.current) return;
          setListeners(prev => ({
            ...prev,
            [data.listenerId]: { id: data.listenerId, username: data.username, timestamp: data.timestamp }
          }));
        } else if (role === 'listener' && data.type === 'host_state') {
          lastHostStateRef.current = data;
          setHostPeer({
            id: data.hostId,
            username: data.hostUsername || 'Host',
            track: data.track,
            playing: data.playing,
            position: data.position,
            timestamp: data.timestamp
          });
          // Notify App to sync
          if (onJamSync) {
            onJamSync({
              track: data.track,
              playing: data.playing,
              position: data.position,
              hostTimestamp: data.timestamp
            });
          }
        }
      } catch {}
    });

    mqttClient.on('close', () => {
      if (!cancelled) setIsConnected(false);
    });

    mqttClient.on('offline', () => {
      if (!cancelled) setIsConnected(false);
    });

    return () => {
      cancelled = true;
      if (hostPublishTimerRef.current) { clearInterval(hostPublishTimerRef.current); hostPublishTimerRef.current = null; }
      if (presenceTimerRef.current) { clearInterval(presenceTimerRef.current); presenceTimerRef.current = null; }
      try {
        mqttClient.publish(topicHost(sid), '', { retain: true });
        mqttClient.publish(topicListener(sid, myIdRef.current), '', { retain: true });
      } catch {}
      try { mqttClient.end(true); } catch {}
      clientRef.current = null;
    };
  }, [sessionId, role]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Cleanup stale peer data ----
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setListeners(prev => {
        const next = { ...prev };
        let changed = false;
        for (const id in next) {
          if (now - next[id].timestamp > PEER_TIMEOUT_MS) {
            delete next[id];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // ---- Copy session code ----
  const copySessionCode = () => {
    if (!sessionId) return;
    navigator.clipboard?.writeText(sessionId).catch(() => {});
    setCopiedLabel(true);
    setTimeout(() => setCopiedLabel(false), 2000);
  };

  // ---- Render: Username screen ----
  if (!username) {
    return (
      <div className="flex-center animate-fade-in" style={{ height: '70vh', flexDirection: 'column' }}>
        <div className="glass" style={{ padding: '30px', borderRadius: '20px', textAlign: 'center', maxWidth: '400px', width: '100%', boxSizing: 'border-box' }}>
          <Users size={48} color="var(--accent-color)" style={{ marginBottom: '20px' }} />
          <h2 style={{ margin: '0 0 10px', fontSize: '1.5rem' }}>Rejoindre la Jam</h2>
          <p style={{ margin: '0 0 24px', color: 'var(--text-secondary)' }}>
            Choisis un pseudo pour écouter de la musique synchronisée avec tes amis.
          </p>
          <form onSubmit={(e) => { e.preventDefault(); if (inputName.trim()) onSetUsername(inputName.trim()); }} style={{ display: 'flex', gap: '10px' }}>
            <input 
              autoFocus
              type="text" 
              placeholder="Ton pseudo..." 
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: 'none', borderRadius: '12px', padding: '12px 16px', color: 'white', outline: 'none', fontSize: '1rem' }}
            />
            <button type="submit" style={{ background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '12px', padding: '0 20px', cursor: 'pointer', fontWeight: 600 }}>C'est parti</button>
          </form>
        </div>
      </div>
    );
  }

  // ---- Render: Role selection screen ----
  if (!role) {
    return (
      <div className="flex-center animate-fade-in" style={{ height: '70vh', flexDirection: 'column' }}>
        <div className="glass" style={{ padding: '30px', borderRadius: '20px', textAlign: 'center', maxWidth: '450px', width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <Users size={48} color="var(--accent-color)" style={{ margin: '0 auto' }} />
          <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Jam Session</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Connecté en tant que <strong>{username}</strong>
          </p>
          
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={startHosting}
              style={{
                flex: 1, minWidth: '180px', padding: '20px',
                background: 'var(--accent-color)', color: 'white',
                border: 'none', borderRadius: '16px', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
                fontWeight: 600, fontSize: '1rem'
              }}
            >
              <Crown size={32} />
              <span>Créer une Jam</span>
              <span style={{ fontSize: '0.75rem', opacity: 0.8, fontWeight: 400 }}>Tu contrôles la musique</span>
            </button>
            
            <div style={{ flex: 1, minWidth: '180px', padding: '20px', background: 'rgba(255,255,255,0.05)', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
              <Radio size={32} color="var(--text-secondary)" />
              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Rejoindre une Jam</span>
              <input
                type="text"
                placeholder="Code session (ex: ABC123)"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === 'Enter' && joinCode.trim()) joinAsListener(joinCode); }}
                maxLength={6}
                style={{
                  width: '100%', textAlign: 'center', letterSpacing: '4px', fontSize: '1.2rem', fontWeight: 700,
                  background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '10px',
                  padding: '10px', color: 'white', outline: 'none', boxSizing: 'border-box'
                }}
              />
              <button
                disabled={!joinCode.trim()}
                onClick={() => joinAsListener(joinCode)}
                style={{
                  width: '100%', padding: '10px', borderRadius: '10px',
                  background: joinCode.trim() ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
                  color: joinCode.trim() ? 'white' : 'var(--text-secondary)',
                  border: 'none', cursor: joinCode.trim() ? 'pointer' : 'default',
                  fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
              >
                <ArrowRight size={16} /> Rejoindre
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Render: Active Jam session ----
  const activeListeners = Object.values(listeners).filter(p => Date.now() - p.timestamp < PEER_TIMEOUT_MS);
  
  return (
    <div className="animate-fade-in" style={{ padding: '0 10px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {role === 'host' ? <Crown size={24} color="var(--accent-color)" /> : <Radio size={24} color="var(--accent-color)" />}
        <h2 style={{ fontSize: '1.4rem', margin: 0 }}>
          {role === 'host' ? 'Tu héberges la Jam' : `Jam de ${hostPeer?.username || '...'}`}
        </h2>
        
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Connection status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: isConnected ? '#4caf50' : '#ff9800', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '20px', fontSize: '0.85rem' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'currentColor' }} />
            {isConnected ? 'Connecté' : 'Connexion...'}
          </div>
          
          {/* Session code (host only) */}
          {role === 'host' && sessionId && (
            <button
              onClick={copySessionCode}
              title="Copier le code"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'rgba(255,255,255,0.08)', border: '1px dashed var(--border-color)',
                borderRadius: '10px', padding: '6px 14px', color: 'var(--text-primary)',
                cursor: 'pointer', fontWeight: 700, fontSize: '1.1rem', letterSpacing: '3px'
              }}
            >
              {sessionId}
              <Copy size={14} color={copiedLabel ? '#4caf50' : 'var(--text-secondary)'} />
            </button>
          )}
          
          {/* Leave button */}
          <button
            onClick={disconnect}
            title="Quitter la Jam"
            style={{
              background: 'rgba(255,80,80,0.15)', border: 'none', borderRadius: '10px',
              padding: '8px 14px', color: '#ff6b6b', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600
            }}
          >
            <LogOut size={16} /> Quitter
          </button>
        </div>
      </div>
      
      {/* Now playing / Host state */}
      <div className="glass" style={{ padding: '20px', borderRadius: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {role === 'host' && currentTrack ? (
            <>
              {currentTrack.artwork ? (
                <img src={currentTrack.artwork} alt="cover" style={{ width: '64px', height: '64px', borderRadius: '12px', objectFit: 'cover' }} />
              ) : (
                <TrackArtPlaceholder size={64} radius={12} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="truncate" style={{ fontWeight: 700, fontSize: '1.1rem' }}>{currentTrack.title}</div>
                <div className="truncate" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{currentTrack.artist}</div>
                <div style={{ fontSize: '0.8rem', color: '#4caf50', marginTop: '4px', fontWeight: 600 }}>
                  {isAudioPlaying ? '▶ Lecture en cours' : '⏸ En pause'}
                </div>
              </div>
            </>
          ) : hostPeer?.track ? (
            <>
              {hostPeer.track.artwork ? (
                <img src={hostPeer.track.artwork} alt="cover" style={{ width: '64px', height: '64px', borderRadius: '12px', objectFit: 'cover' }} />
              ) : (
                <TrackArtPlaceholder size={64} radius={12} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="truncate" style={{ fontWeight: 700, fontSize: '1.1rem' }}>{hostPeer.track.title}</div>
                <div className="truncate" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{hostPeer.track.artist}</div>
                <div style={{ fontSize: '0.8rem', marginTop: '4px', fontWeight: 600, color: hostPeer.playing ? '#4caf50' : 'var(--text-secondary)' }}>
                  {hostPeer.playing ? '▶ Lecture en cours' : '⏸ En pause'}
                </div>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-secondary)' }}>
              <Music size={40} opacity={0.5} />
              <span style={{ fontSize: '1rem' }}>En attente de musique...</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Peers list */}
      <div style={{ marginBottom: '10px' }}>
        <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={18} />
          {role === 'host' ? `Auditeurs connectés (${activeListeners.length})` : `Jam (${activeListeners.length + (hostPeer ? 1 : 0)} personne(s))`}
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
          {/* Host card (for listeners) */}
          {role === 'listener' && hostPeer && (
            <div key="host" className="glass" style={{ padding: '14px', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid var(--accent-color)' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--accent-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1rem', flexShrink: 0 }}>
                <Crown size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{hostPeer.username}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--accent-color)' }}>Host</div>
              </div>
            </div>
          )}
          
          {/* Listener cards */}
          {activeListeners.map(peer => (
            <div key={peer.id} className="glass" style={{ padding: '14px', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1rem', flexShrink: 0 }}>
                {peer.username.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="truncate" style={{ fontWeight: 600, fontSize: '0.95rem' }}>{peer.username}</div>
                <div style={{ fontSize: '0.8rem', color: '#4caf50' }}>Connecté</div>
              </div>
            </div>
          ))}
          
          {activeListeners.length === 0 && role === 'host' && (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem', gridColumn: '1 / -1' }}>
              <User size={32} opacity={0.5} style={{ marginBottom: '8px', display: 'block', margin: '0 auto 8px' }} />
              Personne n'a encore rejoint. Partage le code <strong style={{ color: 'var(--text-primary)' }}>{sessionId}</strong> !
            </div>
          )}
          
          {activeListeners.length === 0 && hostPeer && role === 'listener' && (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem', gridColumn: '1 / -1' }}>
              Tu es le seul auditeur pour le moment.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}