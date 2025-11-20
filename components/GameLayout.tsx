
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, RefreshCw, Trophy, Flame, Volume2, VolumeX, Sparkles } from 'lucide-react';
import { Button } from './Button';
import { Keypad } from './Keypad';
import { GameStatus, FallingItem, Block, CANDY_COLORS, Particle, CandyColor } from '../types';
import { COLUMNS, MAX_ROWS, ROW_HEIGHT_PERCENT, BASE_SPEED, SPAWN_RATE_INITIAL, DIFFICULTY_SCALING } from '../constants';
import { generateProblem, randomInt } from '../utils/math';
import { soundManager } from '../utils/sound';

export const GameLayout: React.FC = () => {
  // -- State --
  const [status, setStatus] = useState<GameStatus>('MENU');
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [currentInput, setCurrentInput] = useState<string>('');
  const [fallingItems, setFallingItems] = useState<FallingItem[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  
  // -- Refs for Game Loop --
  const requestRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const lastSpawnTimeRef = useRef<number>(0);
  const gameSpeedRef = useRef<number>(BASE_SPEED);
  const spawnRateRef = useRef<number>(SPAWN_RATE_INITIAL);
  
  // To avoid stale closures in animation frame
  const stateRef = useRef({
    status,
    fallingItems,
    blocks,
    level,
    score
  });

  useEffect(() => {
    stateRef.current = { status, fallingItems, blocks, level, score };
  }, [status, fallingItems, blocks, level, score]);

  // -- Audio Controls --
  const toggleMute = () => {
    const muted = soundManager.toggleMute();
    setIsMuted(muted);
  };

  const startGame = () => {
    soundManager.resume();
    soundManager.startBGM();
    resetGame();
  };

  const resetGame = () => {
    setScore(0);
    setLevel(1);
    setFallingItems([]);
    setBlocks([]);
    setParticles([]);
    setCurrentInput('');
    gameSpeedRef.current = BASE_SPEED;
    spawnRateRef.current = SPAWN_RATE_INITIAL;
    lastSpawnTimeRef.current = 0;
    setStatus('PLAYING');
  };

  // -- Game Logic Helpers --

  const spawnItem = useCallback(() => {
    const col = randomInt(0, COLUMNS - 1);
    
    // Check height of this column
    const blocksInCol = stateRef.current.blocks.filter(b => b.col === col).length;
    if (blocksInCol >= MAX_ROWS) return; 

    const problem = generateProblem(stateRef.current.level);
    const newItem: FallingItem = {
      id: Math.random().toString(36).substr(2, 9),
      col,
      y: -15, 
      expression: problem.expression,
      answer: problem.answer,
      speed: gameSpeedRef.current * (randomInt(90, 110) / 100),
      colorData: CANDY_COLORS[randomInt(0, CANDY_COLORS.length - 1)],
    };

    setFallingItems(prev => [...prev, newItem]);
  }, []);

  const gameOver = () => {
    setStatus('GAMEOVER');
    soundManager.stopBGM();
    soundManager.playSFX('gameover');
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
  };

  const addParticles = useCallback((x: number, y: number, color: string, count: number) => {
    const newParticles: Particle[] = [];
    for(let i=0; i<count; i++) {
      newParticles.push({
        id: Math.random().toString(),
        x,
        y,
        vx: (Math.random() - 0.5) * 2.5,
        vy: (Math.random() - 0.5) * 2.5,
        color,
        life: 1.0
      });
    }
    setParticles(prev => [...prev, ...newParticles]);
  }, []);

  // -- Main Loop --

  const update = useCallback((time: number) => {
    if (stateRef.current.status !== 'PLAYING') return;

    if (!lastTimeRef.current) lastTimeRef.current = time;
    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;

    // Spawning
    if (time - lastSpawnTimeRef.current > spawnRateRef.current) {
      spawnItem();
      lastSpawnTimeRef.current = time;
    }

    // Physics
    setFallingItems(prevItems => {
      const nextItems: FallingItem[] = [];
      const newBlocks: Block[] = [];
      let isGameOver = false;

      prevItems.forEach(item => {
        const moveAmt = item.speed * (deltaTime / 16);
        const nextY = item.y + moveAmt;

        const blocksInCol = stateRef.current.blocks.filter(b => b.col === item.col).length;
        // Calculate floor Y %
        const floorY = 100 - ((blocksInCol + 1) * ROW_HEIGHT_PERCENT);

        if (nextY >= floorY) {
          // Land
          soundManager.playSFX('land');
          newBlocks.push({
            id: `block-${Date.now()}-${Math.random()}`,
            col: item.col,
            row: blocksInCol,
            colorData: item.colorData,
            lastImpact: Date.now(),
          });
          
          if (blocksInCol + 1 >= MAX_ROWS) {
            isGameOver = true;
          }
        } else {
          nextItems.push({ ...item, y: nextY });
        }
      });

      if (newBlocks.length > 0) {
         setBlocks(prev => {
          const affectedCols = new Set(newBlocks.map(b => b.col));
          // Propagate "squash" to existing blocks in column
          const updatedPrev = prev.map(b => {
            if (affectedCols.has(b.col)) {
              return { ...b, lastImpact: Date.now() };
            }
            return b;
          });
          return [...updatedPrev, ...newBlocks];
        });
      }
      
      if (isGameOver) {
        gameOver();
      }

      return nextItems;
    });

    // Particles
    setParticles(prev => prev.map(p => ({
      ...p,
      x: p.x + p.vx,
      y: p.y + p.vy,
      life: p.life - 0.03
    })).filter(p => p.life > 0));

    requestRef.current = requestAnimationFrame(update);
  }, [spawnItem]);

  useEffect(() => {
    if (status === 'PLAYING') {
      requestRef.current = requestAnimationFrame(update);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [status, update]);

  // -- Inputs --

  const checkAnswer = useCallback((inputVal: string) => {
    const numVal = parseInt(inputVal, 10);
    if (isNaN(numVal)) return;

    const items = [...stateRef.current.fallingItems];
    
    // --- RULE: SUM ALL FALLING ---
    // If player types the sum of ALL currently falling items (and there are > 1), 
    // clear all falling items AND matching colored blocks from stack.
    if (items.length > 1) {
        const totalSum = items.reduce((acc, item) => acc + item.answer, 0);
        if (numVal === totalSum) {
            soundManager.playSFX('mega_clear');
            
            // Identify colors involved in the combo
            const involvedColors = new Set(items.map(i => i.colorData.from));
            
            // Particles for falling items
            items.forEach(item => {
                 addParticles(item.col * (100/COLUMNS) + 10, item.y + 5, '#ffffff', 10);
            });

            // Clear all falling
            setFallingItems([]);

            // Clear blocks from stack logic
            setBlocks(prevBlocks => {
                // Filter out blocks that match the colors
                const keptBlocks = prevBlocks.filter(b => !involvedColors.has(b.colorData.from));
                
                // Particles for the blocks being removed (using current state to find them)
                prevBlocks.forEach(b => {
                    if (involvedColors.has(b.colorData.from)) {
                        addParticles(b.col * (100/COLUMNS) + 10, 100 - (b.row * ROW_HEIGHT_PERCENT) - 5, b.colorData.to, 8);
                    }
                });

                // Re-calculate rows (Gravity) for kept blocks
                const newBlocks: Block[] = [];
                for (let c = 0; c < COLUMNS; c++) {
                    const colBlocks = keptBlocks.filter(b => b.col === c);
                    colBlocks.sort((a, b) => a.row - b.row); // sort bottom to top
                    colBlocks.forEach((b, idx) => {
                        newBlocks.push({ ...b, row: idx, lastImpact: Date.now() });
                    });
                }
                return newBlocks;
            });

            // Bonus Score
            setScore(prev => prev + 100 + (items.length * 50));
            setCurrentInput('');
            return; 
        }
    }

    // --- STANDARD RULE: SINGLE ITEM ---
    // Prioritize lowest items
    items.sort((a, b) => b.y - a.y);

    const matchIndex = items.findIndex(item => item.answer === numVal);

    if (matchIndex !== -1) {
      const matchedItem = items[matchIndex];
      soundManager.playSFX('correct');
      
      setFallingItems(prev => prev.filter(i => i.id !== matchedItem.id));
      
      // Particle effect
      addParticles(matchedItem.col * (100/COLUMNS) + 10, matchedItem.y + 5, '#fff', 8);
      
      // Score logic
      setScore(prev => {
        const newScore = prev + 10 + stateRef.current.level;
        if (newScore % DIFFICULTY_SCALING.LEVEL_THRESHOLD === 0) {
          setLevel(l => l + 1);
          gameSpeedRef.current += DIFFICULTY_SCALING.SPEED_INC;
          spawnRateRef.current = Math.max(500, spawnRateRef.current - DIFFICULTY_SCALING.SPAWN_DEC);
        }
        return newScore;
      });
      
      setCurrentInput('');
    } else {
        // Auto clear if too long
        if (inputVal.length > 3) {
            setCurrentInput('');
            soundManager.playSFX('wrong');
        }
    }
  }, [addParticles]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (status !== 'PLAYING') return;

      if (e.key >= '0' && e.key <= '9') {
        // Use functional update to get latest state
        setCurrentInput(prev => {
            const next = prev + e.key;
            checkAnswer(next);
            return next;
        });
      } else if (e.key === 'Backspace') {
        setCurrentInput(prev => prev.slice(0, -1));
      } else if (e.key === 'Escape') {
         // Optional pause
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, checkAnswer]);


  // -- Styles --
  const getCandyStyle = (color: CandyColor) => {
    return `bg-gradient-to-br ${color.from} ${color.to} border-2 ${color.border} ${color.shadow}`;
  };

  return (
    <div className="relative w-full h-full max-w-md mx-auto flex flex-col overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-900 to-fuchsia-900 shadow-2xl">
      
      {/* Background FX */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.15),transparent)] pointer-events-none" />
      
      {/* Header / HUD */}
      <div className="relative z-20 flex justify-between items-center p-4 pt-6">
        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 shadow-glass">
           <Trophy size={20} className="text-yellow-300" />
           <span className="font-bold text-xl text-white">{score}</span>
        </div>
        
        <div className="flex items-center gap-2">
             <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 shadow-glass mr-2">
                <Flame size={20} className="text-orange-400" />
                <span className="font-bold text-lg text-white">Lv.{level}</span>
            </div>

            <button 
                onClick={toggleMute}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors active:scale-95"
            >
                {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
            </button>
        </div>
      </div>

      {/* Game Container */}
      <div className="relative flex-1 w-full mt-2 mb-2">
        
        {/* Grid Cols */}
        <div className="absolute inset-0 flex pointer-events-none opacity-5">
            {Array.from({ length: COLUMNS }).map((_, i) => (
                <div key={i} className="flex-1 border-r border-white last:border-0" />
            ))}
        </div>

        {/* Particles */}
        {particles.map(p => (
            <div 
                key={p.id}
                className="absolute rounded-full pointer-events-none"
                style={{
                    left: `${p.x}%`,
                    top: `${p.y}%`,
                    width: '6px',
                    height: '6px',
                    backgroundColor: p.color,
                    opacity: p.life,
                    transform: `scale(${p.life}) translate(-50%, -50%)`
                }}
            />
        ))}

        {/* Blocks (Stacked) */}
        {blocks.map(block => (
            <div
                key={`${block.id}-${block.lastImpact}`} 
                className={`absolute px-1 transition-transform animate-jelly origin-bottom`}
                style={{
                    left: `${block.col * (100 / COLUMNS)}%`,
                    bottom: `${block.row * ROW_HEIGHT_PERCENT}%`,
                    width: `${100 / COLUMNS}%`,
                    height: `${ROW_HEIGHT_PERCENT}%`,
                }}
            >
                <div className={`w-full h-full rounded-xl shadow-candy relative flex items-center justify-center ${getCandyStyle(block.colorData)}`}>
                    <div className="absolute top-1 left-1 right-1 h-1/3 bg-gradient-to-b from-white/40 to-transparent rounded-t-lg" />
                </div>
            </div>
        ))}

        {/* Falling Items */}
        {fallingItems.map(item => (
            <div
                key={item.id}
                className="absolute px-1 will-change-transform" 
                style={{
                    left: `${item.col * (100 / COLUMNS)}%`,
                    top: `${item.y}%`,
                    width: `${100 / COLUMNS}%`,
                    height: `${ROW_HEIGHT_PERCENT}%`,
                }}
            >
                 <div className={`w-full h-full rounded-full shadow-candy relative flex items-center justify-center ${getCandyStyle(item.colorData)}`}>
                    <div className="absolute top-2 left-1/4 w-1/2 h-1/3 bg-gradient-to-b from-white/50 to-transparent rounded-full" />
                    <span className="font-black text-white text-lg md:text-xl relative z-10 drop-shadow-md">
                        {item.expression}
                    </span>
                </div>
            </div>
        ))}
        
        {/* Danger Line at top */}
        <div className="absolute top-0 w-full border-b-2 border-red-500/30 border-dashed pointer-events-none" />
      </div>

      {/* Input Display */}
      <div className="relative z-20 w-full px-4 mb-2">
        <div className="w-full h-14 bg-black/30 backdrop-blur-md rounded-2xl border-2 border-white/10 flex items-center justify-center shadow-inner transition-all">
             <span className="text-3xl font-mono text-white font-bold tracking-widest drop-shadow-lg">
                {currentInput || <span className="opacity-20">...</span>}
             </span>
        </div>
      </div>

      {/* Keypad Area */}
      <div className="relative z-20 w-full bg-black/20 backdrop-blur-lg rounded-t-3xl pt-2 pb-6 shadow-[0_-4px_20px_rgba(0,0,0,0.3)] border-t border-white/10">
         <Keypad 
            onInput={(n) => {
                const next = currentInput + n;
                setCurrentInput(next);
                checkAnswer(next);
            }}
            onDelete={() => setCurrentInput(prev => prev.slice(0, -1))}
            onClear={() => setCurrentInput('')}
         />
      </div>

      {/* Menu Overlay */}
      {status === 'MENU' && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in">
              <div className="p-8 bg-white rounded-[2rem] shadow-2xl text-center max-w-xs transform scale-100 transition-transform border-4 border-pink-200">
                  <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-600 mb-2 drop-shadow-sm tracking-tight">
                    Stack<br/>Attack
                  </h1>
                  <p className="text-slate-500 mb-8 font-bold">Solve math, stack candy!</p>
                  <div className="text-sm text-slate-400 mb-4 bg-slate-50 p-2 rounded-lg">
                      <p className="font-bold text-pink-500">Pro Tip:</p>
                      <p>Sum ALL falling numbers to clear matching colors!</p>
                  </div>
                  <Button onClick={startGame} size="lg" className="w-full animate-pulse-fast shadow-xl">
                      <div className="flex items-center justify-center gap-2">
                        <Play fill="currentColor" /> PLAY
                      </div>
                  </Button>
              </div>
          </div>
      )}

      {/* Game Over Overlay */}
      {status === 'GAMEOVER' && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-red-900/80 backdrop-blur-md animate-in zoom-in duration-300">
              <div className="p-8 bg-white rounded-[2rem] shadow-2xl text-center max-w-xs w-full border-4 border-red-300 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-2 bg-red-400" />
                  <h2 className="text-4xl font-black text-red-500 mb-1 mt-2">GAME OVER</h2>
                  <p className="text-slate-400 text-sm mb-6 uppercase tracking-wider font-bold">Stack Overflow!</p>
                  
                  <div className="bg-slate-100 rounded-2xl p-4 mb-6 inner-shadow">
                      <p className="text-slate-500 text-xs font-bold uppercase">Final Score</p>
                      <p className="text-5xl font-black text-slate-800">{score}</p>
                  </div>
                  
                  <Button onClick={startGame} size="lg" variant="secondary" className="w-full">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw /> TRY AGAIN
                      </div>
                  </Button>
              </div>
          </div>
      )}
    </div>
  );
};
