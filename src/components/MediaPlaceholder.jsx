import { useEffect, useMemo, useState, useRef } from 'react';
import { normalizeSoundCloudAvatarUrl } from '../utils/soundcloudArtist';
import trackDefaultSrc from '../assets/placeholders/track-default.svg?url';
import avatarDefaultSrc from '../assets/placeholders/avatar-default.svg?url';

export const DEFAULT_TRACK_ART_IMAGE = trackDefaultSrc;
export const DEFAULT_AVATAR_IMAGE = avatarDefaultSrc;

export function TrackArtPlaceholder({ size = 48, radius = 4, style = {}, marginRight }) {
  return (
    <img
      src={DEFAULT_TRACK_ART_IMAGE}
      alt=""
      width={size}
      height={size}
      draggable={false}
      loading="lazy"
      decoding="async"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        objectFit: 'cover',
        flexShrink: 0,
        marginRight: marginRight ?? undefined,
        backgroundColor: 'rgba(255,255,255,0.06)',
        ...style
      }}
      aria-hidden
    />
  );
}

export function AvatarPlaceholder({ size = 72, style = {} }) {
  return (
    <img
      src={DEFAULT_AVATAR_IMAGE}
      alt=""
      width={size}
      height={size}
      draggable={false}
      loading="lazy"
      decoding="async"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        objectFit: 'cover',
        flexShrink: 0,
        backgroundColor: 'rgba(255,255,255,0.06)',
        ...style
      }}
      aria-hidden
    />
  );
}

/**
 * Avatar distant avec repli si URL invalide / erreur réseau (évite icône image cassée).
 * variant list = vignettes légères ; profile = jaquette profil.
 */
export function RemoteAvatar({
  url,
  size = 72,
  variant = 'list',
  wrapperStyle = {},
  imgStyle = {}
}) {
  const [failed, setFailed] = useState(false);
  const resolved = useMemo(() => normalizeSoundCloudAvatarUrl(url, variant), [url, variant]);

  useEffect(() => {
    setFailed(false);
  }, [url]);

  const placeholder = <AvatarPlaceholder size={size} style={{ display: 'block', ...imgStyle }} />;

  if (!resolved || failed) {
    return (
      <div
        style={{
          width: size,
          marginLeft: 'auto',
          marginRight: 'auto',
          flexShrink: 0,
          ...wrapperStyle
        }}
      >
        {placeholder}
      </div>
    );
  }

  return (
    <div
      style={{
        width: size,
        marginLeft: 'auto',
        marginRight: 'auto',
        flexShrink: 0,
        ...wrapperStyle
      }}
    >
      <img
        src={resolved}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={() => setFailed(true)}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          display: 'block',
          pointerEvents: 'none',
          ...imgStyle
        }}
      />
    </div>
  );
}
