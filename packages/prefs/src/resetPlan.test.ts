import { describe, expect, it } from 'vitest';
import { AUTO, leafIsAtReset, prefNodeAt, resetPlan, resetPlanAt, type LeafReading } from './autoReset';
import type { PrefGroup, PrefSection } from './groups';
import type { PrefLeaf } from './schema';

const size = { kind: 'number', name: 'Size', description: '', default: 10, auto: { value: 40 } } as PrefLeaf;
const gap = { kind: 'number', name: 'Gap', description: '', default: 4, auto: { on: true } } as PrefLeaf;
const grid = { kind: 'boolean', name: 'Grid', description: '', default: true } as PrefLeaf;
const shown = { kind: 'number', name: 'Shown', description: '', default: 0, readout: true } as PrefLeaf;
const dash = { kind: 'enum', name: 'Dash', description: '', default: 'solid', options: [], encoding: {} } as unknown as PrefLeaf;

const GROUP = { name: 'View', resettable: true, children: { size, gap, grid, shown, dash } } as PrefGroup;

const one = (value: unknown, auto?: boolean): LeafReading => ({ value, mixed: false, each: [value], auto });

describe('leafIsAtReset', () => {
  it('reads a mixed leaf as not at its reset, whatever value it shows', () => {
    expect(leafIsAtReset(grid, { value: undefined, mixed: true, each: [true, false] })).toBe(false);
  });

  it('needs every target at its reset', () => {
    expect(leafIsAtReset(grid, { value: true, mixed: false, each: [true, true] })).toBe(true);
    expect(leafIsAtReset(grid, { value: undefined, mixed: false, each: [true, false] })).toBe(false);
  });

  it('reads a leaf that starts auto by its auto state where the surface keeps one, and by its default where not', () => {
    expect(leafIsAtReset(gap, one(4, false))).toBe(false);
    expect(leafIsAtReset(gap, one(undefined, true))).toBe(true);
    expect(leafIsAtReset(gap, one(4))).toBe(true);
  });

  it('always reads a readout as at its reset', () => {
    expect(leafIsAtReset(shown, one(99))).toBe(true);
  });
});

describe('resetPlan', () => {
  const values: Record<string, LeafReading> = {
    'view.size': one(20, false),
    'view.gap': one(7, false),
    'view.grid': one(false),
    'view.shown': one(99),
    'view.dash': one('dashed'),
  };

  it('unpins a leaf that starts auto, pins the rest at what they store at their default, and skips readouts', () => {
    expect(resetPlan(GROUP, 'view', (p) => values[p]).map(({ path, write }) => [path, write])).toEqual([
      ['view.size', 10],
      ['view.gap', AUTO],
      ['view.grid', true],
      // An encoded leaf stores nothing at its default.
      ['view.dash', undefined],
    ]);
  });

  it('leaves out a leaf already at its reset, and one the surface does not let it reach', () => {
    const read = (p: string): LeafReading | undefined =>
      p === 'view.grid' ? undefined : p === 'view.size' ? one(10, false) : values[p];
    expect(resetPlan(GROUP, 'view', read).map((w) => w.path)).toEqual(['view.gap', 'view.dash']);
  });

  it('finds a group or a leaf by its path, under a section by the leaf\'s own key', () => {
    const root = { name: '', children: { view: GROUP } } as PrefGroup;
    expect(resetPlanAt(root, ['view'], (p) => values[p]).map((w) => w.path)).toEqual(['view.size', 'view.gap', 'view.grid', 'view.dash']);
    expect(prefNodeAt(root, 'view.gap')).toBe(gap);
    const section = { name: '', members: { 'pose.x': grid, inner: { name: 'In', members: { y: size } } } } as unknown as PrefSection;
    expect(prefNodeAt(section, 'pose.x')).toBe(grid);
    expect(prefNodeAt(section, 'y')).toBe(size);
  });

  it('pins a leaf that starts auto at its default where the surface keeps no auto state', () => {
    expect(resetPlan(gap, 'gap', () => one(7))).toEqual([{ path: 'gap', leaf: gap, write: 4 }]);
  });
});
