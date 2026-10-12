import { describe, expect, it } from 'vitest';
import { checkPrefCondition, checkPrefConditions } from './conditionCheck';
import type { PrefGroup } from './groups';
import type { PrefList } from './list';
import type { PrefMap } from './map';
import type { PrefLeaf } from './schema';

const num = (extra: Partial<PrefLeaf> = {}): PrefLeaf => ({ kind: 'number', name: 'N', description: '', default: 0, ...extra }) as PrefLeaf;
const flag = (extra: Partial<PrefLeaf> = {}): PrefLeaf => ({ kind: 'boolean', name: 'F', description: '', default: false, ...extra }) as PrefLeaf;
const list = (item: PrefLeaf, extra: Partial<PrefLeaf> = {}): PrefLeaf => ({ kind: 'list', name: 'L', description: '', default: [], item, ...extra }) as PrefLeaf;
const map = (item: PrefLeaf): PrefLeaf => ({ kind: 'map', name: 'M', description: '', default: {}, item }) as PrefLeaf;

describe("a showIf on a list's or a map's item", () => {
  const schema: PrefGroup = {
    name: '',
    children: {
      on: flag(),
      stops: list(num({ showIf: { path: 'on' }, enableIf: { path: 'on' } }), { showIf: { path: 'on' } }),
      weights: map(num({ showIf: { path: 'on' } })),
      runs: list(list(num({ showIf: { path: 'on' } }))),
    },
  };
  const said = (holder: string): string =>
    `a ${holder}'s item is drawn with each entry and is never hidden: put the condition on the entry's fields, or on the ${holder}`;

  it('is reported for the schema, with where the condition belongs, and its enableIf is not', () => {
    expect(checkPrefConditions(schema)).toEqual([
      { at: 'stops.item', field: 'showIf', code: 'item-show', problem: said('list') },
      { at: 'weights.item', field: 'showIf', code: 'item-show', problem: said('map') },
      { at: 'runs.item.item', field: 'showIf', code: 'item-show', problem: said('list') },
    ]);
  });

  it('is reported for one condition told where it sits, before anything else wrong with it', () => {
    const within = schema.children.weights as PrefMap;
    expect(checkPrefCondition({ path: 'gone' }, schema, { within, itemShowIf: true }).map((p) => p.code)).toEqual(['item-show', 'no-leaf']);
    expect(checkPrefCondition({ path: 'on' }, schema, { within: schema.children.stops as PrefList })).toEqual([]);
    expect(checkPrefCondition({ path: 'on' }, schema)).toEqual([]);
  });
});
