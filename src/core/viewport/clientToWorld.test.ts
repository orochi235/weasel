import { describe, it, expect } from 'vitest';
import { clientToWorld } from './clientToWorld';

describe('clientToWorld', () => {
  it('subtracts the canvas rect origin then applies the inverse view', () => {
    const [wx, wy] = clientToWorld(110, 220, { left: 10, top: 20 }, { scale: { x: 2, y: 2 }, x: 5, y: 5 });
    expect(wx).toBeCloseTo((110 - 10) / 2 + 5, 6); // 55
    expect(wy).toBeCloseTo((220 - 20) / 2 + 5, 6); // 105
  });

  it('handles identity scale (zoom = 1, pan = 0)', () => {
    const [wx, wy] = clientToWorld(300, 400, { left: 50, top: 75 }, { scale: { x: 1, y: 1 }, x: 0, y: 0 });
    expect(wx).toBeCloseTo(250, 6);
    expect(wy).toBeCloseTo(325, 6);
  });

  it('handles non-uniform scale', () => {
    const [wx, wy] = clientToWorld(100, 100, { left: 0, top: 0 }, { scale: { x: 4, y: 2 }, x: 10, y: 20 });
    expect(wx).toBeCloseTo(100 / 4 + 10, 6); // 35
    expect(wy).toBeCloseTo(100 / 2 + 20, 6); // 70
  });
});
