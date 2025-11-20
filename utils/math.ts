import { Operator } from '../types';

export const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

export const generateProblem = (level: number) => {
  // Difficulty Logic for 1st Grade Level (Ages 6-7)
  // Level 1: Addition only. Sum <= 10. No carry-over logic needed, just small numbers.
  // Level 2: Addition only. Sum <= 18 (Single digit + Single digit).
  // Level 3: Intro to Subtraction (Minuend <= 10).
  // Level 4+: Mixed Addition (up to 20) and Subtraction (up to 20).

  let operator: Operator = '+';
  let a = 0;
  let b = 0;

  // Determine Operator
  if (level <= 2) {
    operator = '+';
  } else {
    // From Level 3, introduce Subtraction
    // 50/50 split roughly
    operator = Math.random() > 0.5 ? '+' : '-';
  }
  
  if (operator === '+') {
    if (level === 1) {
      // Very simple addition: Sum <= 10
      a = randomInt(1, 5);
      b = randomInt(1, 5);
      // Ensure strict sum <= 10 constraint just in case
      if (a + b > 10) b = 10 - a;
    } else if (level === 2) {
      // Single digit addition (Sums up to 9+9=18)
      a = randomInt(2, 9);
      b = randomInt(2, 9);
    } else {
      // Level 3+: Can have slightly larger starts like 12 + 3
      if (Math.random() > 0.7) {
        a = randomInt(10, 15);
        b = randomInt(1, 4);
      } else {
        a = randomInt(2, 9);
        b = randomInt(2, 9);
      }
    }
  } else { // operator === '-'
    if (level === 3) {
      // Simple subtraction: Minuend <= 10
      // e.g., 8 - 3
      a = randomInt(2, 10);
      b = randomInt(1, a - 1); // Ensure positive result
    } else {
      // Harder subtraction: Minuend <= 18
      // e.g., 15 - 7 (Borrowing concepts)
      a = randomInt(11, 18);
      b = randomInt(2, 9);
      // Ensure positive
      if (b >= a) b = a - 1;
    }
  }
  
  const answer = operator === '+' ? a + b : a - b;

  return {
    expression: `${a} ${operator} ${b}`,
    answer,
  };
};