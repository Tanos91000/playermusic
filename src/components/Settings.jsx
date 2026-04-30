import React, { useEffect, useState } from 'react';

const TUNE_MY_MUSIC_SPOTIFY_TO_SOUNDCLOUD =
  'https://www.tunemymusic.com/transfer/spotify-to-soundcloud';

function openTuneMyMusicInBrowser() {
  const api = window.electronAPI;
  if (api?.openExternalUrl) {
    void api.openExternalUrl(TUNE_MY_MUSIC_SPOTIFY_TO_SOUNDCLOUD);
  } else {
    window.open(TUNE_MY_MUSIC_SPOTIFY_TO_SOUNDCLOUD, '_blank', 'noopener,noreferrer');
  }
}

export default function Settings({
  eqBands, setEqBands, reverb, setReverb, reverbEnabled, setReverbEnabled, djMode, setDjMode,
  mergeSpotifyLikesIntoFavorites
}) {
  const frequencies = ['60Hz', '230Hz', '910Hz', '3.6kHz', '14kHz'];
  const [appVersion, setAppVersion] = useState('');
  const [discordAppId, setDiscordAppId] = useState('');
  const [spotifyClientId, setSpotifyClientId] = useState('');
  const [spotifyRedirectUri, setSpotifyRedirectUri] = useState('');
  const [spotifyBusy, setSpotifyBusy] = useState(false);
  const [spotifyProgress, setSpotifyProgress] = useState('');

  useEffect(() => {
    if (window.electronAPI && window.electronAPI.getAppVersion) {
      window.electronAPI.getAppVersion().then(version => setAppVersion(version));
    }
    setDiscordAppId(localStorage.getItem('aura_discord_client_id') || '');
    setSpotifyClientId(localStorage.getItem('aura_spotify_client_id') || '');
    if (window.electronAPI?.getSpotifyRedirectUri) {
      window.electronAPI.getSpotifyRedirectUri().then((uri) => {
        if (uri) setSpotifyRedirectUri(uri);
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onSpotifyImportProgress) return undefined;
    api.onSpotifyImportProgress((p) => {
      if (p.phase === 'oauth') setSpotifyProgress(p.message || 'Connexion Spotify…');
      else if (p.phase === 'token') setSpotifyProgress(p.message || 'Jeton…');
      else if (p.phase === 'fetch') setSpotifyProgress(`Spotify : ${p.count ?? '…'} titres…`);
      else if (p.phase === 'match') setSpotifyProgress(`SoundCloud ${p.index}/${p.total}`);
      else setSpotifyProgress('');
    });
    return undefined;
  }, []);

  const persistSpotifyClientId = (raw) => {
    const v = (raw || '').trim();
    if (v) localStorage.setItem('aura_spotify_client_id', v);
    else localStorage.removeItem('aura_spotify_client_id');
  };

  const handleSpotifyImport = async () => {
    const api = window.electronAPI;
    if (!api?.spotifyImportLikes || !mergeSpotifyLikesIntoFavorites) {
      alert('Import Spotify : disponible uniquement dans l’application Electron.');
      return;
    }
    const cid = spotifyClientId.trim();
    if (!cid) {
      alert('Colle ton Client ID Spotify (dashboard développeur).');
      return;
    }
    setSpotifyBusy(true);
    setSpotifyProgress('Préparation…');
    try {
      const res = await api.spotifyImportLikes(cid);
      if (!res?.ok) {
        alert(res?.error || 'Import Spotify échoué.');
        return;
      }
      const { added, duplicates } = mergeSpotifyLikesIntoFavorites(res.tracks || []);
      const unmatched = (res.unmatched || []).length;
      const spotifyTotal = res.spotifyTotal ?? 0;
      alert(
        `Import terminé — favoris Aura mis à jour.\n\n` +
          `Titres Spotify : ${spotifyTotal}\n` +
          `Ajoutés dans l’app : ${added}\n` +
          `Déjà en favoris : ${duplicates}\n` +
          `Pas trouvé sur SoundCloud : ${unmatched}`
      );
    } catch (err) {
      alert(err?.message || String(err));
    } finally {
      setSpotifyBusy(false);
      setSpotifyProgress('');
    }
  };

  const persistDiscordAppId = (raw) => {
    const v = (raw || '').trim();
    if (v) localStorage.setItem('aura_discord_client_id', v);
    else localStorage.removeItem('aura_discord_client_id');
    if (window.electronAPI?.setDiscordClientId) {
      window.electronAPI.setDiscordClientId(v);
    }
  };

  const handleSliderChange = (index, value) => {
    const newBands = [...eqBands];
    newBands[index] = parseFloat(value);
    setEqBands(newBands);
  };

  const resetEQ = () => setEqBands([0, 0, 0, 0, 0]);
  const applyBassBoost = () => setEqBands([6.5, 1.5, -1.0, 2.0, 3.5]);

  return (
    <div className="glass animate-fade-in" style={{ padding: '30px', maxWidth: '640px', margin: '0 auto', marginTop: '20px' }}>
      <h2 style={{ marginBottom: '20px' }}>Paramètres Audio</h2>
      
      {/* EQ Settings */}
      <div style={{ marginBottom: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', margin: 0 }}>Égaliseur Graphique (5-Bandes)</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={resetEQ} style={{ padding: '5px 12px', borderRadius: '20px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem' }}>Réinitialiser</button>
                <button onClick={applyBassBoost} style={{ padding: '5px 12px', borderRadius: '20px', border: 'none', background: 'var(--accent-color)', color: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>Bass Boost</button>
            </div>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', height: '200px', padding: '20px', backgroundColor: 'var(--surface-color)', borderRadius: '16px' }}>
          {eqBands.map((gain, index) => (
            <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', gap: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{gain > 0 ? `+${gain}` : gain} dB</div>
              <input 
                type="range" min="-12" max="12" step="0.5" value={gain} onChange={(e) => handleSliderChange(index, e.target.value)}
                style={{ writingMode: 'bt-lr', WebkitAppearance: 'slider-vertical', width: '8px', flex: 1, accentColor: 'var(--accent-color)', cursor: 'pointer' }} 
              />
              <div style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-primary)', marginTop: '5px' }}>{frequencies[index]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Effects Settings */}
      <div style={{ marginBottom: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', margin: 0 }}>Effets de Salle (Reverb)</h3>
          <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '28px' }}>
            <input type="checkbox" checked={reverbEnabled} onChange={(e) => setReverbEnabled(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
            <span style={{ 
              position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, 
              backgroundColor: reverbEnabled ? 'var(--accent-color)' : 'var(--bg-color)', transition: '.4s', borderRadius: '34px' 
            }}>
              <span style={{ 
                position: 'absolute', content: '""', height: '20px', width: '20px', left: '4px', bottom: '4px', 
                backgroundColor: 'white', transition: '.4s', borderRadius: '50%', transform: reverbEnabled ? 'translateX(22px)' : 'none' 
              }}></span>
            </span>
          </label>
        </div>
        <div style={{ backgroundColor: 'var(--surface-color)', padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '15px', opacity: reverbEnabled ? 1 : 0.5, pointerEvents: reverbEnabled ? 'auto' : 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Acoustique Studio (Sec)</span>
            <span>Hall de Concert (Vaste)</span>
          </div>
          <input 
            type="range" min="0" max="1" step="0.01" value={reverb} onChange={(e) => setReverb(parseFloat(e.target.value))}
            style={{ width: '100%', height: '4px', appearance: 'none', background: 'var(--bg-color)', borderRadius: '2px', accentColor: 'var(--accent-color)' }}
          />
        </div>
      </div>

      {/* Playback Settings */}
      <div style={{ marginBottom: '40px' }}>
        <h3 style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', margin: '0 0 20px 0' }}>Lecture & Transitions</h3>
        <div style={{ backgroundColor: 'var(--surface-color)', padding: '20px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h4 style={{ margin: '0 0 5px 0' }}>Mode DJ (Crossfade)</h4>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Fait fondre les pistes les unes dans les autres pour des transitions douces (façon Apple Music).</p>
          </div>
          <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '28px' }}>
            <input type="checkbox" checked={djMode} onChange={(e) => setDjMode(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
            <span style={{ 
              position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, 
              backgroundColor: djMode ? 'var(--accent-color)' : 'var(--bg-color)', transition: '.4s', borderRadius: '34px' 
            }}>
              <span style={{ 
                position: 'absolute', content: '""', height: '20px', width: '20px', left: '4px', bottom: '4px', 
                backgroundColor: 'white', transition: '.4s', borderRadius: '50%', transform: djMode ? 'translateX(22px)' : 'none' 
              }}></span>
            </span>
          </label>
        </div>
      </div>

      {/* Spotify → favoris Aura (automatique) */}
      <div style={{ marginBottom: '40px' }}>
        <h3 style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>Importer tes likes Spotify dans Aura</h3>
        <div style={{ backgroundColor: 'var(--surface-color)', padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Connexion Spotify sécurisée (lecture seule des titres likés). Aura cherche chaque titre sur{' '}
            <strong>SoundCloud</strong> et les ajoute à tes <strong>favoris dans l’app</strong> automatiquement (premier résultat de recherche).
          </p>
          <ol style={{ margin: '0 0 8px 18px', padding: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <li>
              Crée une app sur{' '}
              <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color)' }}>
                developer.spotify.com/dashboard
              </a>
              .
            </li>
            <li>
              Ajoute cette redirection exacte :{' '}
              <code style={{ fontSize: '0.8em', wordBreak: 'break-all' }}>{spotifyRedirectUri || 'http://127.0.0.1:48921/callback'}</code>
            </li>
            <li>Colle le <strong>Client ID</strong> ci-dessous → « Importer » → connexion dans le navigateur.</li>
          </ol>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }} htmlFor="spotify-client-id">Client ID Spotify</label>
          <input
            id="spotify-client-id"
            type="text"
            autoComplete="off"
            placeholder="Client ID"
            value={spotifyClientId}
            onChange={(e) => setSpotifyClientId(e.target.value)}
            onBlur={() => persistSpotifyClientId(spotifyClientId)}
            style={{
              width: '100%',
              maxWidth: '420px',
              padding: '12px 14px',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-color)',
              color: 'var(--text-primary)',
              fontSize: '0.95rem',
              boxSizing: 'border-box'
            }}
          />
          {spotifyProgress ? (
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--accent-color)' }}>{spotifyProgress}</p>
          ) : null}
          <button
            type="button"
            disabled={spotifyBusy}
            onClick={handleSpotifyImport}
            style={{
              alignSelf: 'flex-start',
              padding: '12px 22px',
              borderRadius: '999px',
              border: 'none',
              background: spotifyBusy ? 'var(--surface-color)' : 'var(--accent-color)',
              color: '#fff',
              fontWeight: 700,
              cursor: spotifyBusy ? 'default' : 'pointer',
              opacity: spotifyBusy ? 0.75 : 1
            }}
          >
            {spotifyBusy ? 'Import en cours…' : 'Importer mes likes Spotify dans Aura'}
          </button>
          <p style={{ margin: '12px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Alternative (compte SoundCloud sur le web uniquement) :{' '}
            <button
              type="button"
              onClick={openTuneMyMusicInBrowser}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: 'var(--accent-color)',
                cursor: 'pointer',
                textDecoration: 'underline',
                fontSize: 'inherit'
              }}
            >
              Tune My Music
            </button>
          </p>
        </div>
      </div>

      {/* Discord Rich Presence */}
      <div style={{ marginBottom: '40px' }}>
        <h3 style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>Discord</h3>
        <div style={{ backgroundColor: 'var(--surface-color)', padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Affiche sur Discord le titre en cours (Rich Presence). Crée une application sur le{' '}
            <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color)' }}>
              portail développeur Discord
            </a>
            , copie son <strong>Application ID</strong> ci-dessous. Discord doit être ouvert sur la machine.
          </p>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }} htmlFor="discord-app-id">Application ID Discord</label>
          <input
            id="discord-app-id"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="ex. 1234567890123456789"
            value={discordAppId}
            onChange={(e) => setDiscordAppId(e.target.value)}
            onBlur={() => persistDiscordAppId(discordAppId)}
            style={{
              width: '100%',
              maxWidth: '420px',
              padding: '12px 14px',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-color)',
              color: 'var(--text-primary)',
              fontSize: '0.95rem',
              boxSizing: 'border-box'
            }}
          />
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Image grande présence : ajoute une clé d’asset dans le portail (Rich Presence → Art Assets) et renseigne <code style={{ fontSize: '0.85em' }}>discordLargeImageKey</code> dans <code style={{ fontSize: '0.85em' }}>package.json</code>, ou laisse vide pour n’afficher que le texte.
          </p>
        </div>
      </div>

      {appVersion && (
        <div style={{ textAlign: 'center', marginTop: '20px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Aura Player - Version {appVersion}
        </div>
      )}
    </div>
  );
}
