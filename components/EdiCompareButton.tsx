
import React, { useRef, useEffect } from 'react';
import { GitCompare, Loader2 } from 'lucide-react';

interface EdiCompareButtonProps {
  onClick: () => void;
  isLoading: boolean;
  disabled?: boolean;
}

const EdiCompareButton: React.FC<EdiCompareButtonProps> = ({ onClick, isLoading, disabled }) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.gsap) return;
    
    // Pulse animation for glow when idle
    const pulseAnim = window.gsap.to(glowRef.current, {
      opacity: 0.6,
      scale: 1.1,
      duration: 2,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
      paused: true
    });

    if (!disabled && !isLoading) {
        pulseAnim.play();
    } else {
        pulseAnim.pause();
        window.gsap.set(glowRef.current, { opacity: 0 });
    }

    return () => {
        pulseAnim.kill();
    };
  }, [disabled, isLoading]);

  const handleMouseEnter = () => {
    if (disabled || isLoading) return;
    if (window.gsap) {
      window.gsap.to(buttonRef.current, { scale: 1.05, duration: 0.3, ease: "back.out(1.7)" });
      window.gsap.to(glowRef.current, { opacity: 0.8, scale: 1.2, duration: 0.3 });
    }
  };

  const handleMouseLeave = () => {
    if (disabled || isLoading) return;
    if (window.gsap) {
      window.gsap.to(buttonRef.current, { scale: 1, duration: 0.3, ease: "power2.out" });
      window.gsap.to(glowRef.current, { opacity: 0.4, scale: 1, duration: 0.3 });
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (disabled || isLoading) return;
    
    // Ripple Effect Logic
    if (window.gsap) {
        const btn = buttonRef.current;
        if(btn) {
            const rect = btn.getBoundingClientRect();
            const ripple = document.createElement("div");
            const size = Math.max(rect.width, rect.height) * 2;
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.position = 'absolute';
            ripple.style.top = `${y}px`;
            ripple.style.left = `${x}px`;
            ripple.style.width = `${size}px`;
            ripple.style.height = `${size}px`;
            ripple.style.borderRadius = '50%';
            ripple.style.backgroundColor = 'rgba(255, 255, 255, 0.4)';
            ripple.style.pointerEvents = 'none';
            ripple.style.transform = 'scale(0)';
            
            btn.appendChild(ripple);
            
            window.gsap.to(ripple, {
                scale: 1,
                opacity: 0,
                duration: 0.6,
                ease: "power2.out",
                onComplete: () => ripple.remove()
            });
        }
    }

    onClick();
  };

  return (
    <div className="relative group">
      {/* Background Glow */}
      <div 
        ref={glowRef}
        className="absolute inset-0 bg-blue-500 rounded-2xl blur-xl opacity-0 transition-opacity pointer-events-none"
      ></div>

      <button
        ref={buttonRef}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        disabled={disabled || isLoading}
        className={`
            relative z-10 flex items-center justify-center gap-3 px-10 py-5 
            bg-gradient-to-br from-slate-900 to-slate-800 
            border border-blue-500/30 rounded-2xl 
            text-white font-bold text-lg tracking-wide
            shadow-[0_0_20px_rgba(59,130,246,0.15)]
            overflow-hidden
            disabled:opacity-50 disabled:cursor-not-allowed
            disabled:shadow-none
        `}
      >
        {/* Shine Sweep Effect */}
        <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-[150%] skew-x-12 group-hover:animate-shine pointer-events-none" />

        {isLoading ? (
          <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
        ) : (
          <GitCompare className="w-6 h-6 text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
        )}
        
        <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-blue-200">
            {isLoading ? "Analyzing..." : "EDI Compare"}
        </span>
      </button>
      
      {/* CSS Animation for Shine */}
      <style>{`
        @keyframes shine {
            from { transform: translateX(-150%) skewX(-12deg); }
            to { transform: translateX(150%) skewX(-12deg); }
        }
        .group:hover .group-hover\\:animate-shine {
            animation: shine 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default EdiCompareButton;
