import { useEffect, useState } from 'react';
import { Minus, Square, Copy, X } from 'lucide-react';

/** Assez haute pour accueillir la barre de recherche sans qu'elle déborde. */
export const TITLE_BAR_HEIGHT = 56;

/**
 * Barre de titre dessinée par l'app.
 *
 * - macOS : cadre masqué (`hiddenInset`), on réserve la place des pastilles système.
 * - Windows/Linux : cadre natif supprimé, on dessine minimiser / agrandir / fermer.
 *
 * Toute la bande est une zone de déplacement : c'est elle qui corrige le fait
 * que le haut de la fenêtre n'était pas saisissable.
 */
export default function TitleBar({ children }) {
  const [state, setState] = useState({ maximized: false, fullScreen: false, platform: '' });

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.getWindowState) return;
    api.getWindowState().then((s) => s && setState(s)).catch(() => {});
    api.onWindowState?.((s) => s && setState(s));
  }, []);

  const isMac = state.platform === 'darwin';
  const showControls = !!state.platform && !isMac;
  const control = (action) => () => window.electronAPI?.windowControl?.(action);

  return (
    <div
      onDoubleClick={() => window.electronAPI?.windowControl?.('maximize')}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: `${TITLE_BAR_HEIGHT}px`,
        zIndex: 70,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        WebkitAppRegion: 'drag',
        // Volontairement transparente : un dégradé sombre trancherait sur les
        // pochettes claires. Les contrôles Windows ont leur propre fond au survol.
        background: 'transparent',
        gap: '12px',
        // Place des pastilles macOS quand elles ne sont pas masquées par le plein écran
        paddingLeft: isMac && !state.fullScreen ? '86px' : '14px',
        paddingRight: showControls ? 0 : '14px'
      }}
    >
      {/* Centrage absolu : la recherche reste au milieu de la fenêtre quelles que
          soient les largeurs des pastilles macOS et des contrôles Windows. */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 'min(380px, 42vw)',
          pointerEvents: 'none'
        }}
      >
        <div style={{ width: '100%', pointerEvents: 'auto' }}>{children}</div>
      </div>

      <div style={{ flex: 1 }} />

      {showControls && (
        <div style={{ display: 'flex', height: '100%', WebkitAppRegion: 'no-drag', flexShrink: 0 }}>
          <button type="button" className="win-ctl" onClick={control('minimize')} aria-label="Réduire" title="Réduire">
            <Minus size={15} />
          </button>
          <button
            type="button"
            className="win-ctl"
            onClick={control('maximize')}
            aria-label={state.maximized ? 'Restaurer' : 'Agrandir'}
            title={state.maximized ? 'Restaurer' : 'Agrandir'}
          >
            {state.maximized ? <Copy size={13} /> : <Square size={12} />}
          </button>
          <button type="button" className="win-ctl win-ctl--close" onClick={control('close')} aria-label="Fermer" title="Fermer">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
