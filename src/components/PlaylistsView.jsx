import { useEffect, useState } from 'react';
import { Plus, Trash2, ArrowLeft, ListMusic, Music } from 'lucide-react';
import CollectionView from './CollectionView';

/** Couverture d'une playlist : mosaïque des pochettes, ou dégradé stable par nom. */
function PlaylistCover({ playlist }) {
  const arts = playlist.tracks.map((t) => t.artwork).filter(Boolean).slice(0, 4);

  if (arts.length >= 4) {
    return (
      <div className="pl-card__cover pl-card__cover--grid">
        {arts.map((src, i) => (
          <img key={`${src}-${i}`} src={src} alt="" />
        ))}
      </div>
    );
  }
  if (arts.length > 0) {
    return <img src={arts[0]} alt="" className="pl-card__cover" />;
  }

  // Teinte dérivée du nom : chaque playlist garde la même couleur d'une fois sur l'autre.
  let hash = 0;
  for (let i = 0; i < playlist.name.length; i += 1) hash = (hash * 31 + playlist.name.charCodeAt(i)) % 360;
  return (
    <div
      className="pl-card__cover pl-card__cover--empty"
      style={{ background: `linear-gradient(140deg, hsl(${hash} 65% 45%), hsl(${(hash + 48) % 360} 60% 28%))` }}
    >
      <Music size={38} strokeWidth={1.5} />
    </div>
  );
}

export default function PlaylistsView({
  playlists,
  onCreatePlaylist,
  onDeletePlaylist,
  onPlayPlaylist,
  onPlayTrack,
  onShufflePlaylist,
  onRemoveFromPlaylist,
  createRequest = 0,
  ...trackProps
}) {
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const selectedPlaylist = playlists.find((p) => p.id === selectedPlaylistId) || null;

  useEffect(() => {
    if (createRequest > 0) {
      setSelectedPlaylistId(null);
      setIsCreating(true);
    }
  }, [createRequest]);

  const handleCreate = (e) => {
    e.preventDefault();
    const name = newPlaylistName.trim();
    if (!name) return;
    onCreatePlaylist(name);
    setNewPlaylistName('');
    setIsCreating(false);
  };

  if (selectedPlaylist) {
    return (
      <CollectionView
        kicker="Playlist"
        title={selectedPlaylist.name}
        icon={ListMusic}
        tint="linear-gradient(140deg, #bf5af2, #0a84ff)"
        tracks={selectedPlaylist.tracks}
        onPlay={(track, index, list) => onPlayTrack(track, index, list, `Playlist · ${selectedPlaylist.name}`)}
        onShuffle={() => onShufflePlaylist?.(selectedPlaylist)}
        onRemoveTrack={(track) => onRemoveFromPlaylist(selectedPlaylist.id, track.id)}
        removeLabel="Retirer de la playlist"
        emptyTitle="Cette playlist est vide"
        emptyHint="Ajoute des titres depuis la recherche, tes favoris ou tes fichiers locaux."
        headerExtra={
          <button
            type="button"
            className="btn-pill"
            style={{ marginTop: '14px' }}
            onClick={() => setSelectedPlaylistId(null)}
          >
            <ArrowLeft size={15} /> Toutes les playlists
          </button>
        }
        {...trackProps}
      />
    );
  }

  return (
    <div className="view-enter">
      <header className="coll-hero" style={{ paddingBottom: '18px' }}>
        <div className="coll-hero__meta">
          <span className="coll-hero__kicker">Ta bibliothèque</span>
          <h2 className="coll-hero__title">Playlists</h2>
          <p className="coll-hero__stats">
            {playlists.length} playlist{playlists.length > 1 ? 's' : ''}
          </p>
        </div>
        <button type="button" className="btn-pill btn-pill--accent" onClick={() => setIsCreating(true)}>
          <Plus size={17} /> Nouvelle playlist
        </button>
      </header>

      {isCreating && (
        <form onSubmit={handleCreate} className="pl-create toast-in">
          <input
            autoFocus
            type="text"
            placeholder="Nom de la playlist…"
            value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setIsCreating(false)}
            aria-label="Nom de la playlist"
          />
          <button type="submit" className="btn-pill btn-pill--accent" disabled={!newPlaylistName.trim()}>
            Créer
          </button>
          <button type="button" className="btn-pill" onClick={() => setIsCreating(false)}>
            Annuler
          </button>
        </form>
      )}

      {playlists.length === 0 && !isCreating ? (
        <div className="search-empty" style={{ height: '34vh' }}>
          <ListMusic size={38} strokeWidth={1.5} />
          <h3>Aucune playlist</h3>
          <p>Crée ta première playlist pour organiser tes titres.</p>
        </div>
      ) : (
        <div className="pl-grid">
          {playlists.map((pl) => (
            <div
              key={pl.id}
              className="pl-card"
              onClick={() => setSelectedPlaylistId(pl.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setSelectedPlaylistId(pl.id)}
            >
              <PlaylistCover playlist={pl} />
              <div className="pl-card__body">
                <span className="truncate pl-card__name">{pl.name}</span>
                <span className="pl-card__count">
                  {pl.tracks.length} titre{pl.tracks.length > 1 ? 's' : ''}
                </span>
              </div>
              <button
                type="button"
                className="btn-icon pl-card__delete"
                title="Supprimer la playlist"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeletePlaylist(pl.id);
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
