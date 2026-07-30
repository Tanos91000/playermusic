import { useEffect, useMemo, useState } from 'react';
import {
  SlidersHorizontal, Waves, Play, Keyboard, Music4, MessageSquare, Info,
  FolderOpen, Trash2, RotateCcw, ExternalLink
} from 'lucide-react';
import { Section, Row, Toggle, Select, TextField } from './SettingsControls';
import EqualizerCurve from './EqualizerCurve';

const TUNE_MY_MUSIC_SPOTIFY_TO_SOUNDCLOUD =
  'https://www.tunemymusic.com/transfer/spotify-to-soundcloud';

const EQ_PRESETS = {
  flat: { label: 'Neutre', bands: [0, 0, 0, 0, 0] },
  bass: { label: 'Bass Boost', bands: [6.5, 1.5, -1, 2, 3.5] },
  vocal: { label: 'Voix', bands: [-2, 1, 4, 3.5, 1] },
  electro: { label: 'Électro', bands: [5, 2, -1.5, 2.5, 5] },
  podcast: { label: 'Podcast', bands: [-4, 0, 3, 4, -1] }
};

const FREQUENCIES = ['60Hz', '230Hz', '910Hz', '3.6kHz', '14kHz'];

const SHORTCUTS = [
  ['Espace', 'Lecture / pause'],
  ['N', 'Piste suivante'],
  ['P', 'Piste précédente'],
  ['→ / ←', 'Avancer / reculer de 10 s'],
  ['S', 'Lecture aléatoire'],
  ['R', 'Mode de répétition'],
  ['Touches média', 'Contrôle depuis le clavier système']
];

function openExternal(url) {
  const api = window.electronAPI;
  if (api?.openExternalUrl) void api.openExternalUrl(url);
  else window.open(url, '_blank', 'noopener,noreferrer');
}

