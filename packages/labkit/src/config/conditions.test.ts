import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { describe, expect, it, vi } from 'vitest';
import { f } from './builder';
import { resolveConfigSchema } from './resolve';
import { isLeafEnabled, isLeafVisible } from './visible';

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

  it('answer yes for a path with neither, and for one naming nothing', () => {
    expect(isLeafEnabled(r, 'showGrid', {})).toBe(true);
    expect(isLeafEnabled(r, 'nowhere', {})).toBe(true);
  });
});

describe('resolveConfigSchema', () => {
  it('warns of a condition its schema cannot answer', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      resolveConfigSchema(
        f.schema({
          mode: f.enum('row', ['row', 'column']),
          size: f.number(1).showIf({ path: 'mode', is: 'diagonal' }),
        }),
        [],
      );
      expect(warn.mock.calls).toEqual([
        [
          `[labkit] showIf of "size": "mode" never holds 'diagonal': its options are 'row', 'column'`,
        ],
      ]);
      warn.mockClear();
      resolveConfigSchema(schema(), []);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
