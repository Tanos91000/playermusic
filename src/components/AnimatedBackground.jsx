import { useEffect, useState } from 'react';

export default function AnimatedBackground({ imageUrl }) {
  const [colors, setColors] = useState(['#1a1a1a', '#0d0d0d']);

  useEffect(() => {
    if (!imageUrl) {
      setColors(['#1a1a1a', '#0d0d0d']);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imageUrl;
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        // Resize down to 3x1 pixels to get 3 representative averaged colors
        canvas.width = 3;
        canvas.height = 1;
        ctx.drawImage(img, 0, 0, 3, 1);
        
        const data = ctx.getImageData(0, 0, 3, 1).data;
        if (data && data.length >= 12) {
          setColors([
            `rgb(${data[0]}, ${data[1]}, ${data[2]})`,
            `rgb(${data[4]}, ${data[5]}, ${data[6]})`,
            `rgb(${data[8]}, ${data[9]}, ${data[10]})`
          ]);
        }
      } catch (err) {
        console.error('Failed to extract colors', err);
      }
    };
  }, [imageUrl]);

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      zIndex: -2, overflow: 'hidden', backgroundColor: '#000',
      transition: 'background-color 1s ease'
    }}>
      {/* Base blurred artwork */}
      <div style={{
        position: 'absolute', top: '-10%', left: '-10%', width: '120%', height: '120%',
        backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center',
        filter: 'blur(50px) brightness(0.9) saturate(1.5)', opacity: 1,
        transition: 'background-image 1s ease'
      }} />

      {/* Animated gradient orbs */}
      <div className="orb orb-1" style={{ backgroundColor: colors[0] }}></div>
      <div className="orb orb-2" style={{ backgroundColor: colors[1] }}></div>
      <div className="orb orb-3" style={{ backgroundColor: colors[2] || colors[0] }}></div>

      <style>{`
        .orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 1;
          animation: float 20s infinite ease-in-out alternate;
          transition: background-color 2s ease;
          mix-blend-mode: screen;
        }
        .orb-1 { width: 70vw; height: 70vw; top: -15vw; left: -15vw; animation-delay: 0s; }
        .orb-2 { width: 60vw; height: 60vw; bottom: -15vw; right: -15vw; animation-delay: -5s; animation-direction: alternate-reverse; }
        .orb-3 { width: 50vw; height: 50vw; top: 20vh; left: 20vw; animation-delay: -10s; }

        @keyframes float {
          0% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(15vw, 10vh) scale(1.1); }
          66% { transform: translate(-10vw, 20vh) scale(0.9); }
          100% { transform: translate(-20vw, -10vh) scale(1.2); }
        }
      `}</style>
    </div>
  );
}
