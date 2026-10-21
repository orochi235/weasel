import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { describe, expect, it, vi } from 'vitest';
import { f } from './builder';
import { resolveConfigSchema } from './resolve';
import { isEntryShown, isLeafEnabled, isLeafVisible } from './visible';

const schema = () =>
  f.schema({
    showGrid: f.boolean(true),
    mode: f.enum('row', ['row', 'column']),
    cellSize: f.number(20).showIf({ path: 'showGrid' }).enableIf({ path: 'mode', is: 'row' }),
    seed: f
      .number(1)
      .showIf((c) => c.mode === 'row')
      .enableIf((c) => c.showGrid === true),
    grid: f
      .group({
        color: f.color('#fff').enableIf({ path: 'grid.size', above: 4 }),
        size: f.number(8),
      })
      .showIf({ path: 'mode', in: ['row'] })
      .enableIf({ path: 'showGrid' }),
    fine: f
      .group({ step: f.number(1) })
      .showIf((c) => c.showGrid === true)
      .enableIf((c) => c.mode === 'row'),
  });

describe('a condition written as data', () => {
  it("sits in a leaf builder's annotations, and a function in its options", () => {
    type Bag = { annotations: Record<string, unknown>; options: Record<string, unknown> };
    const { cellSize, seed } = schema().nodes as unknown as { cellSize: Bag; seed: Bag };
    expect(cellSize.annotations).toEqual({
      showIf: { path: 'showGrid' },
      enableIf: { path: 'mode', is: 'row' },
    });
    expect(cellSize.options.showIf).toBeUndefined();
    expect(cellSize.options.enableIf).toBeUndefined();
    expect(seed.annotations).toEqual({});
    expect(seed.options.showIf).toBeTypeOf('function');
    expect(seed.options.enableIf).toBeTypeOf('function');
  });

  it('lands on the resolved leaf and group, where a function stays beside the tree', () => {
    const r = resolveConfigSchema(schema(), []);
    const cellSize = r.group.children.cellSize as PrefLeaf;
    expect(cellSize.showIf).toEqual({ path: 'showGrid' });
    expect(cellSize.enableIf).toEqual({ path: 'mode', is: 'row' });
    const grid = r.group.children.grid as PrefGroup;
    expect(grid.showIf).toEqual({ path: 'mode', in: ['row'] });
    expect(grid.enableIf).toEqual({ path: 'showGrid' });
    expect((grid.children.color as PrefLeaf).enableIf).toEqual({ path: 'grid.size', above: 4 });
    expect([...r.showIf.keys()]).toEqual(['seed', 'fine']);
    expect([...(r.enableIf?.keys() ?? [])]).toEqual(['seed', 'fine']);
    expect('showIf' in (r.group.children.seed as PrefLeaf)).toBe(false);
    expect('showIf' in (r.group.children.fine as PrefGroup)).toBe(false);
    expect(JSON.parse(JSON.stringify(grid))).toEqual(grid);
  });

  it('gives way to whichever form is set last', () => {
    const data = f
      .number(1)
      .showIf(() => true)
      .showIf({ path: 'a' });
    expect(data.options.showIf).toBeUndefined();
    expect(data.annotations.showIf).toEqual({ path: 'a' });
    const code = f
      .number(1)
      .enableIf({ path: 'a' })
      .enableIf(() => true);
    expect(code.annotations.enableIf).toBeUndefined();
    expect(code.options.enableIf).toBeTypeOf('function');
    const group = f
      .group({})
      .showIf({ path: 'a' })
      .showIf(() => false);
    expect(group.annotations.showIf).toBeUndefined();
    expect(group.options.showIf).toBeTypeOf('function');
  });

  it("is kept by an object's field", () => {
    const r = resolveConfigSchema(
      f.schema({
        on: f.boolean(true),
        stroke: f.object({ width: f.number(1).enableIf({ path: 'on' }) }),
      }),
      [],
    );
    const stroke = r.group.children.stroke as PrefLeaf & { children: Record<string, PrefLeaf> };
    expect(stroke.children.width?.enableIf).toEqual({ path: 'on' });
  });
});

