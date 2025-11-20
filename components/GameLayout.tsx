
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, RefreshCw, Trophy, Flame, Volume2, VolumeX, BrainCircuit } from 'lucide-react';
import { Button } from './Button';
import { Keypad } from './Keypad';
import { GameStatus, FallingItem, Block, CANDY_COLORS, Particle, CandyColor, FloatingText } from '../types';
import { COLUMNS, MAX_ROWS, ROW_HEIGHT_PERCENT, BASE_SPEED, SPAWN_RATE_INITIAL, DIFFICULTY_SCALING } from '../constants';
import { generateProblem, randomInt } from '../utils/math';
import { soundManager } from '../utils/sound';

// Helper: Find clusters of the target color (size >= 2)
const findDetonationTargets = (currentBlocks: Block[], targetColorFrom: string): Set<string> => {
  const blockMap = new Map<string, Block>();
  currentBlocks.forEach(b => blockMap.set(`${b.col},${b.row}`, b));
  
  const visited = new Set<string>();
  const toRemove = new Set<string>();

  const candidates = currentBlocks.filter(b => b.colorData.from === targetColorFrom && b.status !== 'clearing');

  for (const block of candidates) {
      if (visited.has(block.id)) continue;
      
      const cluster: Block[] = [];
      const queue = [block];
      visited.add(block.id);
      cluster.push(block);
      
      let head = 0;
      while (head < queue.length) {
          const curr = queue[head++];
          const neighbors = [
              {c: curr.col + 1, r: curr.row},
              {c: curr.col - 1, r: curr.row},
              {c: curr.col, r: curr.row + 1},
              {c: curr.col, r: curr.row - 1},
          ];
          
          for (const n of neighbors) {
              const key = `${n.c},${n.r}`;
              const neighbor = blockMap.get(key);
              if (neighbor && !visited.has(neighbor.id) && 
                  neighbor.colorData.from === targetColorFrom && 
                  neighbor.status !== 'clearing') {
                  visited.add(neighbor.id);
                  cluster.push(neighbor);
                  queue.push(neighbor);
              }
          }
      }

      if (cluster.length >= 2) {
          cluster.forEach(b => toRemove.add(b.id));
      }
  }
  return toRemove;
};

const removeAndRefill = (currentBlocks: Block[], idsToRemove: Set<string>): Block[] => {
    const keptBlocks = currentBlocks.filter(b => !idsToRemove.has(b.id));
    const nextBlocks: Block[] = [];
    
    for (let c = 0; c < COLUMNS; c++) {
        const colBlocks = keptBlocks.filter(b => b.col === c);
        colBlocks.sort((a, b) => a.row - b.row);
        colBlocks.forEach((b, idx) => {
            const fell = b.row !== idx;
            nextBlocks.push({ 
                ...b, 
                row: idx, 
                lastImpact: fell ? Date.now() : b.lastImpact
            });
        });
    }
    return nextBlocks;
};

