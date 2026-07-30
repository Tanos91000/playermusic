import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * File de téléchargements partagée par toute l'app.
 *
 * - déduplique les demandes concurrentes pour une même piste ;
 * - expose la progression temps réel poussée par le process principal ;
 * - notifie `onDownloaded` pour que les listes marquent la piste comme réparée.
 */
export default function useDownloadManager({ onDownloaded } = {}) {
  const [downloads, setDownloads] = useState({});
  const pendingRef = useRef(new Map());
  const onDownloadedRef = useRef(onDownloaded);
  onDownloadedRef.current = onDownloaded;

  const patch = useCallback((id, changes) => {
    setDownloads((prev) => {
      const entry = prev[id];
      if (!entry) return prev;
      return { ...prev, [id]: { ...entry, ...changes } };
    });
  }, []);

  const dismiss = useCallback((id) => {
    setDownloads((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onDownloadProgress) return;
    api.onDownloadProgress((payload) => {
      if (!payload || payload.trackId == null) return;
      patch(payload.trackId, {
        stage: payload.stage || 'downloading',
        ...(typeof payload.percent === 'number' ? { percent: payload.percent } : {}),
        ...(payload.speed ? { speed: payload.speed } : {}),
        ...(payload.eta ? { eta: payload.eta } : {})
      });
    });
  }, [patch]);

  /** Lance (ou rejoint) le téléchargement d'une piste. Résout le chemin local, ou null. */
  const start = useCallback(
    (track) => {
      const id = track?.id;
      if (id == null || !window.electronAPI?.downloadTrack) return Promise.resolve(null);

      const inFlight = pendingRef.current.get(id);
      if (inFlight) return inFlight;

      setDownloads((prev) => ({
        ...prev,
        [id]: {
          id,
          title: track.title || 'Piste',
          artist: track.artist || '',
          artwork: track.artwork || null,
          percent: 0,
          stage: 'starting',
          speed: null,
          eta: null,
          error: null
        }
      }));

      const promise = (async () => {
        try {
          const res = await window.electronAPI.downloadTrack(track);
          if (res?.success && res.localPath) {
            patch(id, { stage: 'done', percent: 100, error: null });
            onDownloadedRef.current?.(track, res);
            setTimeout(() => dismiss(id), 2400);
            return res.localPath;
          }
          throw new Error(res?.error || 'Réponse inattendue du téléchargement.');
        } catch (err) {
          patch(id, { stage: 'error', error: err?.message || String(err) });
          return null;
        } finally {
          pendingRef.current.delete(id);
        }
      })();

      pendingRef.current.set(id, promise);
      return promise;
    },
    [dismiss, patch]
  );

  const retry = useCallback(
    (track) => {
      if (track?.id != null) dismiss(track.id);
      return start(track);
    },
    [dismiss, start]
  );

  const isDownloading = useCallback(
    (id) => {
      const entry = downloads[id];
      return !!entry && entry.stage !== 'done' && entry.stage !== 'error';
    },
    [downloads]
  );

  return { downloads, start, retry, dismiss, isDownloading };
}
