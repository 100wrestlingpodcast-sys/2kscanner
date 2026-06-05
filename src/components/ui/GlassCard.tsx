import React from 'react';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  glowColor?: 'blue' | 'red' | 'neon' | 'none';
}

export function GlassCard({ children, className = '', glowColor = 'none', ...props }: GlassCardProps) {
  let glowClass = '';
  switch (glowColor) {
    case 'blue':
      glowClass = 'shadow-[0_0_20px_rgba(59,130,246,0.3)]';
      break;
    case 'red':
      glowClass = 'shadow-[0_0_20px_rgba(239,68,68,0.3)]';
      break;
    case 'neon':
      glowClass = 'shadow-[0_0_20px_rgba(56,189,248,0.3)]';
      break;
  }

  return (
    <div
      className={`bg-black/40 backdrop-blur-md border border-white/10 rounded-xl ${glowClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
