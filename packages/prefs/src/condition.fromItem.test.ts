import { describe, expect, it } from 'vitest';
import {
  isPrefCondition,
  mapPrefConditionPaths,
  prefConditionHolds,
  prefConditionPaths,
  prefConditionReadsItem,
  type PrefCondition,
} from './condition';
import { checkPrefCondition, checkPrefConditions } from './conditionCheck';
import type { PrefGroup } from './groups';
import type { PrefList } from './list';
import type { PrefLeaf } from './schema';

const mode = { kind: 'enum', name: 'Mode', description: '', default: 'ease', options: [{ value: 'ease', label: 'Ease' }, { value: 'hold', label: 'Hold' }] } as PrefLeaf;
const num = (extra: Partial<PrefLeaf> = {}): PrefLeaf => ({ kind: 'number', name: 'N', description: '', default: 0, ...extra }) as PrefLeaf;
const object = (children: Record<string, PrefLeaf>, extra: Partial<PrefLeaf> = {}): PrefLeaf =>
  ({ kind: 'object', name: 'O', description: '', default: {}, children, ...extra }) as PrefLeaf;
const list = (item: PrefLeaf): PrefLeaf => ({ kind: 'list', name: 'L', description: '', default: [], item }) as PrefLeaf;

describe('a test that reads from the entry', () => {
  const both: PrefCondition = { all: [{ from: 'item', path: 'mode', is: 'hold' }, { not: { path: 'mode', is: 'off' } }] };

  it('is a condition, and anything else in from is not', () => {
    expect(isPrefCondition({ from: 'item', path: 'mode' })).toBe(true);
    expect(isPrefCondition({ from: 'root', path: 'mode' })).toBe(false);
    expect(isPrefCondition({ from: 'item' })).toBe(false);
  });

  it('is read through the reader with where it reads from, and a root test with nothing', () => {
    const asked: Array<[string, string | undefined]> = [];
    const read = (path: string, from?: 'item') => {
      asked.push([path, from]);
      return from === 'item' ? 'hold' : 'on';
    };
    expect(prefConditionHolds(both, read)).toBe(true);
    expect(asked).toEqual([['mode', 'item'], ['mode', undefined]]);
    expect(prefConditionHolds({ from: 'item', path: 'mode' }, () => undefined)).toBe(false);
  });

  it('keeps its paths apart from the root\'s', () => {
    expect(prefConditionPaths(both)).toEqual(['mode']);
    expect(prefConditionPaths(both, 'item')).toEqual(['mode']);
    expect(prefConditionPaths({ any: [{ path: 'a' }, { from: 'item', path: 'b' }, { from: 'item', path: 'c' }] }, 'item')).toEqual(['b', 'c']);
    expect(prefConditionReadsItem(both)).toBe(true);
    expect(prefConditionReadsItem({ not: { path: 'mode' } })).toBe(false);
  });

  it('is moved with where it reads from told, and keeps reading from the entry', () => {
    const moved = mapPrefConditionPaths(both, (path, from) => (from === 'item' ? `${path}2` : path));
    expect(moved).toEqual({ all: [{ from: 'item', path: 'mode2', is: 'hold' }, { not: { path: 'mode', is: 'off' } }] });
    expect(mapPrefConditionPaths(both, (path, from) => (from === 'item' ? path : path))).toBe(both);
  });
});

describe('checking a test that reads from the entry', () => {
  const inner = list(object({ deep: mode, far: num({ enableIf: { from: 'item', path: 'deep', is: 'hold' } }), out: num({ showIf: { from: 'item', path: 'mode' } }) }));
  const phase = object({
    mode,
    hold: num({ enableIf: { from: 'item', path: 'mode', is: 'hold' } }),
    ease: num({ showIf: { from: 'item', path: 'mode', is: 'bounce' } }),
    lost: num({ showIf: { from: 'item', path: 'nope' } }),
    rows: inner,
  }, { enableIf: { from: 'item', path: 'hold', above: 1 } });
  const schema: PrefGroup = {
    name: '',
    children: {
      mode: num(),
      loose: num({ showIf: { from: 'item', path: 'mode' } }),
      phases: list(phase),
      counts: list(num({ enableIf: { from: 'item', path: '', above: 0 } })),
    },
  };

  it('holds the path to the schema of the nearest item, and reports one read where there is no item', () => {
    expect(checkPrefConditions(schema).map(({ at, field, code, path, problem }) => ({ at, field, code, path, problem }))).toEqual([
      { at: 'loose', field: 'showIf', code: 'no-item', path: 'mode', problem: '"mode" is read from an entry, and this is inside no list or map' },
      { at: 'phases.item.ease', field: 'showIf', code: 'option', path: 'mode', problem: `the entry's "mode" never holds 'bounce': its options are 'ease', 'hold'` },
      { at: 'phases.item.lost', field: 'showIf', code: 'no-leaf', path: 'nope', problem: 'no leaf holds a value at "nope" in the entry' },
      { at: 'phases.item.rows.item.out', field: 'showIf', code: 'no-leaf', path: 'mode', problem: 'no leaf holds a value at "mode" in the entry' },
    ]);
  });

  it('checks one condition against the item it is told of', () => {
    const within = schema.children.phases as PrefList;
    expect(checkPrefCondition({ from: 'item', path: 'mode', is: 'hold' }, schema, { within })).toEqual([]);
    expect(checkPrefCondition({ from: 'item', path: 'mode', is: 'hold' }, schema).map((p) => p.code)).toEqual(['no-item']);
    expect(checkPrefCondition({ path: 'phases.item.mode' }, schema, { within }).map((p) => p.code)).toEqual([]);
  });
});
