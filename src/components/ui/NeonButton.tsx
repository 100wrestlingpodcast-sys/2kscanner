import React from 'react';

interface NeonButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  className?: string;
}

export function NeonButton({ children, variant = 'primary', className = '', ...props }: NeonButtonProps) {
  let baseClass = 'px-6 py-3 rounded-lg font-bold uppercase tracking-wider transition-all duration-300 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:pointer-events-none ';
  
  switch (variant) {
    case 'primary':
      baseClass += 'bg-bsn-blue text-white border border-bsn-neon shadow-[0_0_15px_rgba(56,189,248,0.5)] hover:shadow-[0_0_25px_rgba(56,189,248,0.8)]';
      break;
    case 'secondary':
      baseClass += 'bg-transparent text-white border border-white/30 hover:border-white/80 hover:bg-white/10';
      break;
    case 'danger':
      baseClass += 'bg-bsn-dark-red text-white border border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)] hover:shadow-[0_0_25px_rgba(239,68,68,0.8)]';
      break;
  }

  return (
    <button className={`${baseClass} ${className}`} {...props}>
      {children}
    </button>
  );
}
