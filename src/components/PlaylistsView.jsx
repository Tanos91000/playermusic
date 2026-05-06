import React, { useState, useEffect } from 'react';
import { Play, Plus, Trash2, X, Music } from 'lucide-react';
import TrackList from './TrackList';

export default function PlaylistsView({ 
  playlists, 
  onCreatePlaylist, 
  onDeletePlaylist, 
  onPlayPlaylist, 
  currentTrack, 
  isAudioPlaying, 
  onPlayTrack,
  favorites,
  toggleFavorite,
  onTrackDownloaded,
  onRemoveFromPlaylist
}) {
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = (e) => {
    e.preventDefault();
    if (newPlaylistName.trim()) {
      onCreatePlaylist(newPlaylistName.trim());
      setNewPlaylistName('');
      setIsCreating(false);
    }
  };

  if (selectedPlaylist) {
    return (
      <div className="animate-fade-in" style={{ padding: '0 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <button 
            onClick={() => setSelectedPlaylist(null)}
            style={{ 
              background: 'rgba(255,255,255,0.1)', 
              border: 'none', 
              borderRadius: '50%', 
              width: '40px', 
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-primary)'
            }}
          >
            <X size={20} />
          </button>
          <h2 style={{ fontSize: '1.5rem', margin: 0 }}>{selectedPlaylist.name}</h2>
          <button
             onClick={() => onPlayPlaylist(selectedPlaylist)}
             style={{
               marginLeft: 'auto',
               background: 'var(--accent-color)',
               color: 'white',
               border: 'none',
               padding: '10px 20px',
               borderRadius: '24px',
               fontWeight: 600,
               cursor: 'pointer',
               display: 'flex',
               alignItems: 'center',
               gap: '8px'
             }}
          >
             <Play size={18} fill="currentColor" />
             Tout lire
          </button>
        </div>
        
        {selectedPlaylist.tracks.length === 0 ? (
          <div className="flex-center" style={{ height: '30vh', color: 'var(--text-secondary)' }}>
            <p>Cette playlist est vide. Ajoute des sons depuis la recherche, tes favoris ou tes fichiers locaux.</p>
          </div>
        ) : (
          <TrackList 
            tracks={selectedPlaylist.tracks} 
            onPlay={(track, index) => onPlayTrack(track, index, selectedPlaylist.tracks)} 
            currentTrack={currentTrack}
            isAudioPlaying={isAudioPlaying}
            favorites={favorites}
            toggleFavorite={toggleFavorite}
            onTrackDownloaded={onTrackDownloaded}
          />
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ padding: '0 10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Mes Playlists</h2>
        <button 
          onClick={() => setIsCreating(true)}
          style={{ 
            background: 'var(--accent-color)', 
            color: 'white', 
            border: 'none', 
            padding: '8px 16px', 
            borderRadius: '20px',
            cursor: 'pointer',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Plus size={18} />
          Nouvelle
        </button>
      </div>

      {isCreating && (
        <form onSubmit={handleCreate} className="glass" style={{ display: 'flex', gap: '10px', padding: '16px', borderRadius: '16px', marginBottom: '24px' }}>
          <input 
            autoFocus
            type="text" 
            placeholder="Nom de la playlist..." 
            value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
            style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: 'none', borderRadius: '8px', padding: '10px 14px', color: 'white', outline: 'none' }}
          />
          <button type="submit" style={{ background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '8px', padding: '0 16px', cursor: 'pointer', fontWeight: 600 }}>Créer</button>
          <button type="button" onClick={() => setIsCreating(false)} style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '8px', padding: '0 16px', cursor: 'pointer' }}>Annuler</button>
        </form>
      )}

      {playlists.length === 0 && !isCreating ? (
        <div className="flex-center" style={{ height: '40vh', color: 'var(--text-secondary)' }}>
          <p>Tu n&apos;as pas encore de playlist.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
          {playlists.map(pl => (
            <div 
              key={pl.id}
              className="glass"
              style={{ padding: '16px', borderRadius: '16px', cursor: 'pointer', position: 'relative', transition: 'transform 0.2s', '&:hover': { transform: 'scale(1.02)' } }}
              onClick={() => setSelectedPlaylist(pl)}
            >
              <div style={{ width: '100%', aspectRatio: '1', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                <Music size={40} color="var(--text-secondary)" />
              </div>
              <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pl.name}</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{pl.tracks.length} titres</p>
              
              <button
                onClick={(e) => { e.stopPropagation(); onDeletePlaylist(pl.id); }}
                style={{ position: 'absolute', top: '24px', right: '24px', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ff4444' }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
