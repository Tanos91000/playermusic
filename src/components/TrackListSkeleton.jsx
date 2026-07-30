/** Placeholder animé pendant une recherche — évite le saut de mise en page. */
export default function TrackListSkeleton({ rows = 6 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }} aria-hidden>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="glass"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '15px',
            padding: '12px 20px',
            backgroundColor: 'var(--surface-color)',
            opacity: Math.max(0.25, 1 - index * 0.12)
          }}
        >
          <div className="skeleton" style={{ width: '20px', height: '14px', flexShrink: 0 }} />
          <div className="skeleton" style={{ width: '48px', height: '48px', borderRadius: '4px', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div className="skeleton" style={{ width: `${52 + ((index * 13) % 30)}%`, height: '13px' }} />
            <div className="skeleton" style={{ width: `${28 + ((index * 7) % 20)}%`, height: '11px' }} />
          </div>
          <div className="skeleton" style={{ width: '46px', height: '12px', flexShrink: 0 }} />
        </div>
      ))}
    </div>
  );
}
