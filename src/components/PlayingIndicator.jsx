import { Pause } from 'lucide-react';

/** Spotify-like animated bars when playing; pause icon when current track is paused */
export default function PlayingIndicator({ playing }) {
  if (!playing) {
    return (
      <Pause size={18} strokeWidth={2} fill="currentColor" style={{ flexShrink: 0 }} aria-hidden />
    );
  }
  return (
    <span className="playing-bars" aria-label="En lecture">
      <span className="playing-bars__bar" />
      <span className="playing-bars__bar" />
      <span className="playing-bars__bar" />
    </span>
  );
}
