import { describe, expect, it } from 'vitest';
import { dropSide, listMode, measureRowList, rowAtY } from './rowList';
import { exactly, UNBOUNDED, type MeasureEnv } from './measure';

const TOKENS: Record<string, string> = {
  '--wzl-control-h': '24px', '--wzl-space-4': '8px', '--wzl-space-6': '12px', '--wzl-font-size-sm': '11px',
};
const env: MeasureEnv = {
  token: (n) => TOKENS[n],
  text: (t) => ({ width: t.length * 5, ascent: 10, descent: 3 }),
};

describe('listMode', () => {
  it('is a grid with row controls or activation alone, a listbox with selection, else a list', () => {
    expect(listMode({})).toBe('list');
    expect(listMode({ selection: 'single' })).toBe('listbox');
    expect(listMode({ selection: 'multi', activatable: true })).toBe('listbox');
    expect(listMode({ activatable: true })).toBe('grid');
    expect(listMode({ selection: 'single', controls: true })).toBe('grid');
  });
});

describe('dropSide', () => {
  it('seams the row a gap sits before, and the last row for the end gap', () => {
    expect(dropSide(1, 1, 3)).toBe('before');
    expect(dropSide(3, 2, 3)).toBe('after');
    expect(dropSide(1, 0, 3)).toBeUndefined();
    expect(dropSide(null, 0, 3)).toBeUndefined();
  });
});

describe('measureRowList', () => {
  const rows = [
    { id: 'a', label: 'Alpha', leadingWidth: 12 },
    { id: 'b', label: 'Be', trailingWidth: 20 },
  ];

  it('stacks control-height rows a pixel apart, as wide as the widest row', () => {
    const m = measureRowList({ rows }, UNBOUNDED, env);
    // Alpha: 8 + 12 + 8 + 25 + 8 = 61; Be: 8 + 10 + 8 + 20 + 8 = 54.
    expect([m.width, m.height]).toEqual([61, 49]);
    expect(m.layout.rows[1]!.rect).toEqual({ x: 0, y: 25, width: 61, height: 24 });
    expect(m.baseline).toBeCloseTo(5.5 + 10);
  });

  it('lets the label fill what the leading and trailing parts leave', () => {
    const m = measureRowList({ rows }, exactly(200, 49), env);
    const [a, b] = m.layout.rows;
    expect(a!.leading).toEqual({ x: 8, y: 0, width: 12, height: 24 });
    expect(a!.label).toMatchObject({ x: 28, width: 164 });
    expect(b!.trailing).toEqual({ x: 172, y: 25, width: 20, height: 24 });
    expect(b!.label).toMatchObject({ x: 8, width: 156 });
  });

  it('measures the empty state as its padded line', () => {
    const m = measureRowList({ rows: [] }, UNBOUNDED, env);
    expect([m.width, m.height]).toEqual([5 + 16, 13 + 24]);
    expect(m.layout.empty).toEqual({ x: 8, y: 12, width: 5, height: 13 });
  });

  it('finds the row under a point, and none in the gap between rows', () => {
    const { layout } = measureRowList({ rows }, UNBOUNDED, env);
    expect(rowAtY(layout, 3)).toBe(0);
    expect(rowAtY(layout, 24.5)).toBeNull();
    expect(rowAtY(layout, 30)).toBe(1);
    expect(rowAtY(layout, 60)).toBeNull();
  });
});
