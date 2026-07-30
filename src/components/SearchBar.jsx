import { useEffect, useRef, useState } from 'react';
import { Search, X, Clock, CornerDownLeft } from 'lucide-react';

const HISTORY_KEY = 'aura_search_history';
const HISTORY_MAX = 8;
const DEBOUNCE_MS = 420;

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Champ de recherche : lance la requête automatiquement après une pause de
 * frappe (plus besoin de valider), garde un historique et propose des filtres.
 */
export default function SearchBar({ value, onChange, onSearch, onFocusSearch, autoFocus = false }) {
  const [history, setHistory] = useState(loadHistory);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const lastSentRef = useRef(value);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  /** Recherche différée : on n'interroge SoundCloud qu'une fois la frappe calmée. */
  useEffect(() => {
    const q = value.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2 || q === lastSentRef.current) return undefined;
    debounceRef.current = setTimeout(() => {
      lastSentRef.current = q;
      onSearch(q);
    }, DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [value, onSearch]);

  const remember = (q) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) return;
    setHistory((prev) => {
      const next = [trimmed, ...prev.filter((s) => s.toLowerCase() !== trimmed.toLowerCase())].slice(0, HISTORY_MAX);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const submit = (q) => {
    const trimmed = (q ?? value).trim();
    if (!trimmed) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    lastSentRef.current = trimmed;
    remember(trimmed);
    onChange(trimmed);
    onSearch(trimmed);
    setOpen(false);
    inputRef.current?.blur();
  };

  const clearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      /* ignore */
    }
  };

  return (
    <div ref={wrapperRef} className="search-wrap">
      <form
        className="search-field"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Search size={18} style={{ flexShrink: 0, color: 'var(--text-secondary)' }} />
        <input
          ref={inputRef}
          type="text"
          placeholder="Titres, artistes…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            setOpen(true);
            onFocusSearch?.();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.currentTarget.blur();
              setOpen(false);
            }
          }}
          aria-label="Rechercher"
        />
        {value && (
          <button
            type="button"
            className="btn-icon"
            style={{ padding: '4px' }}
            title="Effacer"
            onClick={() => {
              onChange('');
              lastSentRef.current = '';
              inputRef.current?.focus();
            }}
          >
            <X size={16} />
          </button>
        )}
      </form>

      {open && history.length > 0 && (
        <div className="search-history toast-in">
          <div className="search-history__head">
            <span>Recherches récentes</span>
            <button type="button" onClick={clearHistory}>Effacer</button>
          </div>
          {history.map((q) => (
            <button key={q} type="button" className="search-history__item" onClick={() => submit(q)}>
              <Clock size={14} style={{ flexShrink: 0, opacity: 0.6 }} />
              <span className="truncate">{q}</span>
              <CornerDownLeft size={13} className="search-history__enter" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
