import { describe, expect, it } from 'vitest';
import { fillConfigDefaults, hasConfigPath, valueAtPath, withValueAtPath } from './path';

describe('valueAtPath', () => {
  it('reads a single segment', () => {
    expect(valueAtPath({ a: 1 }, 'a')).toBe(1);
  });

  it('reads down a nested path', () => {
    expect(valueAtPath({ grid: { size: 20 } }, 'grid.size')).toBe(20);
  });

  it('returns undefined for a missing segment', () => {
    expect(valueAtPath({ grid: {} }, 'grid.size')).toBeUndefined();
    expect(valueAtPath({}, 'grid.size')).toBeUndefined();
  });

  it('returns undefined when the walk hits a non-object', () => {
    expect(valueAtPath({ grid: 3 }, 'grid.size')).toBeUndefined();
    expect(valueAtPath(null, 'a')).toBeUndefined();
  });
});

describe('hasConfigPath', () => {
  it('tells a missing key from one holding undefined', () => {
    expect(hasConfigPath({ a: undefined }, 'a')).toBe(true);
    expect(hasConfigPath({}, 'a')).toBe(false);
  });

  it('walks a nested path', () => {
    expect(hasConfigPath({ grid: { size: 20 } }, 'grid.size')).toBe(true);
    expect(hasConfigPath({ grid: { size: 20 } }, 'grid.color')).toBe(false);
    expect(hasConfigPath({ grid: 3 }, 'grid.size')).toBe(false);
  });
});

describe('withValueAtPath', () => {
  it('writes a single segment without touching the input', () => {
    const before = { a: 1, b: 2 };
    const after = withValueAtPath(before, 'a', 99);
    expect(after).toEqual({ a: 99, b: 2 });
    expect(before).toEqual({ a: 1, b: 2 });
  });

  it('copies every object on the way down', () => {
    const before = { grid: { size: 20, color: '#fff' }, other: { keep: true } };
    const after = withValueAtPath(before, 'grid.size', 40);
    expect(after.grid).toEqual({ size: 40, color: '#fff' });
    expect(before.grid.size).toBe(20);
    expect(after.grid).not.toBe(before.grid);
    // Untouched branches keep their identity, so a memo keyed on one holds.
    expect(after.other).toBe(before.other);
  });

  it('creates a missing intermediate branch', () => {
    expect(withValueAtPath({} as Record<string, unknown>, 'grid.size', 40)).toEqual({
      grid: { size: 40 },
    });
  });

  it('replaces a non-object standing where a branch belongs', () => {
    expect(withValueAtPath({ grid: 3 } as Record<string, unknown>, 'grid.size', 40)).toEqual({
      grid: { size: 40 },
    });
  });
});

describe('fillConfigDefaults', () => {
  it('takes the stored value wherever it has one', () => {
    expect(fillConfigDefaults({ a: 1 }, { a: 0, b: 2 })).toEqual({ a: 1, b: 2 });
  });

  it('fills a whole branch a stored config never had', () => {
    expect(fillConfigDefaults({ showGrid: false }, { showGrid: true, grid: { size: 20 } })).toEqual(
      {
        showGrid: false,
        grid: { size: 20 },
      },
    );
  });

  it('fills a gap inside a branch the stored config half-holds', () => {
    expect(
      fillConfigDefaults({ grid: { size: 40 } }, { grid: { size: 20, color: '#fff' } }),
    ).toEqual({ grid: { size: 40, color: '#fff' } });
  });

  it('keeps a key the defaults no longer mention', () => {
    expect(fillConfigDefaults({ gridSize: 40 }, { grid: { size: 20 } })).toEqual({
      gridSize: 40,
      grid: { size: 20 },
    });
  });

  it('leaves the stored config untouched', () => {
    const stored = { grid: { size: 40 } };
    fillConfigDefaults(stored, { grid: { size: 20, color: '#fff' } });
    expect(stored).toEqual({ grid: { size: 40 } });
  });

  it('takes a stored array whole rather than merging it element-wise', () => {
    expect(fillConfigDefaults({ tags: ['a'] }, { tags: ['x', 'y'] })).toEqual({ tags: ['a'] });
  });

  it('fills from defaults when the stored config is not a record', () => {
    expect(fillConfigDefaults(undefined, { a: 1 })).toEqual({ a: 1 });
    expect(fillConfigDefaults(7, { a: 1 })).toEqual({ a: 1 });
  });
});
