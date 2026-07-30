import { X, Trash2, GripVertical, ListMusic } from 'lucide-react';
import PlayingIndicator from './PlayingIndicator';
import { TrackArtPlaceholder } from './MediaPlaceholder';

function Row({ track, subtitle, onPlay, onRemove, active, isAudioPlaying }) {
  return (
    <div
      className="track-row"
      onClick={onPlay}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 10px',
        borderRadius: 'var(--radius-md)',
        cursor: onPlay ? 'pointer' : 'default',
        backgroundColor: active ? 'var(--surface-hover)' : 'transparent'
      }}
    >
      <div style={{ width: '22px', display: 'flex', justifyContent: 'center', flexShrink: 0, color: 'var(--text-muted)' }}>
        {active ? <PlayingIndicator playing={isAudioPlaying} /> : <GripVertical size={16} />}
      </div>

      {track.artwork ? (
        <img
          src={track.artwork}
          alt=""
          style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-sm)', objectFit: 'cover', flexShrink: 0 }}
        />
      ) : (
        <TrackArtPlaceholder size={40} radius={8} />
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="truncate"
          style={{ fontSize: '0.88rem', fontWeight: 600, color: active ? 'var(--accent-color)' : 'var(--text-primary)' }}
        >
          {track.title}
        </div>
        <div className="truncate" style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
          {subtitle || track.artist || '—'}
        </div>
      </div>

      {onRemove && (
        <button
          type="button"
          className="btn-icon row-reveal"
          title="Retirer de la file"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}

function Section({ title, action, children }) {
  return (
    <section style={{ marginBottom: '22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <h4 style={{ margin: 0, fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          {title}
        </h4>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Panneau latéral « file d'attente » : à suivre (manuel) puis suite de la sélection. */
export default function QueueView({
  open,
  onClose,
  topOffset = 0,
  bottomOffset = 0,
  currentTrack,
  isAudioPlaying,
  queue,
  upNext,
  contextLabel,
  onPlayQueued,
  onRemoveQueued,
  onClearQueue,
  onPlayUpNext
}) {
  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.35)', WebkitAppRegion: 'no-drag' }}
      />
      <aside
        className="slide-in-right"
        style={{
          position: 'fixed',
          // Sous la barre de titre, au-dessus du lecteur : sinon l'en-tête était rogné.
          top: `${topOffset}px`,
          right: 0,
          bottom: `${bottomOffset}px`,
          width: 'min(400px, 92vw)',
          zIndex: 61,
          background: 'rgba(14, 14, 18, 0.97)',
          backdropFilter: 'blur(24px) saturate(160%)',
          WebkitBackdropFilter: 'blur(24px) saturate(160%)',
          borderLeft: '1px solid var(--border-color)',
          boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          WebkitAppRegion: 'no-drag'
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 18px 12px',
            flexShrink: 0
          }}
        >
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ListMusic size={18} color="var(--accent-color)" />
            File d’attente
          </h3>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Fermer la file">
            <X size={18} />
          </button>
        </header>

        <div className="custom-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 12px 24px' }}>
          {currentTrack && (
            <Section title="En lecture">
              <Row track={currentTrack} active isAudioPlaying={isAudioPlaying} />
            </Section>
          )}

          <Section
            title={`À suivre${queue.length ? ` · ${queue.length}` : ''}`}
            action={
              queue.length > 0 ? (
                <button
                  type="button"
                  onClick={onClearQueue}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  Vider
                </button>
              ) : null
            }
          >
            {queue.length === 0 ? (
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', padding: '4px 10px' }}>
                Rien en attente. Utilise « Lire ensuite » ou « Ajouter à la file » sur une piste.
              </p>
            ) : (
              queue.map((track, index) => (
                <Row
                  key={`${track.id}-${index}`}
                  track={track}
                  onPlay={() => onPlayQueued(index)}
                  onRemove={() => onRemoveQueued(index)}
                />
              ))
            )}
          </Section>

          {upNext.length > 0 && (
            <Section title={contextLabel || 'Ensuite'}>
              {upNext.map(({ track, index }) => (
                <Row key={`${track.id}-${index}`} track={track} onPlay={() => onPlayUpNext(index)} />
              ))}
            </Section>
          )}
        </div>
      </aside>
    </>
  );
}
