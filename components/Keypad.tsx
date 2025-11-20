import React from 'react';
import { Delete, Eraser } from 'lucide-react';

interface KeypadProps {
  onInput: (num: number) => void;
  onDelete: () => void;
  onClear: () => void;
  onSubmit?: () => void;
}

export const Keypad: React.FC<KeypadProps> = ({ onInput, onDelete, onClear }) => {
  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  const ButtonBase = "relative w-full h-full rounded-2xl flex items-center justify-center text-2xl font-bold transition-all active:scale-95 shadow-candy active:shadow-candy-pressed group";

  return (
    <div className="grid grid-cols-3 gap-3 p-2 max-w-sm mx-auto w-full h-full">
      {keys.map((num) => (
        <button
          key={num}
          onClick={() => onInput(num)}
          className={`${ButtonBase} bg-gradient-to-b from-indigo-400 to-indigo-600 border border-indigo-300/50 text-white`}
        >
          <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/20 to-transparent rounded-t-2xl" />
          <span className="relative z-10 drop-shadow-md">{num}</span>
        </button>
      ))}
      
      <button
        onClick={onClear}
        className={`${ButtonBase} bg-gradient-to-b from-red-400 to-red-600 border border-red-300/50 text-white`}
      >
         <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/20 to-transparent rounded-t-2xl" />
        <Eraser size={24} className="relative z-10 drop-shadow-md" />
      </button>
      
      <button
        onClick={() => onInput(0)}
        className={`${ButtonBase} bg-gradient-to-b from-indigo-400 to-indigo-600 border border-indigo-300/50 text-white`}
      >
         <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/20 to-transparent rounded-t-2xl" />
        <span className="relative z-10 drop-shadow-md">0</span>
      </button>
      
      <button
        onClick={onDelete}
        className={`${ButtonBase} bg-gradient-to-b from-yellow-400 to-orange-500 border border-yellow-200/50 text-white`}
      >
         <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/20 to-transparent rounded-t-2xl" />
        <Delete size={24} className="relative z-10 drop-shadow-md" />
      </button>
    </div>
  );
};