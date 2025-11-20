import React from 'react';
import { soundManager } from '../utils/sound';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  className = '', 
  variant = 'primary', 
  size = 'md',
  onClick,
  ...props 
}) => {
  // Pop style: big rounded corners, glossy gradient, crisp shadow
  const baseStyles = "relative font-black rounded-full transition-all active:scale-95 shadow-candy active:shadow-candy-pressed active:translate-y-[2px] overflow-hidden group";
  
  const variants = {
    primary: "bg-gradient-to-b from-pink-400 to-pink-600 text-white border-2 border-pink-300",
    secondary: "bg-gradient-to-b from-cyan-400 to-cyan-600 text-white border-2 border-cyan-300",
    danger: "bg-gradient-to-b from-red-400 to-red-600 text-white border-2 border-red-300",
    ghost: "bg-transparent shadow-none text-white hover:bg-white/10 border-2 border-white/20 active:translate-y-0 active:scale-100",
  };

  const sizes = {
    sm: "px-4 py-1 text-sm",
    md: "px-8 py-3 text-lg",
    lg: "px-10 py-5 text-2xl tracking-widest",
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      soundManager.playSFX('click');
      if (onClick) onClick(e);
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      onClick={handleClick}
      {...props}
    >
      {/* Shine overlay */}
      <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/30 to-transparent pointer-events-none" />
      <span className="relative z-10 drop-shadow-sm">{children}</span>
    </button>
  );
};