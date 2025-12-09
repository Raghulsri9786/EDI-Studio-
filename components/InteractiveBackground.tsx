
import React, { useEffect, useRef } from 'react';
import { Database } from 'lucide-react';

const InteractiveBackground: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const cursor = cursorRef.current;
    if (!container || !cursor || !window.gsap) return;

    const gsap = window.gsap;

    const onMove = (e: MouseEvent) => {
      // Smoothly animate the "glow" follower
      gsap.to(cursor, {
        x: e.clientX,
        y: e.clientY,
        duration: 1.5,
        ease: "power3.out"
      });
    };

    window.addEventListener('mousemove', onMove);

    return () => {
      window.removeEventListener('mousemove', onMove);
    };
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 z-0 overflow-hidden pointer-events-none bg-slate-950">
      {/* Subtle Grid */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>
      
      {/* Moving Glow */}
      <div 
        ref={cursorRef} 
        className="fixed top-0 left-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none mix-blend-screen"
      />

      {/* Static Center Piece */}
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.02]">
         <Database size={400} />
      </div>
    </div>
  );
};

export default InteractiveBackground;
