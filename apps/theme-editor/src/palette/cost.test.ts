import { describe, expect, it } from 'vitest';
import { DEFAULT_CONSTRAINTS, generate } from './generate';

/**
 * The lab regenerates on every slider tick, so `generate` has a frame budget
 * rather than merely "finishing". This caught the version that re-parsed both
 * hexes inside an O(n^2) pair loop and took 1.7 seconds at 16 colors.
 */
describe('generate stays inside a frame budget', () => {
  it('regenerates the largest set fast enough to drag', () => {
    generate({ ...DEFAULT_CONSTRAINTS, count: 16 }); // warm the module-level tables
    const t = performance.now();
    generate({ ...DEFAULT_CONSTRAINTS, count: 16 });
    // Generous against a loaded CI box; the real figure is an order of
    // magnitude under this, and the regression it guards was 1700ms.
    expect(performance.now() - t).toBeLessThan(300);
  });

  it('does not degrade the palette to get there', () => {
    const p = generate(DEFAULT_CONSTRAINTS);
    expect(p.feasible).toBe(true);
    // Tailwind's 500 row measures 0.187 in this space.
    expect(p.stats.meanChroma).toBeGreaterThan(0.185);
  });
});
