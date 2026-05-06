/** Fond basé sur la pochette : flou CSS uniquement (pas de WebGL). */
export default function AnimatedBackground({ imageUrl }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: '-28vh',
        left: '-28vw',
        width: '156vw',
        height: '156vh',
        zIndex: -2,
        overflow: 'hidden',
        pointerEvents: 'none',
        backgroundColor: '#070708'
      }}
    >
      {imageUrl ? (
        <div
          style={{
            position: 'absolute',
            inset: '-18%',
            backgroundImage: `url(${imageUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(56px) brightness(0.45)',
            opacity: 0.85
          }}
        />
      ) : null}
    </div>
  );
}