function formatBytes(bytes) {
  if (!bytes) return '0 o';
  const units = ['o', 'Ko', 'Mo', 'Go'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function Settings({
  eqBands, setEqBands, reverb, setReverb, reverbEnabled, setReverbEnabled, djMode, setDjMode,
  mergeSpotifyLikesIntoFavorites,
  downloadsLibrary,
  crossfadeSeconds, setCrossfadeSeconds,
  autoRepair, setAutoRepair,
  showNotifications, setShowNotifications,
  onClearRecent, onClearSearchHistory
}) {
  const [appVersion, setAppVersion] = useState('');
  const [discordAppId, setDiscordAppId] = useState('');
  const [spotifyClientId, setSpotifyClientId] = useState('');
  const [spotifyRedirectUri, setSpotifyRedirectUri] = useState('');
  const [spotifyBusy, setSpotifyBusy] = useState(false);
  const [spotifyProgress, setSpotifyProgress] = useState('');

  useEffect(() => {
    window.electronAPI?.getAppVersion?.().then(setAppVersion).catch(() => {});
    setDiscordAppId(localStorage.getItem('aura_discord_client_id') || '');
    setSpotifyClientId(localStorage.getItem('aura_spotify_client_id') || '');
    window.electronAPI?.getSpotifyRedirectUri?.()
      .then((uri) => uri && setSpotifyRedirectUri(uri))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onSpotifyImportProgress) return;
    api.onSpotifyImportProgress((p) => {
      if (p.phase === 'oauth') setSpotifyProgress(p.message || 'Connexion Spotify…');
      else if (p.phase === 'token') setSpotifyProgress(p.message || 'Jeton…');
      else if (p.phase === 'fetch') setSpotifyProgress(`Spotify : ${p.count ?? '…'} titres…`);
      else if (p.phase === 'match') setSpotifyProgress(`SoundCloud ${p.index}/${p.total}`);
      else setSpotifyProgress('');
    });
  }, []);

  const activePreset = useMemo(() => {
    const entry = Object.entries(EQ_PRESETS).find(([, p]) =>
      p.bands.every((v, i) => Math.abs(v - (eqBands?.[i] ?? 0)) < 0.01)
    );
    return entry ? entry[0] : 'custom';
  }, [eqBands]);

  const persistSpotifyClientId = () => {
    const v = spotifyClientId.trim();
    if (v) localStorage.setItem('aura_spotify_client_id', v);
    else localStorage.removeItem('aura_spotify_client_id');
  };

  const persistDiscordAppId = () => {
    const v = discordAppId.trim();
    if (v) localStorage.setItem('aura_discord_client_id', v);
    else localStorage.removeItem('aura_discord_client_id');
    window.electronAPI?.setDiscordClientId?.(v);
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
      alert(
        `Import terminé.\n\nTitres Spotify : ${res.spotifyTotal ?? 0}\n` +
          `Ajoutés : ${added}\nDéjà en favoris : ${duplicates}\n` +
          `Introuvables sur SoundCloud : ${(res.unmatched || []).length}`
      );
    } catch (err) {
      alert(err?.message || String(err));
    } finally {
      setSpotifyBusy(false);
      setSpotifyProgress('');
    }
  };

  return (
    <div className="settings-page view-enter">
      <header className="settings-page__head">
        <h2 style={{ margin: 0, fontSize: '1.9rem', fontWeight: 800, letterSpacing: '-0.03em' }}>Paramètres</h2>
        <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Audio, lecture, intégrations et données locales.
        </p>
      </header>

      <Section id="set-audio" title="Égaliseur" description="5 bandes, appliquées en temps réel." icon={SlidersHorizontal}>
        <div className="chip-row" style={{ marginBottom: '18px' }}>
          {Object.entries(EQ_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              type="button"
              className={`chip${activePreset === key ? ' is-active' : ''}`}
              onClick={() => setEqBands([...preset.bands])}
            >
              {preset.label}
            </button>
          ))}
          {activePreset === 'custom' && <span className="chip is-active">Personnalisé</span>}
        </div>

        <EqualizerCurve bands={eqBands} frequencies={FREQUENCIES} onChange={setEqBands} />
      </Section>

      <Section id="set-fx" title="Effets" description="Traitement appliqué à la sortie audio." icon={Waves}>
        <Row title="Réverbération" description="Ajoute une acoustique de salle au son.">
          <Toggle checked={reverbEnabled} onChange={setReverbEnabled} label="Activer la réverbération" />
        </Row>
        <div style={{ opacity: reverbEnabled ? 1 : 0.4, pointerEvents: reverbEnabled ? 'auto' : 'none', transition: 'opacity var(--dur-med) var(--ease-out)' }}>
          <Row title="Intensité" description="De l’acoustique de studio au hall de concert." stacked>
            <input
              className="range range--slim"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={reverb}
              onChange={(e) => setReverb(parseFloat(e.target.value))}
              style={{ width: '100%', '--range-fill': `${reverb * 100}%` }}
              aria-label="Intensité de la réverbération"
            />
          </Row>
        </div>
      </Section>

      <Section id="set-playback" title="Lecture" description="Enchaînement des titres et récupération automatique." icon={Play}>
        <Row title="Mode DJ (crossfade)" description="Fait fondre les pistes les unes dans les autres.">
          <Toggle checked={djMode} onChange={setDjMode} label="Activer le mode DJ" />
        </Row>
        {typeof setCrossfadeSeconds === 'function' && (
          <Row title="Durée du fondu" description="Temps de recouvrement entre deux pistes.">
            <Select
              value={String(crossfadeSeconds)}
              onChange={(v) => setCrossfadeSeconds(Number(v))}
              label="Durée du fondu"
              options={[
                { value: '2', label: '2 secondes' },
                { value: '3', label: '3 secondes' },
                { value: '5', label: '5 secondes' },
                { value: '8', label: '8 secondes' },
                { value: '12', label: '12 secondes' }
              ]}
            />
          </Row>
        )}
        {typeof setAutoRepair === 'function' && (
          <Row
            title="Réparation automatique"
            description="Télécharge une copie locale quand un titre n’est pas lisible en streaming."
          >
            <Toggle checked={autoRepair} onChange={setAutoRepair} label="Réparation automatique" />
          </Row>
        )}
        {typeof setShowNotifications === 'function' && (
          <Row title="Notifications de téléchargement" description="Affiche la progression en bas à droite.">
            <Toggle checked={showNotifications} onChange={setShowNotifications} label="Notifications" />
          </Row>
        )}
      </Section>

      <Section id="set-shortcuts" title="Raccourcis clavier" description="Actifs partout sauf dans un champ de saisie." icon={Keyboard}>
        <div className="shortcut-grid">
          {SHORTCUTS.map(([keys, desc]) => (
            <div key={keys} className="shortcut-row">
              <kbd className="kbd">{keys}</kbd>
              <span>{desc}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section id="set-storage" title="Stockage local" description="Fichiers téléchargés et données de l’app." icon={FolderOpen}>
        <Row
          title="Téléchargements"
          description={
            downloadsLibrary?.downloadsDir
              ? `${downloadsLibrary.count ?? 0} fichier(s) · ${formatBytes(downloadsLibrary.totalBytes)}`
              : 'Aucun téléchargement pour le moment.'
          }
        >
          {downloadsLibrary?.downloadsDir && (
            <code className="set-path truncate" title={downloadsLibrary.downloadsDir}>
              {downloadsLibrary.downloadsDir}
            </code>
          )}
        </Row>
        <Row title="Historique de recherche" description="Les recherches récentes proposées sous la barre.">
          <button type="button" className="btn-pill" onClick={onClearSearchHistory}>
            <Trash2 size={15} /> Effacer
          </button>
        </Row>
        <Row title="Écoutes récentes" description="Alimente l’accueil et les recommandations.">
          <button type="button" className="btn-pill" onClick={onClearRecent}>
            <RotateCcw size={15} /> Réinitialiser
          </button>
        </Row>
      </Section>

      <Section id="set-spotify" title="Import Spotify" description="Retrouve tes titres likés dans tes favoris Aura." icon={Music4}>
        <p className="set-note">
          Connexion en lecture seule. Aura cherche chaque titre sur SoundCloud et l’ajoute à tes favoris.
        </p>
        <ol className="set-steps">
          <li>
            Crée une app sur{' '}
            <button type="button" className="set-link" onClick={() => openExternal('https://developer.spotify.com/dashboard')}>
              developer.spotify.com/dashboard <ExternalLink size={12} />
            </button>
          </li>
          <li>
            Ajoute cette redirection exacte : <code className="set-path">{spotifyRedirectUri || 'http://127.0.0.1:48921/callback'}</code>
          </li>
          <li>Colle le Client ID ci-dessous, puis lance l’import.</li>
        </ol>
        <Row title="Client ID Spotify" stacked>
          <TextField
            id="spotify-client-id"
            value={spotifyClientId}
            onChange={setSpotifyClientId}
            onBlur={persistSpotifyClientId}
            placeholder="Client ID"
            mono
          />
        </Row>
        {spotifyProgress && <p style={{ margin: '0 0 12px', fontSize: '0.85rem', color: 'var(--accent-color)' }}>{spotifyProgress}</p>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          <button type="button" className="btn-pill btn-pill--accent" disabled={spotifyBusy} onClick={handleSpotifyImport}>
            {spotifyBusy ? 'Import en cours…' : 'Importer mes likes'}
          </button>
          <button type="button" className="set-link" onClick={() => openExternal(TUNE_MY_MUSIC_SPOTIFY_TO_SOUNDCLOUD)}>
            Alternative : Tune My Music <ExternalLink size={12} />
          </button>
        </div>
      </Section>

      <Section id="set-discord" title="Discord" description="Affiche le titre en cours sur ton profil." icon={MessageSquare}>
        <p className="set-note">
          Crée une application sur le{' '}
          <button type="button" className="set-link" onClick={() => openExternal('https://discord.com/developers/applications')}>
            portail développeur <ExternalLink size={12} />
          </button>{' '}
          et colle son Application ID. Discord doit être lancé sur la machine.
        </p>
        <Row title="Application ID" stacked>
          <TextField
            id="discord-app-id"
            value={discordAppId}
            onChange={setDiscordAppId}
            onBlur={persistDiscordAppId}
            placeholder="ex. 1234567890123456789"
            mono
          />
        </Row>
      </Section>

      <Section id="set-about" title="À propos" icon={Info}>
        <Row title="Aura Player" description={appVersion ? `Version ${appVersion}` : 'Version inconnue'}>
          <button
            type="button"
            className="btn-pill"
            onClick={() => openExternal('https://github.com/Tanos91000/playermusic/releases')}
          >
            <ExternalLink size={15} /> Notes de version
          </button>
        </Row>
      </Section>
    </div>
  );
}