export const GameLayout: React.FC = () => {
  // -- State --
  const [status, setStatus] = useState<GameStatus>('MENU');
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [currentInput, setCurrentInput] = useState<string>('');
  const [fallingItems, setFallingItems] = useState<FallingItem[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  
  // -- Refs for Game Loop --
  const requestRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const lastSpawnTimeRef = useRef<number>(0);
  const gameSpeedRef = useRef<number>(BASE_SPEED);
  const spawnRateRef = useRef<number>(SPAWN_RATE_INITIAL);
  const itemsSolvedRef = useRef<number>(0);
  
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
    setFloatingTexts([]);
    setCurrentInput('');
    setIsShaking(false);
    setIsFlashing(false);
    gameSpeedRef.current = BASE_SPEED;
    spawnRateRef.current = SPAWN_RATE_INITIAL;
    lastSpawnTimeRef.current = 0;
    itemsSolvedRef.current = 0;
    setStatus('PLAYING');
  };

  // -- Helpers --

  const spawnItem = useCallback(() => {
    const col = randomInt(0, COLUMNS - 1);
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

  const addParticles = useCallback((x: number, y: number, color: string, count: number, explosive: boolean = false) => {
    const newParticles: Particle[] = [];
    const speedMult = explosive ? 2.0 : 1.0;
    for(let i=0; i<count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = (Math.random() * 3 + 2) * speedMult;
      newParticles.push({
        id: Math.random().toString(),
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: (Math.sin(angle) * velocity) - (explosive ? 2 : 0), // Initial pop up
        color,
        life: 1.0 + Math.random() * 0.5
      });
    }
    setParticles(prev => [...prev, ...newParticles]);
  }, []);

  const addFloatingText = useCallback((x: number, y: number, text: string, color: string = '#fff', scale: number = 1) => {
      setFloatingTexts(prev => [...prev, {
          id: Math.random().toString(),
          x,
          y,
          text,
          color,
          scale
      }]);
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
        const floorY = 100 - ((blocksInCol + 1) * ROW_HEIGHT_PERCENT);

        if (nextY >= floorY) {
          soundManager.playSFX('land');
          newBlocks.push({
            id: `block-${Date.now()}-${Math.random()}`,
            col: item.col,
            row: blocksInCol,
            colorData: item.colorData,
            lastImpact: Date.now(),
            status: 'idle',
          });
          
          if (blocksInCol + 1 >= MAX_ROWS) {
            isGameOver = true;
          }
        } else {
          nextItems.push({ ...item, y: nextY });
        }
      });

      if (newBlocks.length > 0) {
         const combinedBlocks = [...stateRef.current.blocks, ...newBlocks];
         const affectedCols = new Set(newBlocks.map(b => b.col));
         const animatedBlocks = combinedBlocks.map(b => {
            if (affectedCols.has(b.col)) {
                return { ...b, lastImpact: Date.now() };
            }
            return b;
         });
         setBlocks(animatedBlocks);
      }
      
      if (isGameOver) gameOver();

      return nextItems;
    });

    // Particles & Gravity
    setParticles(prev => prev.map(p => ({
      ...p,
      x: p.x + p.vx * 0.1, // Drag
      y: p.y + p.vy * 0.1 + 0.2, // Gravity
      life: p.life - 0.02
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

  // -- Check Answer Logic --

  const checkAnswer = useCallback((inputVal: string) => {
    const numVal = parseInt(inputVal, 10);
    if (isNaN(numVal)) return;

    const items = [...stateRef.current.fallingItems];
    
    // --- SUM ALL LOGIC ---
    if (items.length > 1) {
        const totalSum = items.reduce((acc, item) => acc + item.answer, 0);
        if (numVal === totalSum) {
            soundManager.playSFX('mega_clear');
            
            // Flash screen
            setIsFlashing(true);
            setTimeout(() => setIsFlashing(false), 300);

            const involvedColors = new Set(items.map(i => i.colorData.from));
            
            items.forEach(item => {
                 addParticles(item.col * (100/COLUMNS) + 10, item.y + 5, '#ffffff', 15, true);
            });
            
            addFloatingText(50, 30, "EXCELLENT!", "#fbbf24", 1.5);

            setFallingItems([]);

            const targets = new Set<string>();
            stateRef.current.blocks.forEach(b => {
              if (involvedColors.has(b.colorData.from)) {
                targets.add(b.id);
              }
            });

            if (targets.size > 0) {
               setBlocks(prev => prev.map(b => targets.has(b.id) ? { ...b, status: 'clearing' } : b));
               
               setTimeout(() => {
                 stateRef.current.blocks.filter(b => targets.has(b.id)).forEach(b => {
                    addParticles(b.col * (100/COLUMNS) + 10, 100 - (b.row * ROW_HEIGHT_PERCENT) - 5, b.colorData.to, 12, true);
                 });
                 setBlocks(prev => removeAndRefill(prev, targets));
                 soundManager.playSFX('mega_clear');
               }, 500);
            }

            setScore(prev => prev + 100 + (items.length * 50) + (targets.size * 20));
            setCurrentInput('');
            return; 
        }
    }

    // --- SINGLE ITEM LOGIC ---
    items.sort((a, b) => b.y - a.y);
    const matchIndex = items.findIndex(item => item.answer === numVal);

    if (matchIndex !== -1) {
      const matchedItem = items[matchIndex];
      
      soundManager.playSFX('correct');
      addParticles(matchedItem.col * (100/COLUMNS) + 10, matchedItem.y + 5, '#fff', 12, true);
      addFloatingText(matchedItem.col * (100/COLUMNS) + 10, matchedItem.y, "Nice!", "#fff");
      
      setFallingItems(prev => prev.filter(i => i.id !== matchedItem.id));
      
      const targets = findDetonationTargets(stateRef.current.blocks, matchedItem.colorData.from);
      
      if (targets.size > 0) {
          setBlocks(prev => prev.map(b => targets.has(b.id) ? { ...b, status: 'clearing' } : b));
          
          if (targets.size >= 3) {
             setIsShaking(true);
             setTimeout(() => setIsShaking(false), 400);
          }

          setTimeout(() => {
              const removedBlocks = stateRef.current.blocks.filter(b => targets.has(b.id));
              removedBlocks.forEach(b => {
                  const pCount = targets.size > 4 ? 20 : 10;
                  addParticles(b.col * (100/COLUMNS) + 10, 100 - (b.row * ROW_HEIGHT_PERCENT) - 5, b.colorData.to, pCount, targets.size > 4);
              });

              setBlocks(prev => removeAndRefill(prev, targets));
              
              if (targets.size > 4) {
                soundManager.playSFX('mega_clear');
                setIsFlashing(true);
                setTimeout(() => setIsFlashing(false), 200);
                addFloatingText(50, 50, `COMBO x${targets.size}!`, "#fbbf24", 1.5);
              } else {
                soundManager.playSFX('correct'); // Secondary clear sound
                addFloatingText(removedBlocks[0].col * (100/COLUMNS) + 10, 100 - (removedBlocks[0].row * ROW_HEIGHT_PERCENT), `+${targets.size * 30}`);
              }
              
              setScore(s => s + (removedBlocks.length * 30) + (targets.size > 4 ? 100 : 0));
          }, 500);
      }

      itemsSolvedRef.current += 1;
      if (itemsSolvedRef.current % DIFFICULTY_SCALING.LEVEL_THRESHOLD === 0) {
          setLevel(l => l + 1);
          gameSpeedRef.current += DIFFICULTY_SCALING.SPEED_INC;
          spawnRateRef.current = Math.max(500, spawnRateRef.current - DIFFICULTY_SCALING.SPAWN_DEC);
      }
      
      setScore(prev => prev + 10 + stateRef.current.level);
      setCurrentInput('');
    } else {
        if (inputVal.length > 3) {
            setCurrentInput('');
            soundManager.playSFX('wrong');
        }
    }
  }, [addParticles, addFloatingText]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (status !== 'PLAYING') return;
      if (e.key >= '0' && e.key <= '9') {
        setCurrentInput(prev => {
            const next = prev + e.key;
            checkAnswer(next);
            return next;
        });
      } else if (e.key === 'Backspace') {
        setCurrentInput(prev => prev.slice(0, -1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, checkAnswer]);


  const getCandyStyle = (color: CandyColor) => {
    return `bg-gradient-to-br ${color.from} ${color.to} border-2 ${color.border} ${color.shadow}`;
  };

  return (
    <div className={`relative w-full h-full max-w-md mx-auto flex flex-col overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-900 to-fuchsia-900 shadow-2xl ${isShaking ? 'animate-shake' : ''}`}>
      
      {/* Screen Flash Effect */}
      {isFlashing && <div className="absolute inset-0 bg-white z-50 animate-flash pointer-events-none mix-blend-overlay" />}
      
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.15),transparent)] pointer-events-none" />
      
      {/* Header */}
      <div className="relative z-20 flex justify-between items-center p-4 pt-6">
        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 shadow-glass">
           <Trophy size={20} className="text-yellow-300 drop-shadow-md" />
           <span className="font-bold text-xl text-white drop-shadow-md">{score}</span>
        </div>
        
        <div className="flex items-center gap-2">
             <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 shadow-glass mr-2">
                <Flame size={20} className="text-orange-400 drop-shadow-md" />
                <span className="font-bold text-lg text-white drop-shadow-md">Lv.{level}</span>
            </div>

            <button 
                onClick={toggleMute}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors active:scale-95"
            >
                {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
            </button>
        </div>
      </div>

      {/* Game Area */}
      <div className="relative flex-1 w-full mt-2 mb-2">
        <div className="absolute inset-0 flex pointer-events-none opacity-5">
            {Array.from({ length: COLUMNS }).map((_, i) => (
                <div key={i} className="flex-1 border-r border-white last:border-0" />
            ))}
        </div>

        {/* Blocks */}
        {blocks.map(block => (
            <div
                key={`${block.id}-${block.lastImpact}`} 
                className={`absolute px-1 transition-transform origin-bottom 
                   ${block.status === 'clearing' ? 'animate-clear-charge z-10' : 'animate-jelly'}
                `}
                style={{
                    left: `${block.col * (100 / COLUMNS)}%`,
                    bottom: `${block.row * ROW_HEIGHT_PERCENT}%`,
                    width: `${100 / COLUMNS}%`,
                    height: `${ROW_HEIGHT_PERCENT}%`,
                }}
            >
                <div className={`w-full h-full rounded-xl shadow-candy relative flex items-center justify-center ${getCandyStyle(block.colorData)} 
                     ${block.status === 'clearing' ? 'shadow-glow-xl brightness-150 border-white scale-105' : ''}
                `}>
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
                    <span className="font-black text-white text-lg md:text-xl relative z-10 drop-shadow-md filter">
                        {item.expression}
                    </span>
                </div>
            </div>
        ))}
        
        {/* Particles */}
        {particles.map(p => (
            <div 
                key={p.id}
                className="absolute rounded-full pointer-events-none"
                style={{
                    left: `${p.x}%`,
                    top: `${p.y}%`,
                    width: `${p.life * 10}px`,
                    height: `${p.life * 10}px`,
                    backgroundColor: p.color,
                    opacity: p.life,
                    transform: `translate(-50%, -50%)`,
                    boxShadow: `0 0 10px ${p.color}`
                }}
            />
        ))}

        {/* Floating Text */}
        {floatingTexts.map(ft => (
            <div
                key={ft.id}
                className="absolute pointer-events-none font-black text-stroke animate-float-up z-50 whitespace-nowrap"
                style={{
                    left: `${ft.x}%`,
                    top: `${ft.y}%`,
                    color: ft.color,
                    fontSize: `${1.5 * ft.scale}rem`,
                    textShadow: '0 4px 0 rgba(0,0,0,0.2), 0 0 10px rgba(255,255,255,0.5)'
                }}
                onAnimationEnd={() => {
                    setFloatingTexts(prev => prev.filter(t => t.id !== ft.id));
                }}
            >
                {ft.text}
            </div>
        ))}
        
        <div className="absolute top-0 w-full border-b-2 border-red-500/30 border-dashed pointer-events-none" />
      </div>

      {/* Input */}
      <div className="relative z-20 w-full px-4 mb-2">
        <div className="w-full h-14 bg-black/30 backdrop-blur-md rounded-2xl border-2 border-white/10 flex items-center justify-center shadow-inner transition-all">
             <span className="text-3xl font-mono text-white font-bold tracking-widest drop-shadow-lg animate-pulse-fast">
                {currentInput || <span className="opacity-20">...</span>}
             </span>
        </div>
      </div>

      {/* Keypad */}
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

      {/* Menu */}
      {status === 'MENU' && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in">
              <div className="p-8 bg-white rounded-[2rem] shadow-2xl text-center max-w-xs transform scale-100 transition-transform border-4 border-pink-200 animate-pop-in">
                  <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-600 mb-2 drop-shadow-sm tracking-tight">
                    Stack<br/>Attack
                  </h1>
                  <p className="text-slate-500 mb-6 font-bold">Solve math to clear blocks!</p>
                  
                  <div className="text-sm text-slate-500 mb-6 bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <BrainCircuit className="text-pink-500" size={18} />
                        <span className="font-black text-indigo-800 uppercase">How to Play</span>
                      </div>
                      <p className="leading-tight mb-2">1. Blocks of the same color connect.</p>
                      <p className="leading-tight">2. Solve a <span className="font-bold text-pink-500">Red Equation</span> to explode all connected <span className="font-bold text-pink-500">Red Blocks</span>!</p>
                  </div>

                  <Button onClick={startGame} size="lg" className="w-full animate-pulse-fast shadow-xl hover:scale-105 transition-transform">
                      <div className="flex items-center justify-center gap-2">
                        <Play fill="currentColor" /> START
                      </div>
                  </Button>
              </div>
          </div>
      )}

      {/* Game Over */}
      {status === 'GAMEOVER' && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-red-900/80 backdrop-blur-md animate-in zoom-in duration-300">
              <div className="p-8 bg-white rounded-[2rem] shadow-2xl text-center max-w-xs w-full border-4 border-red-300 relative overflow-hidden animate-shake">
                  <div className="absolute top-0 left-0 w-full h-2 bg-red-400" />
                  <h2 className="text-4xl font-black text-red-500 mb-1 mt-2">GAME OVER</h2>
                  <p className="text-slate-400 text-sm mb-6 uppercase tracking-wider font-bold">Stack Overflow!</p>
                  
                  <div className="bg-slate-100 rounded-2xl p-4 mb-6 inner-shadow">
                      <p className="text-slate-500 text-xs font-bold uppercase">Final Score</p>
                      <p className="text-5xl font-black text-slate-800">{score}</p>
                  </div>
                  
                  <Button onClick={startGame} size="lg" variant="secondary" className="w-full hover:scale-105 transition-transform">
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
