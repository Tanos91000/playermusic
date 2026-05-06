import React, { useState, useEffect, useRef } from 'react';
import mqtt from 'mqtt';
import { Users, Play, Pause, Music, User } from 'lucide-react';
import { TrackArtPlaceholder, RemoteAvatar } from './MediaPlaceholder';

const BROKER_URL = 'wss://broker.emqx.io:8084/mqtt';
const TOPIC_BASE = 'playermusic_jam_session_v1';

export default function JamView({ 
  currentTrack, 
  isAudioPlaying, 
  onPlayTrack,
  playbackPosition,
  username,
  onSetUsername
}) {
  const [client, setClient] = useState(null);
  const [peers, setPeers] = useState({});
  const [inputName, setInputName] = useState(username || '');
  const [isConnected, setIsConnected] = useState(false);
  const myId = useRef(Math.random().toString(36).substring(2, 10));

  useEffect(() => {
    if (!username) return;

    console.log('Connecting to Jam MQTT...', BROKER_URL);
    const mqttClient = mqtt.connect(BROKER_URL, {
      clientId: `aura_jam_${myId.current}`,
      clean: true,
      connectTimeout: 4000,
      reconnectPeriod: 2000,
    });

    mqttClient.on('connect', () => {
      console.log('Jam MQTT Connected');
      setIsConnected(true);
      mqttClient.subscribe(`${TOPIC_BASE}/#`, (err) => {
        if (!err) {
          // Announce presence
          const state = {
            id: myId.current,
            username,
            track: currentTrack || null,
            playing: isAudioPlaying,
            position: playbackPosition || 0,
            timestamp: Date.now()
          };
          mqttClient.publish(`${TOPIC_BASE}/${myId.current}`, JSON.stringify(state), { retain: true });
        }
      });
    });

    mqttClient.on('message', (topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.id === myId.current) return; // Ignore self
        
        setPeers(prev => ({
          ...prev,
          [data.id]: data
        }));
      } catch (e) {
        console.error('Invalid jam message', e);
      }
    });

    setClient(mqttClient);

    return () => {
      if (mqttClient) {
        // Clean up retain message
        mqttClient.publish(`${TOPIC_BASE}/${myId.current}`, '', { retain: true });
        mqttClient.end();
      }
    };
  }, [username]);

  // Sync state when playing changes
  useEffect(() => {
    if (!client || !isConnected || !username) return;
    const state = {
      id: myId.current,
      username,
      track: currentTrack || null,
      playing: isAudioPlaying,
      position: playbackPosition || 0,
      timestamp: Date.now()
    };
    client.publish(`${TOPIC_BASE}/${myId.current}`, JSON.stringify(state), { retain: true });
  }, [client, isConnected, username, currentTrack, isAudioPlaying]);

  const handleJoinJam = (peer) => {
    if (!peer.track) return;
    onPlayTrack(peer.track, 0, [peer.track]);
    // Note: perfect sync would require seeking to peer.position + (Date.now() - peer.timestamp), 
    // but for a simple start, just playing the same track is good.
  };

  const cleanOldPeers = () => {
    const now = Date.now();
    setPeers(prev => {
      const next = { ...prev };
      let changed = false;
      for (const id in next) {
        if (now - next[id].timestamp > 60000) { // Remove if no update for 60s
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  };

  useEffect(() => {
    const interval = setInterval(cleanOldPeers, 10000);
    return () => clearInterval(interval);
  }, []);

  if (!username) {
    return (
      <div className="flex-center animate-fade-in" style={{ height: '70vh', flexDirection: 'column' }}>
        <div className="glass" style={{ padding: '30px', borderRadius: '20px', textAlign: 'center', maxWidth: '400px', width: '100%', boxSizing: 'border-box' }}>
          <Users size={48} color="var(--accent-color)" style={{ marginBottom: '20px' }} />
          <h2 style={{ margin: '0 0 10px', fontSize: '1.5rem' }}>Rejoindre la Jam</h2>
          <p style={{ margin: '0 0 24px', color: 'var(--text-secondary)' }}>
            Choisis un pseudo pour voir ce que tes amis écoutent en ce moment et les rejoindre.
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

  const activePeers = Object.values(peers).filter(p => Date.now() - p.timestamp < 60000);

  return (
    <div className="animate-fade-in" style={{ padding: '0 10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <Users size={28} color="var(--accent-color)" />
        <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Jam Session</h2>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', color: isConnected ? '#4caf50' : '#ff9800', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '20px', fontSize: '0.9rem' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'currentColor' }} />
          {isConnected ? 'Connecté' : 'Connexion...'}
        </div>
      </div>

      {activePeers.length === 0 ? (
        <div className="flex-center" style={{ height: '40vh', color: 'var(--text-secondary)', flexDirection: 'column', gap: '16px' }}>
           <User size={40} opacity={0.5} />
          <p>Personne n'est en ligne pour le moment.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {activePeers.map(peer => (
            <div key={peer.id} className="glass" style={{ padding: '16px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                 <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.2rem' }}>
                    {peer.username.charAt(0).toUpperCase()}
                 </div>
                 <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{peer.username}</div>
                    <div style={{ fontSize: '0.85rem', color: peer.playing ? '#4caf50' : 'var(--text-secondary)' }}>
                      {peer.playing ? 'Écoute' : 'En pause'}
                    </div>
                 </div>
               </div>

               {peer.track ? (
                 <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '12px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {peer.track.artwork ? (
                      <img src={peer.track.artwork} alt="cover" style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover' }} />
                    ) : (
                      <TrackArtPlaceholder size={48} radius={8} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                       <div className="truncate" style={{ fontWeight: 600, fontSize: '0.95rem' }}>{peer.track.title}</div>
                       <div className="truncate" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{peer.track.artist}</div>
                    </div>
                 </div>
               ) : (
                 <div style={{ background: 'rgba(0,0,0,0.1)', padding: '12px', borderRadius: '12px', display: 'flex', gap: '12px', alignItems: 'center', color: 'var(--text-secondary)' }}>
                    <Music size={24} opacity={0.5} />
                    <span style={{ fontSize: '0.9rem' }}>Ne joue rien</span>
                 </div>
               )}

               <button
                  disabled={!peer.track}
                  onClick={() => handleJoinJam(peer)}
                  style={{
                    background: peer.track ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
                    color: peer.track ? 'white' : 'var(--text-secondary)',
                    border: 'none',
                    padding: '10px',
                    borderRadius: '12px',
                    cursor: peer.track ? 'pointer' : 'default',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => { if(peer.track) e.currentTarget.style.background = 'var(--accent-color)'; }}
                  onMouseOut={(e) => { if(peer.track) e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
               >
                  <Play size={16} fill="currentColor" />
                  Rejoindre
               </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
