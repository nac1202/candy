
export type GameStatus = 'MENU' | 'PLAYING' | 'GAMEOVER';

export type Operator = '+' | '-';

export interface CandyColor {
  from: string;
  to: string;
  border: string;
  shadow: string;
}

export interface FallingItem {
  id: string;
  col: number; // 0 to COLUMNS-1
  y: number; // 0 to 100 (percentage of game height)
  expression: string;
  answer: number;
  speed: number;
  colorData: CandyColor; 
}

export interface Block {
  id: string;
  col: number;
  row: number; // 0 is bottom, MAX_ROWS is top
  colorData: CandyColor;
  lastImpact: number; // Timestamp to trigger jelly animation
  status: 'idle' | 'clearing'; // 'clearing' means it is animating out
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
}

export interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  scale: number;
}

// Define the candy flavors (gradients)
export const CANDY_COLORS: CandyColor[] = [
  { from: 'from-pink-400', to: 'to-rose-600', border: 'border-pink-300', shadow: 'shadow-pink-800' },   // Strawberry
  { from: 'from-cyan-400', to: 'to-blue-600', border: 'border-cyan-300', shadow: 'shadow-blue-800' },   // Blueberry
  { from: 'from-yellow-300', to: 'to-orange-500', border: 'border-yellow-200', shadow: 'shadow-orange-800' }, // Lemon
  { from: 'from-lime-400', to: 'to-green-600', border: 'border-lime-300', shadow: 'shadow-green-800' }, // Apple
  { from: 'from-purple-400', to: 'to-indigo-600', border: 'border-purple-300', shadow: 'shadow-indigo-800' }, // Grape
];
