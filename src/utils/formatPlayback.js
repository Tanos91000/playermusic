/** Affichage compact du nombre de lectures SoundCloud */
export function formatStreamCount(n) {
  if (n == null || Number.isNaN(n)) return null;
  const x = Math.max(0, Math.floor(Number(n)));
  if (x >= 1e9) return `${(x / 1e9).toFixed(1).replace(/\.0$/, '')} Md`;
  if (x >= 1e6) return `${(x / 1e6).toFixed(1).replace(/\.0$/, '')} M`;
  if (x >= 1e3) return `${Math.round(x / 1e3)} k`;
  return `${x}`;
}
