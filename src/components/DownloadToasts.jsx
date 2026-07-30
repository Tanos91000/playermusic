import { Check, Download, RotateCcw, X, AlertTriangle } from 'lucide-react';
import { TrackArtPlaceholder } from './MediaPlaceholder';

const STAGE_LABEL = {
  starting: 'Recherche d’une source…',
  downloading: 'Récupération…',
  finalizing: 'Finalisation…',
  done: 'Prêt à écouter',
  error: 'Échec de la récupération'
};

function stageLabel(entry) {
  const base = STAGE_LABEL[entry.stage] || 'Récupération…';
  if (entry.stage !== 'downloading') return base;
  const bits = [];
  if (entry.speed) bits.push(entry.speed);
  if (entry.eta && entry.eta !== 'Unknown') bits.push(`~${entry.eta}`);
  return bits.length ? `${base} ${bits.join(' · ')}` : base;
}

/** Pile de notifications de réparation/téléchargement, en bas à droite. */
export default function DownloadToasts({ downloads, onRetry, onDismiss, bottomOffset = 110 }) {
  const entries = Object.values(downloads || {});
  if (entries.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        right: '20px',
        bottom: `${bottomOffset}px`,
        zIndex: 95,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        width: 'min(340px, calc(100vw - 40px))',
        WebkitAppRegion: 'no-drag',
        pointerEvents: 'auto'
      }}
    >
      {entries.map((entry) => {
        const isError = entry.stage === 'error';
        const isDone = entry.stage === 'done';
        const percent = typeof entry.percent === 'number' ? Math.round(entry.percent) : null;

        return (
          <div
            key={entry.id}
            className="toast-in"
            style={{
              background: 'rgba(18, 18, 22, 0.96)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
              border: `1px solid ${isError ? 'rgba(248,113,113,0.35)' : 'var(--border-color)'}`,
              borderRadius: 'var(--radius-lg)',
              padding: '12px',
              boxShadow: '0 18px 44px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {entry.artwork ? (
                <img
                  src={entry.artwork}
                  alt=""
                  style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-sm)', objectFit: 'cover', flexShrink: 0 }}
                />
              ) : (
                <TrackArtPlaceholder size={40} radius={8} />
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="truncate" style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                  {entry.title}
                </div>
                <div
                  className="truncate"
                  style={{
                    fontSize: '0.75rem',
                    color: isError ? 'var(--danger-color)' : 'var(--text-secondary)',
                    marginTop: '2px'
                  }}
                >
                  {stageLabel(entry)}
                </div>
              </div>

              <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '2px' }}>
                {isDone ? (
                  <Check size={18} color="var(--accent-color)" />
                ) : isError ? (
                  <AlertTriangle size={18} color="var(--danger-color)" />
                ) : (
                  <Download size={16} className="pulse-soft" color="var(--accent-color)" />
                )}
                {isError && typeof onRetry === 'function' && (
                  <button type="button" className="btn-icon" title="Réessayer" onClick={() => onRetry(entry)}>
                    <RotateCcw size={16} />
                  </button>
                )}
                <button type="button" className="btn-icon" title="Fermer" onClick={() => onDismiss(entry.id)}>
                  <X size={16} />
                </button>
              </div>
            </div>

            {!isError && (
              <div
                style={{
                  height: '4px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'rgba(255,255,255,0.1)',
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: percent != null ? `${percent}%` : '35%',
                    background: 'var(--accent-color)',
                    borderRadius: 'inherit',
                    transition: 'width var(--dur-med) var(--ease-out)',
                    ...(percent == null ? { animation: 'pulse-soft 1.4s ease-in-out infinite' } : {})
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
