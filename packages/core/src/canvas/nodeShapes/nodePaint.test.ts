import { describe, expect, it } from 'vitest';
import { hasStroke, inkReach, pathCommand, pathPaintOf } from './nodePaint';

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

  it('reaches only as far as the heads of a stroke that paints no line', () => {
    const headed = inkReach({ width: 4, markerEnd: { key: 'arrow', size: 5 } }, 1);
    const painted = inkReach({ paint, width: 4, markerEnd: { key: 'arrow', size: 5 } }, 1);
    expect(headed.inset).toBe(0);
    expect(headed.outset).toBeCloseTo(painted.outset - 2, 9);
    expect(headed.outset).toBeGreaterThan(0);
  });
});

describe('hasStroke', () => {
  it('counts a painted stroke with no width, which paints 1 wide', () => {
    expect(hasStroke({ paint })).toBe(true);
  });

  it('counts no stroke without a paint or with no width', () => {
    expect(hasStroke({ width: 2 })).toBe(false);
    expect(hasStroke({ width: 2, markerEnd: 'arrow' })).toBe(false);
    expect(hasStroke({ paint, width: 0 })).toBe(false);
    expect(hasStroke({ paint, width: { px: 0 } })).toBe(false);
    expect(hasStroke(null)).toBe(false);
  });
});

describe('a stroke that paints no line but carries a marker', () => {
  const headed = { width: 2, markerEnd: 'arrow' };
  const line = { kind: 'rect' as const, x: 0, y: 0, width: 10, height: 1 };

  it('stays on the node, as SVG draws its heads', () => {
    expect(pathPaintOf({ fill: null, stroke: headed }).stroke).toBe(headed);
  });

  it('reaches the draw command, with no paint, for the renderer to draw its heads', () => {
    expect(pathCommand(line, null, headed)).toMatchObject({ stroke: { width: 2, markerEnd: 'arrow' } });
    expect(pathCommand(line, null, { width: 2 })).not.toHaveProperty('stroke');
  });
});
