import { describe, it, expect } from 'vitest';
import type { DrawCommand } from '../DrawCommand';
import { idReadRect, withoutPickIds } from './idRender';

const spec = (rect: { x: number; y: number; width: number; height: number }, dpr = 1) => ({ width: 100, height: 50, dpr, rect });

describe('idReadRect', () => {
  it('reads one device pixel for a point, at the density', () => {
    expect(idReadRect(spec({ x: 10.25, y: 3, width: 0, height: 0 }, 2))).toEqual({ x: 20, y: 6, width: 1, height: 1 });
  });

  it('clamps a rect that overlaps an edge', () => {
    expect(idReadRect(spec({ x: -3, y: 45, width: 6, height: 10 }))).toEqual({ x: 0, y: 45, width: 3, height: 5 });
  });

  it('reads nothing for a rect off any side of the drawing', () => {
    for (const r of [
      { x: -5, y: 10, width: 0, height: 0 }, { x: -20, y: -20, width: 5, height: 5 },
      { x: 150, y: 10, width: 0, height: 0 }, { x: 10, y: 50, width: 0, height: 0 },
    ]) {
      const read = idReadRect(spec(r));
      expect(read.width * read.height).toBe(0);
    }
  });
});

describe('withoutPickIds', () => {
  const box: DrawCommand = { kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 } };
  const tagged = (pickId: number, ...children: DrawCommand[]): DrawCommand => ({ kind: 'group', pickId, children });

  it('drops the groups named, children and all, through untagged ones', () => {
    const cmds = [tagged(1, box), { kind: 'group', children: [tagged(2, box, tagged(3, box)), tagged(4, box)] } as DrawCommand];
    expect(withoutPickIds(cmds, new Set([2]))).toEqual([
      tagged(1, box), { kind: 'group', children: [tagged(4, box)] },
    ]);
  });

  it('hands back the same array when nothing is named', () => {
    const cmds = [tagged(1, box), box];
    expect(withoutPickIds(cmds, new Set([9]))).toBe(cmds);
  });
});
