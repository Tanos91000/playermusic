import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const MIN_DB = -12;
const MAX_DB = 12;
const GRID_DB = [12, 6, 0, -6, -12];

/** Catmull-Rom → Bézier : courbe lisse passant exactement par chaque point. */
function smoothPath(points) {
  if (points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

/**
 * Égaliseur graphique : courbe de réponse manipulable directement.
 * Chaque bande est une poignée que l'on fait glisser ; la courbe interpole
 * entre elles, comme sur un égaliseur matériel.
 */
export default function EqualizerCurve({ bands, frequencies, onChange }) {
  const wrapRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 210 });
  const [dragIndex, setDragIndex] = useState(-1);
  const [hoverIndex, setHoverIndex] = useState(-1);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const padX = 26;
  const padY = 22;
  const innerW = Math.max(0, size.w - padX * 2);
  const innerH = Math.max(0, size.h - padY * 2);

  const xFor = (i) => padX + (bands.length === 1 ? innerW / 2 : (innerW * i) / (bands.length - 1));
  const yFor = (db) => padY + innerH * (1 - (db - MIN_DB) / (MAX_DB - MIN_DB));
  const dbFor = (y) => {
    const ratio = 1 - (y - padY) / innerH;
    return Math.round((MIN_DB + ratio * (MAX_DB - MIN_DB)) * 2) / 2;
  };

  const setBand = useCallback(
    (index, db) => {
      const clamped = Math.min(MAX_DB, Math.max(MIN_DB, db));
      if (bands[index] === clamped) return;
      const next = [...bands];
      next[index] = clamped;
      onChange(next);
    },
    [bands, onChange]
  );

  /**
   * Le glissement lit la géométrie et le setter via une ref : sans ça, les
   * écouteurs seraient réattachés à chaque mouvement (setBand change avec bands).
   */
  const dragHandlerRef = useRef(null);
  dragHandlerRef.current = (clientY) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || dragIndex < 0) return;
    setBand(dragIndex, dbFor(clientY - rect.top));
  };

  useEffect(() => {
    if (dragIndex < 0) return undefined;
    const onMove = (e) => dragHandlerRef.current?.(e.clientY);
    const onUp = () => setDragIndex(-1);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragIndex]);

  const points = bands.map((db, i) => ({ x: xFor(i), y: yFor(db) }));
  // On prolonge la courbe jusqu'aux bords pour éviter un aplat aux extrémités.
  const curvePoints =
    points.length > 1
      ? [{ x: 0, y: points[0].y }, ...points, { x: size.w, y: points[points.length - 1].y }]
      : points;

  const linePath = smoothPath(curvePoints);
  const areaPath = linePath ? `${linePath} L ${size.w} ${yFor(0)} L 0 ${yFor(0)} Z` : '';
  const ready = size.w > 0;

  return (
    <div className="eq" >
      <div className="eq__canvas" ref={wrapRef}>
        {ready && (
          <svg width={size.w} height={size.h} className="eq__svg">
            <defs>
              <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-color)" stopOpacity="0.34" />
                <stop offset="100%" stopColor="var(--accent-color)" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {GRID_DB.map((db) => (
              <g key={db}>
                <line
                  x1={0}
                  x2={size.w}
                  y1={yFor(db)}
                  y2={yFor(db)}
                  className={db === 0 ? 'eq__grid eq__grid--zero' : 'eq__grid'}
                />
                <text x={4} y={yFor(db) - 4} className="eq__grid-label">
                  {db > 0 ? `+${db}` : db}
                </text>
              </g>
            ))}

            <path d={areaPath} fill="url(#eqFill)" />
            <path d={linePath} className="eq__line" />

            {points.map((p, i) => {
              const active = dragIndex === i || hoverIndex === i;
              return (
                <g key={frequencies[i]}>
                  <line x1={p.x} x2={p.x} y1={padY} y2={padY + innerH} className="eq__stem" />
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={active ? 9 : 6.5}
                    className={`eq__handle${active ? ' is-active' : ''}`}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      setDragIndex(i);
                    }}
                    onPointerEnter={() => setHoverIndex(i)}
                    onPointerLeave={() => setHoverIndex(-1)}
                    onDoubleClick={() => setBand(i, 0)}
                  />
                  {active && (
                    <text x={p.x} y={p.y - 16} className="eq__value" textAnchor="middle">
                      {bands[i] > 0 ? `+${bands[i]}` : bands[i]} dB
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}
      </div>

      <div className="eq__axis">
        {frequencies.map((f, i) => (
          <button
            key={f}
            type="button"
            className={`eq__band-btn${dragIndex === i || hoverIndex === i ? ' is-active' : ''}`}
            onPointerEnter={() => setHoverIndex(i)}
            onPointerLeave={() => setHoverIndex(-1)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp') { e.preventDefault(); setBand(i, bands[i] + 0.5); }
              if (e.key === 'ArrowDown') { e.preventDefault(); setBand(i, bands[i] - 0.5); }
              if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); setBand(i, 0); }
            }}
            aria-label={`Gain ${f} : ${bands[i]} décibels. Flèches haut et bas pour ajuster.`}
          >
            <span className="eq__band-freq">{f}</span>
            <span className="eq__band-db">{bands[i] > 0 ? `+${bands[i]}` : bands[i]}</span>
          </button>
        ))}
      </div>

      <p className="eq__hint">Fais glisser un point sur la courbe. Double-clic pour remettre une bande à zéro.</p>
    </div>
  );
}
