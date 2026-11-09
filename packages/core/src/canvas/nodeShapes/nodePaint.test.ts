import { describe, expect, it } from 'vitest';
import { inkReach } from './nodePaint';

const paint = { color: '#000' };

describe('inkReach', () => {
  it('reaches as far as the widest per-vertex width', () => {
    expect(inkReach({ paint, width: 4 }, 1).outset).toBe(2);
    expect(inkReach({ paint, width: 4, vertexWidths: [2, 12, 4] }, 1).outset).toBe(6);
  });

  it('reaches nowhere for a stroke of no width, whatever its per-vertex widths and heads', () => {
    for (const width of [0, { px: 0 }]) {
      const r = inkReach({ paint, width, vertexWidths: [2, 12, 4], markerEnd: { key: 'arrow', size: 5 } }, 1);
      expect([r.outset, r.inset, r.outsetPx ?? 0, r.insetPx ?? 0]).toEqual([0, 0, 0, 0]);
    }
  });
});
