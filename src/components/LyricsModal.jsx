import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { X, Mic2, Loader2, SearchX } from 'lucide-react';
import { fetchLyrics } from '../utils/lyrics';

export default function LyricsModal({ track, currentTime, onClose, onSeek, topOffset = 0, bottomOffset = 0 }) {
  const [state, setState] = useState({ status: 'loading', lines: [], synced: false, source: '' });
  const containerRef = useRef(null);
  const wrapperRef = useRef(null);
  const userScrolledRef = useRef(false);
  const scrollTimerRef = useRef(null);

  useEffect(() => {
    if (!track) return undefined;
    const controller = new AbortController();
    setState({ status: 'loading', lines: [], synced: false, source: '' });
    userScrolledRef.current = false;

    fetchLyrics(track, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        if (!res) {
          setState({ status: 'empty', lines: [], synced: false, source: '' });
          return;
        }
        setState({ status: 'ready', ...res });
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setState({ status: 'error', lines: [], synced: false, source: '' });
      });

    return () => controller.abort();
  }, [track]);

  const activeIndex = useMemo(() => {
    if (!state.synced) return -1;
    let idx = -1;
    for (let i = 0; i < state.lines.length; i += 1) {
      if (currentTime >= state.lines[i].time) idx = i;
      else break;
    }
    return idx;
  }, [state.lines, state.synced, currentTime]);

  /**
   * Défilement calculé sur le conteneur, et non via scrollIntoView qui
   * déplaçait aussi la page derrière la modale.
   */
  useLayoutEffect(() => {
    if (!state.synced || activeIndex < 0 || userScrolledRef.current) return;
    const container = containerRef.current;
    const wrapper = wrapperRef.current;
    if (!container || !wrapper) return;
    const el = wrapper.children[activeIndex];
    if (!el) return;
    const target = el.offsetTop - container.clientHeight / 2 + el.offsetHeight / 2;
    container.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  }, [activeIndex, state.synced]);

  /** Après une interaction manuelle, on rend la main quelques secondes. */
  const handleUserScroll = () => {
    userScrolledRef.current = true;
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      userScrolledRef.current = false;
    }, 5000);
  };

  useEffect(() => () => clearTimeout(scrollTimerRef.current), []);

  return (
    <div
      className="lyrics-overlay animate-fade-in"
      style={{ top: `${topOffset}px`, bottom: `${bottomOffset}px` }}
    >
      <header className="lyrics-overlay__head">
        <div style={{ minWidth: 0 }}>
          <h3 className="lyrics-overlay__title">
            <Mic2 size={18} color="var(--accent-color)" />
            Paroles
            {state.synced && <span className="lyrics-badge">synchronisées</span>}
          </h3>
          <p className="lyrics-overlay__sub truncate">
            {state.status === 'ready' && state.source ? state.source : track?.title}
          </p>
        </div>
        <button type="button" className="btn-icon" onClick={onClose} title="Fermer" aria-label="Fermer les paroles">
          <X size={20} />
        </button>
      </header>

      <div
        ref={containerRef}
        className="lyrics-overlay__body custom-scrollbar"
        onWheel={handleUserScroll}
        onPointerDown={handleUserScroll}
      >
        {state.status === 'loading' && (
          <div className="lyrics-state">
            <Loader2 size={34} className="animate-spin" color="var(--accent-color)" />
            <p>Recherche des paroles…</p>
          </div>
        )}

        {state.status === 'empty' && (
          <div className="lyrics-state">
            <SearchX size={38} strokeWidth={1.5} />
            <h4>Pas de paroles pour ce titre</h4>
            <p>
              La base lrclib ne référence pas ce morceau. C’est fréquent pour les remixes,
              les versions ralenties et les productions indépendantes.
            </p>
          </div>
        )}

        {state.status === 'error' && (
          <div className="lyrics-state">
            <SearchX size={38} strokeWidth={1.5} />
            <h4>Recherche impossible</h4>
            <p>Vérifie ta connexion, puis rouvre les paroles.</p>
          </div>
        )}

        {state.status === 'ready' && !state.synced && (
          <p className="lyrics-plain">{state.lines[0].text}</p>
        )}

        {state.status === 'ready' && state.synced && (
          <div ref={wrapperRef} className="lyrics-lines">
            {state.lines.map((line, idx) => {
              const isActive = idx === activeIndex;
              const isPast = idx < activeIndex;
              return (
                <button
                  key={`${line.time}-${idx}`}
                  type="button"
                  className={`lyrics-line${isActive ? ' is-active' : ''}${isPast ? ' is-past' : ''}`}
                  onClick={() => onSeek?.(line.time)}
                  title="Aller à ce passage"
                >
                  {line.text || '♪'}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