describe('isLeafVisible and isLeafEnabled', () => {
  const r = resolveConfigSchema(schema(), []);
  const base = {
    showGrid: true,
    mode: 'row',
    cellSize: 20,
    seed: 1,
    grid: { color: '#fff', size: 8 },
    fine: { step: 1 },
  };

  it('answer a condition and a function alike', () => {
    for (const path of ['cellSize', 'seed', 'grid', 'fine', 'grid.color', 'showGrid']) {
      expect(isLeafVisible(r, path, base)).toBe(true);
      expect(isLeafEnabled(r, path, base)).toBe(true);
    }
    const off = { ...base, showGrid: false };
    expect(isLeafVisible(r, 'cellSize', off)).toBe(false);
    expect(isLeafVisible(r, 'fine', off)).toBe(false);
    expect(isLeafEnabled(r, 'seed', off)).toBe(false);
    expect(isLeafEnabled(r, 'grid', off)).toBe(false);
    const column = { ...base, mode: 'column' };
    expect(isLeafVisible(r, 'seed', column)).toBe(false);
    expect(isLeafVisible(r, 'grid', column)).toBe(false);
    expect(isLeafEnabled(r, 'cellSize', column)).toBe(false);
    expect(isLeafEnabled(r, 'fine', column)).toBe(false);
    expect(isLeafEnabled(r, 'grid.color', { ...base, grid: { color: '#fff', size: 4 } })).toBe(
      false,
    );
  });

  it('answer for everything above a path too, whichever form its condition takes', () => {
    const off = { ...base, showGrid: false };
    // `grid` is disabled by data and `fine` hidden by a function.
    expect(isLeafEnabled(r, 'grid.size', off)).toBe(false);
    expect(isLeafEnabled(r, 'grid.color', off)).toBe(false);
    expect(isLeafVisible(r, 'fine.step', off)).toBe(false);
    const column = { ...base, mode: 'column' };
    expect(isLeafVisible(r, 'grid.size', column)).toBe(false);
    expect(isLeafEnabled(r, 'fine.step', column)).toBe(false);
    expect(isLeafVisible(r, 'grid.size', base)).toBe(true);
    expect(isLeafEnabled(r, 'fine.step', base)).toBe(true);
  });

  it('answer yes for a path with neither, and for one naming nothing', () => {
    expect(isLeafEnabled(r, 'showGrid', {})).toBe(true);
    expect(isLeafEnabled(r, 'nowhere', {})).toBe(true);
  });
});

describe('isEntryShown', () => {
  it("answers a node of a schema's own shape by its own showIf, in either form", () => {
    const { cellSize, seed, grid, showGrid } = schema().nodes;
    const { group } = resolveConfigSchema(schema(), []);
    expect(isEntryShown(cellSize, { showGrid: true }, group)).toBe(true);
    expect(isEntryShown(cellSize, { showGrid: false }, group)).toBe(false);
    expect(isEntryShown(seed, { mode: 'row' }, group)).toBe(true);
    expect(isEntryShown(seed, { mode: 'column' }, group)).toBe(false);
    expect(isEntryShown(grid, { mode: 'column' }, group)).toBe(false);
    expect(isEntryShown(showGrid, {}, group)).toBe(true);
  });
});

describe('resolveConfigSchema', () => {
  it('throws on a condition its schema cannot answer, naming each node and what is wrong', () => {
    const bad = f.schema({
      mode: f.enum('row', ['row', 'column']),
      size: f.number(1).showIf({ path: 'mode', is: 'row' }),
      grid: f.group({ color: f.color('#fff').enableIf({ path: 'nowhere' }) }),
      title: f.string('').showIf({ path: 'mode', is: 3 }),
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(() => resolveConfigSchema(bad, [])).toThrow(
        [
          `[labkit] enableIf of "grid.color": no leaf holds a value at "nowhere"`,
          `[labkit] showIf of "title": "mode" never holds 3: its options are 'row', 'column'`,
        ].join('\n'),
      );
      expect(() => resolveConfigSchema(schema(), [])).not.toThrow();
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it('warns of an enum compared with a string none of its options is, and never matches it', () => {
    const odd = f.schema({
      mode: f.enum('row', ['row', 'column']),
      size: f.number(1).showIf({ path: 'mode', is: 'diagonal' }),
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const r = resolveConfigSchema(odd, []);
      expect(warn).toHaveBeenCalledWith(
        `[labkit] showIf of "size": "mode" never holds 'diagonal': its options are 'row', 'column'`,
      );
      expect(isLeafVisible(r, 'size', { mode: 'row' })).toBe(false);
      expect(isLeafVisible(r, 'size', { mode: 'column' })).toBe(false);
    } finally {
      warn.mockRestore();
    }
  });
});
