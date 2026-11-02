import { afterEach, beforeEach } from 'vitest';

// A layer that throws while drawing is caught so the rest of the frame still paints, and only logged, so a test
// whose overlay never drew passes. Each one fails the test it happened in.
const DRAW_THREW = /^\[weasel\] layer "([^"]+)" threw while drawing/;

const thrown: string[] = [];
const native = console.error.bind(console);
console.error = (...args: unknown[]) => {
  const m = typeof args[0] === 'string' ? DRAW_THREW.exec(args[0]) : null;
  if (m) thrown.push(`${m[1]}: ${args[1] instanceof Error ? args[1].message : String(args[1])}`);
  native(...args);
};

beforeEach(() => {
  thrown.length = 0;
});

afterEach(() => {
  if (!thrown.length) return;
  const seen = [...new Set(thrown)];
  thrown.length = 0;
  throw new Error(`a layer threw while drawing:\n  ${seen.join('\n  ')}`);
});
