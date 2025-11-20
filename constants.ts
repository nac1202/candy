export const COLUMNS = 5;
export const MAX_ROWS = 12;
export const SPAWN_RATE_INITIAL = 2500; // ms
export const BASE_SPEED = 0.15; // Vertical % movement per frame (approx)
export const GAME_loop_MS = 16; // ~60fps

// Calculate how tall one "block" is in percentage height
// If we have 12 rows, each row is roughly 100/12 % height.
export const ROW_HEIGHT_PERCENT = 100 / MAX_ROWS;

export const DIFFICULTY_SCALING = {
  SPEED_INC: 0.01,
  SPAWN_DEC: 50,
  LEVEL_THRESHOLD: 5, // Score needed to level up
};