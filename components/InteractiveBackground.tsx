
import React from 'react';
import { Database } from 'lucide-react';

const InteractiveBackground: React.FC = () => {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none bg-slate-950">
      {/* Subtle Grid */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>
      
      {/* Static Glow - Centered/Top Left */}
      <div 
        className="fixed top-[-10%] left-[-10%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-3xl mix-blend-screen"
      />
      <div 
        className="fixed bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-3xl mix-blend-screen"
      />

      {/* Static Center Piece */}
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.02]">
         <Database size={400} />
      </div>
    </div>
  );
};

export default InteractiveBackground;
