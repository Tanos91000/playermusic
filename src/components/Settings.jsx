import React, { useEffect, useState } from 'react';

export default function Settings({ eqBands, setEqBands, reverb, setReverb, reverbEnabled, setReverbEnabled, djMode, setDjMode }) {
  const frequencies = ['60Hz', '230Hz', '910Hz', '3.6kHz', '14kHz'];
  const [appVersion, setAppVersion] = useState('');

  useEffect(() => {
    if (window.electronAPI && window.electronAPI.getAppVersion) {
      window.electronAPI.getAppVersion().then(version => setAppVersion(version));
    }
  }, []);

  const handleSliderChange = (index, value) => {
    const newBands = [...eqBands];
    newBands[index] = parseFloat(value);
    setEqBands(newBands);
  };

  const resetEQ = () => setEqBands([0, 0, 0, 0, 0]);
  const applyBassBoost = () => setEqBands([6.5, 1.5, -1.0, 2.0, 3.5]);

  return (
    <div className="glass animate-fade-in" style={{ padding: '30px', maxWidth: '600px', margin: '0 auto', marginTop: '20px' }}>
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

      {appVersion && (
        <div style={{ textAlign: 'center', marginTop: '20px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Aura Player - Version {appVersion}
        </div>
      )}
    </div>
  );
}
