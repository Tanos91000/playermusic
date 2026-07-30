/** Ordre de lecture : aléatoire (Fisher-Yates) et navigation piste suivante / précédente. */

/**
 * Ordre aléatoire des indices `0..length-1`.
 * `startIndex` est placé en tête pour que la piste en cours reste la première.
 */
export function buildShuffleOrder(length, startIndex = -1) {
  const indices = [];
  for (let i = 0; i < length; i += 1) {
    if (i !== startIndex) indices.push(i);
  }
  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return startIndex >= 0 && startIndex < length ? [startIndex, ...indices] : indices;
}

function step({ length, currentIndex, shuffle, shuffleOrder, repeatMode, direction }) {
  if (length <= 0) return -1;

  if (shuffle && Array.isArray(shuffleOrder) && shuffleOrder.length === length) {
    const pos = shuffleOrder.indexOf(currentIndex);
    if (pos < 0) return shuffleOrder[0];
    const nextPos = pos + direction;
    if (nextPos >= 0 && nextPos < shuffleOrder.length) return shuffleOrder[nextPos];
    if (repeatMode === 'all') {
      return shuffleOrder[nextPos < 0 ? shuffleOrder.length - 1 : 0];
    }
    return -1;
  }

  const nextIndex = currentIndex + direction;
  if (nextIndex >= 0 && nextIndex < length) return nextIndex;
  if (repeatMode === 'all') return nextIndex < 0 ? length - 1 : 0;
  return -1;
}

/** Index de la piste suivante, ou -1 si la lecture doit s'arrêter. */
export function nextIndexFor(options) {
  return step({ ...options, direction: 1 });
}

/** Index de la piste précédente, ou -1 s'il n'y en a pas. */
export function prevIndexFor(options) {
  return step({ ...options, direction: -1 });
}

/** Ordre de lecture restant après la piste courante (pour le panneau « file d'attente »). */
export function upcomingIndices({ length, currentIndex, shuffle, shuffleOrder, limit = 30 }) {
  if (length <= 0) return [];
  const order =
    shuffle && Array.isArray(shuffleOrder) && shuffleOrder.length === length
      ? shuffleOrder
      : Array.from({ length }, (_, i) => i);
  const pos = order.indexOf(currentIndex);
  return order.slice(pos + 1, pos + 1 + limit);
}
