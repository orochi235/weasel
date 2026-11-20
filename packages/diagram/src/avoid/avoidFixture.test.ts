import { describe, expect, it } from 'vitest';
import { nearEdges, randomShapes, seeded } from './avoidFixture';

describe('nearEdges', () => {
  it('joins two distinct shapes when the last shape starts a row of its own', () => {
    // 7 shapes on 3 columns: the last sits alone at the start of row 2.
    for (let seed = 1; seed <= 20; seed++) {
      const rand = seeded(seed);
      const shapes = randomShapes(rand, 7);
      const ids = new Set(shapes.map((s) => s.id));
      for (const e of nearEdges(rand, shapes, 40)) {
        expect(ids.has(e.from.node) && ids.has(e.to.node)).toBe(true);
        expect(e.from.node).not.toBe(e.to.node);
      }
    }
  });

  it('refuses fewer than two shapes, which no connector can join', () => {
    expect(() => nearEdges(seeded(1), randomShapes(seeded(1), 1), 1)).toThrow(/two shapes/);
  });
});
