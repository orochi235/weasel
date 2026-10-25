import { describe, expect, it } from 'vitest';
import type { PrefCondition } from './condition';
import type { PrefGroup, PrefSection } from './groups';
import { prefValueAtPath } from './helpers';
import type { PrefLeaf, PrefObject } from './schema';
import { applyPrefConditions, PREF_SCOPE, prefJudge, prefReader, prefScopeAt, prefScopeUnder } from './scope';
import type { PrefUnion } from './union';

const bool = (name: string, extra: Partial<PrefLeaf> = {}): PrefLeaf =>
  ({ kind: 'boolean', name, description: '', default: false, ...extra }) as PrefLeaf;
const num = (name: string, extra: Partial<PrefLeaf> = {}): PrefLeaf =>
  ({ kind: 'number', name, description: '', default: 0, ...extra }) as PrefLeaf;

const over = (values: unknown) => prefJudge({ name: '', children: {} }, (path) => prefValueAtPath(values, path));

const on: PrefCondition = { path: 'snap.on' };

describe('prefScopeUnder', () => {
  it('is shown and enabled with no condition, under a scope that is', () => {
    expect(prefScopeUnder(PREF_SCOPE, {}, over({}))).toEqual({ shown: true, enabled: true });
  });

  it('answers for the node and for what is above it', () => {
    const judge = over({ snap: { on: false } });
    expect(prefScopeUnder(PREF_SCOPE, { showIf: on }, judge)).toEqual({ shown: false, enabled: true });
    expect(prefScopeUnder(PREF_SCOPE, { enableIf: on }, judge)).toEqual({ shown: true, enabled: false });
    expect(prefScopeUnder({ shown: false, enabled: true }, {}, judge).shown).toBe(false);
    expect(prefScopeUnder({ shown: true, enabled: false }, {}, judge).enabled).toBe(false);
  });

  it('tells the judge which field it is asked about', () => {
    const asked: string[] = [];
    prefScopeUnder(PREF_SCOPE, { showIf: on, enableIf: on }, (_c, field) => (asked.push(field), true));
    expect(asked).toEqual(['showIf', 'enableIf']);
  });
});

const schema: PrefGroup = {
  name: 'Root',
  children: {
    snap: {
      name: 'Snap',
      children: {
        on: bool('On'),
        grid: {
          name: 'Grid',
          showIf: { path: 'snap.mode', is: 'grid' },
          children: { size: num('Size'), fine: bool('Fine', { enableIf: on }) },
        },
        angle: num('Angle', { enableIf: on }),
        mode: num('Mode'),
      },
    },
    view: {
      name: 'View',
      enableIf: on,
      children: { zoom: num('Zoom'), hint: bool('Hint', { showIf: { path: 'view.zoom', above: 1 } }) },
    },
  },
};

