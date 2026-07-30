/**
 * Extraction de la palette dominante d'une image (photo de profil, pochette).
 *
 * Sert à thémer une page entière aux couleurs d'un artiste. L'image est réduite
 * à 36×36 avant lecture : c'est assez pour la teinte générale et ça reste
 * imperceptible côté performances.
 */

const cache = new Map();

function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return [h, s, l];
}

function hslToCss(h, s, l, alpha = 1) {
  const hh = Math.round(h * 360);
  const ss = Math.round(Math.min(1, Math.max(0, s)) * 100);
  const ll = Math.round(Math.min(1, Math.max(0, l)) * 100);
  return alpha >= 1 ? `hsl(${hh} ${ss}% ${ll}%)` : `hsl(${hh} ${ss}% ${ll}% / ${alpha})`;
}

/** Palette de repli quand l'image manque ou n'est pas lisible. */
export const FALLBACK_PALETTE = {
  hue: 211,
  primary: 'hsl(211 100% 52%)',
  soft: 'hsl(211 100% 52% / 0.16)',
  glow: 'hsl(211 100% 52% / 0.38)',
  deep: 'hsl(211 45% 13%)',
  gradient: 'linear-gradient(160deg, hsl(211 60% 24%) 0%, hsl(211 35% 11%) 55%, #09090b 100%)',
  onPrimary: '#ffffff',
  fromImage: false
};

function buildPalette(h, s, l) {
  // On borne la saturation/luminosité pour rester lisible en thème sombre.
  const sat = Math.min(0.9, Math.max(0.35, s));
  const primaryL = Math.min(0.62, Math.max(0.44, l));
  return {
    hue: Math.round(h * 360),
    primary: hslToCss(h, sat, primaryL),
    soft: hslToCss(h, sat, primaryL, 0.16),
    glow: hslToCss(h, sat, primaryL, 0.38),
    deep: hslToCss(h, Math.min(0.5, sat), 0.12),
    gradient: `linear-gradient(160deg, ${hslToCss(h, sat * 0.8, 0.24)} 0%, ${hslToCss(h, sat * 0.5, 0.11)} 55%, #09090b 100%)`,
    onPrimary: primaryL > 0.55 ? '#0a0a0c' : '#ffffff',
    fromImage: true
  };
}

/**
 * Renvoie une palette pour `url`. Résout toujours (repli en cas d'échec),
 * jamais de rejet : l'appelant peut l'utiliser directement dans un effet.
 */
export function extractPalette(url) {
  if (!url || typeof url !== 'string') return Promise.resolve(FALLBACK_PALETTE);
  const cached = cache.get(url);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const finish = (palette) => {
      cache.set(url, palette);
      resolve(palette);
    };

    img.onerror = () => finish(FALLBACK_PALETTE);
    img.onload = () => {
      try {
        const size = 36;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return finish(FALLBACK_PALETTE);
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        // Regroupement par secteur de teinte, pondéré par saturation :
        // une couleur franche pèse plus qu'un gris majoritaire.
        const buckets = new Array(18).fill(null).map(() => ({ weight: 0, h: 0, s: 0, l: 0, n: 0 }));

        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3];
          if (alpha < 128) continue;
          const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
          if (l < 0.12 || l > 0.94) continue; // ignore les extrêmes (fond noir/blanc)
          const weight = s * s * (1 - Math.abs(l - 0.5));
          const idx = Math.min(17, Math.floor(h * 18));
          const b = buckets[idx];
          b.weight += weight;
          b.h += h;
          b.s += s;
          b.l += l;
          b.n += 1;
        }

        let best = null;
        for (const b of buckets) {
          if (b.n === 0) continue;
          if (!best || b.weight > best.weight) best = b;
        }

        if (!best || best.weight <= 0.0001) return finish(FALLBACK_PALETTE);
        return finish(buildPalette(best.h / best.n, best.s / best.n, best.l / best.n));
      } catch {
        // Canvas contaminé (CORS) : on retombe sur la palette par défaut.
        return finish(FALLBACK_PALETTE);
      }
    };

    img.src = url;
  });
}
