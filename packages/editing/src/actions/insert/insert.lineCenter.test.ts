import { describe, it, expect } from 'vitest';
import { insertShape } from './shape';

describe('insertShape — a line drawn from its center', () => {
  it('has the box its two ends span', () => {
    const { bounds, extras } = insertShape({ kind: 'line' }, { shaped: { start: { x: 0, y: 0 }, current: { x: 10, y: 4 } }, altHeld: true }, null, 0);
    expect(extras).toMatchObject({ a: { x: -10, y: -4 }, b: { x: 10, y: 4 } });
    expect(bounds).toEqual({ x: -10, y: -4, width: 20, height: 8 });
  });
});