describe('applyPrefConditions', () => {
  it('returns the schema itself when every condition holds', () => {
    const { shown, disabled } = applyPrefConditions(schema, over({ snap: { on: true, mode: 'grid' }, view: { zoom: 2 } }));
    expect(shown).toBe(schema);
    expect([...disabled]).toEqual([]);
  });

  it('drops a node whose showIf fails, with everything under it', () => {
    const { shown } = applyPrefConditions(schema, over({ snap: { on: true, mode: 'ring' }, view: { zoom: 2 } }));
    expect(Object.keys((shown!.children.snap as PrefGroup).children)).toEqual(['on', 'angle', 'mode']);
    expect(shown!.children.view).toBe(schema.children.view);
  });

  it('names a leaf whose enableIf fails, and every leaf and group under a group whose enableIf fails', () => {
    const { shown, disabled } = applyPrefConditions(schema, over({ snap: { on: false, mode: 'grid' }, view: { zoom: 2 } }));
    expect([...disabled].sort()).toEqual(['snap.angle', 'snap.grid.fine', 'view', 'view.hint', 'view.zoom']);
    expect(shown).toBe(schema);
  });

  it('drops a group left with nothing to draw, and keeps it when asked', () => {
    const only: PrefGroup = { name: '', children: { a: { name: 'A', children: { x: bool('X', { showIf: on }) } }, b: bool('B') } };
    expect(Object.keys(applyPrefConditions(only, over({})).shown!.children)).toEqual(['b']);
    expect(Object.keys(applyPrefConditions(only, over({}), { keepEmpty: true }).shown!.children)).toEqual(['a', 'b']);
  });

  it('is null for a root that is not shown', () => {
    expect(applyPrefConditions({ ...schema, showIf: on }, over({})).shown).toBeNull();
  });

  it('walks an object leaf: a field, and a section of fields', () => {
    const stroke: PrefObject = {
      kind: 'object', name: 'Stroke', description: '', default: {},
      children: {
        width: num('Width'),
        dash: num('Dash', { showIf: { path: 'stroke.width', above: 0 } }),
        ends: {
          name: 'Ends',
          enableIf: { path: 'stroke.width', above: 0 },
          members: { cap: num('Cap'), join: num('Join', { showIf: { path: 'stroke.cap', is: 1 } }) },
        },
      },
    };
    const root: PrefGroup = { name: '', children: { stroke } };
    const { shown, disabled } = applyPrefConditions(root, over({ stroke: { width: 0 } }));
    const kept = shown!.children.stroke as PrefObject;
    expect(Object.keys(kept.children)).toEqual(['width', 'ends']);
    expect(Object.keys((kept.children.ends as PrefSection).members)).toEqual(['cap']);
    expect([...disabled].sort()).toEqual(['stroke.#ends', 'stroke.cap']);
  });

  it('names every field of an object leaf that is disabled', () => {
    const stroke = {
      kind: 'object', name: 'Stroke', description: '', default: {}, enableIf: on,
      children: { width: num('Width'), ends: { name: 'Ends', members: { cap: num('Cap') } } },
    } as PrefObject;
    const { disabled } = applyPrefConditions({ name: '', children: { stroke } }, over({}));
    expect([...disabled].sort()).toEqual(['stroke', 'stroke.#ends', 'stroke.cap', 'stroke.width']);
  });

  it('walks each variant of a union', () => {
    const variant = (children: PrefObject['children']): PrefObject =>
      ({ kind: 'object', name: 'V', description: '', default: {}, children });
    const fill: PrefUnion = {
      kind: 'union', name: 'Fill', description: '', default: undefined, tag: 'type',
      variants: { linear: variant({ angle: num('Angle', { showIf: on }), spread: num('Spread', { enableIf: on }) }) },
    };
    const { shown, disabled } = applyPrefConditions({ name: '', children: { fill } }, over({}));
    expect(Object.keys((shown!.children.fill as PrefUnion).variants.linear!.children)).toEqual(['spread']);
    expect([...disabled]).toEqual(['fill.spread']);
  });

  it('walks a section schema, where a leaf key is the whole path and a section key is no part of one', () => {
    const node: PrefSection = {
      name: 'Node',
      members: {
        'pose.x': num('X'),
        text: {
          name: 'Text',
          showIf: { path: 'data.kind', is: 'text' },
          members: { 'data.size': num('Size') },
        },
        look: {
          name: 'Look',
          enableIf: { path: 'data.locked', is: false },
          members: { 'data.fill': num('Fill'), 'data.kind': num('Kind', { enableIf: { path: 'pose.x', above: 0 } }) },
        },
      },
    };
    const { shown, disabled } = applyPrefConditions(node, over({ pose: { x: 1 }, data: { kind: 'rect', locked: true } }));
    expect(Object.keys(shown!.members)).toEqual(['pose.x', 'look']);
    expect([...disabled].sort()).toEqual(['#look', 'data.fill', 'data.kind']);
  });
});

describe('prefScopeAt', () => {
  it('answers for a path by every node on the way to it', () => {
    const judge = over({ snap: { on: false, mode: 'ring' } });
    expect(prefScopeAt(schema, 'snap.on', judge)).toEqual({ shown: true, enabled: true });
    expect(prefScopeAt(schema, 'snap.grid', judge)).toEqual({ shown: false, enabled: true });
    expect(prefScopeAt(schema, 'snap.grid.fine', judge)).toEqual({ shown: false, enabled: false });
    expect(prefScopeAt(schema, 'view.zoom', judge)).toEqual({ shown: true, enabled: false });
  });

  it('follows a field into an object leaf, through the sections that hold it', () => {
    const stroke = {
      kind: 'object', name: 'Stroke', description: '', default: {},
      children: { ends: { name: 'Ends', showIf: on, members: { cap: num('Cap') } } },
    } as PrefObject;
    const root: PrefGroup = { name: '', children: { stroke } };
    expect(prefScopeAt(root, 'stroke.cap', over({})).shown).toBe(false);
    expect(prefScopeAt(root, 'stroke.cap', over({ snap: { on: true } })).shown).toBe(true);
  });

  it('stops at the last node a path reaches', () => {
    expect(prefScopeAt({ ...schema, enableIf: on }, 'no.such', over({}))).toEqual({ shown: true, enabled: false });
  });
});

describe('prefReader', () => {
  const stroke = {
    kind: 'object', name: 'Stroke', description: '', default: { width: 2, ends: { cap: 1 } },
    children: { width: num('Width') },
  } as PrefObject;
  const root: PrefGroup = { name: '', children: { snap: { name: 'Snap', children: { on: bool('On', { default: true }) } }, stroke } };

  it('reads what is held', () => {
    const read = prefReader(root, { snap: { on: false }, stroke: { width: 5 } });
    expect(read('snap.on')).toBe(false);
    expect(read('stroke.width')).toBe(5);
  });

  it('reads a leaf holding nothing as its default, and a field of one inside that default', () => {
    const read = prefReader(root, {});
    expect(read('snap.on')).toBe(true);
    expect(read('stroke.width')).toBe(2);
    expect(read('stroke.ends.cap')).toBe(1);
  });

  it('reads a path no leaf holds as undefined', () => {
    const read = prefReader(root, {});
    expect(read('snap')).toBeUndefined();
    expect(read('no.such')).toBeUndefined();
  });
});
