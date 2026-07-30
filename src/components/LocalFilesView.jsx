import { FolderPlus } from 'lucide-react';
import TrackList from './TrackList';

export default function LocalFilesView({
  tracks,
  onPlay,
  onImport,
  ...trackListProps
}) {
  return (
    <div className="animate-fade-in" style={{ paddingBottom: '40px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '28px',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            Fichiers locaux
          </h2>
          <p style={{ margin: '8px 0 0', fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.45, maxWidth: '560px' }}>
            Importe des fichiers audio (MP3, FLAC, M4A…). Ils sont lus depuis ton ordinateur, sans passer par SoundCloud.
          </p>
        </div>
        <button
          type="button"
          onClick={onImport}
          className="glass btn-pill"
          style={{ WebkitAppRegion: 'no-drag' }}
        >
          <FolderPlus size={20} strokeWidth={2} />
          Ajouter des fichiers
        </button>
      </div>

      {!tracks?.length ? (
        <div className="flex-center" style={{ height: '36vh', color: 'var(--text-secondary)', flexDirection: 'column', gap: '12px' }}>
          <p style={{ margin: 0 }}>Aucun fichier pour le moment.</p>
          <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.85 }}>Utilise « Ajouter des fichiers » pour construire ta liste.</p>
        </div>
      ) : (
        <TrackList {...trackListProps} tracks={tracks} onPlay={onPlay} />
      )}
    </div>
  );
}
