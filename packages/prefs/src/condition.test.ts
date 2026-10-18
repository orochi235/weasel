import { createMemoryAdapter, createRecordCache } from '@weasel-js/storage';
import { describe, expect, it, vi } from 'vitest';
import {
  isPrefCondition,
  mapPrefConditionPaths,
  prefConditionHolds,
  prefConditionPaths,
  prefIsEnabled,
  prefIsShown,
  type PrefCondition,
} from './condition';
import { checkPrefCondition, checkPrefConditions } from './conditionCheck';
import type { PrefGroup, PrefSection } from './groups';
import { prefValueAtPath, visiblePrefSubtree } from './helpers';
import type { PrefLeaf } from './schema';
import { createPrefsStore } from './store';

const reader = (values: unknown) => (path: string) => prefValueAtPath(values, path);
const holds = (condition: PrefCondition, values: unknown) => prefConditionHolds(condition, reader(values));

describe('prefConditionHolds', () => {
  it('reads a bare path as set, by what each kind holds', () => {
    const set = (held: unknown) => holds({ path: 'a.on' }, { a: { on: held } });
    // boolean
    expect([set(true), set(false)]).toEqual([true, false]);
    // number
    expect([set(1), set(-0.5), set(0), set(Number.NaN)]).toEqual([true, true, false, false]);
    // string, color, field, and an enum's option
    expect([set('row'), set('#fff'), set('')]).toEqual([true, true, false]);
    // paint, and anything else an app's kind holds
    expect([set({ type: 'solid', color: '#000' }), set(null), set(undefined)]).toEqual([true, false, false]);
    // list
    expect([set([0]), set(['']), set([])]).toEqual([true, true, false]);
    // map, object, and union
    expect([set({ left: 0 }), set({ type: 'flat' }), set({})]).toEqual([true, true, false]);
    expect(holds({ path: 'a.on' }, {})).toBe(false);
    expect(holds({ not: { path: 'stops' } }, { stops: [] })).toBe(true);
  });

  it('compares with is and isNot', () => {
    expect(holds({ path: 'mode', is: 'row' }, { mode: 'row' })).toBe(true);
    expect(holds({ path: 'mode', is: 'row' }, { mode: 'column' })).toBe(false);
    expect(holds({ path: 'mode', isNot: 'row' }, { mode: 'column' })).toBe(true);
    expect(holds({ path: 'mode', isNot: 'row' }, { mode: 'row' })).toBe(false);
    expect(holds({ path: 'on', is: false }, { on: false })).toBe(true);
    expect(holds({ path: 'n', is: 0 }, { n: '0' })).toBe(false);
  });

  it('reads null as nothing held', () => {
    expect(holds({ path: 'script', is: null }, {})).toBe(true);
    expect(holds({ path: 'script', is: null }, { script: null })).toBe(true);
    expect(holds({ path: 'script', is: null }, { script: 'super' })).toBe(false);
    expect(holds({ path: 'script', isNot: null }, { script: 'super' })).toBe(true);
    expect(holds({ path: 'script', in: [null, 'sub'] }, {})).toBe(true);
  });

  it('tests membership with in', () => {
    expect(holds({ path: 'layout', in: ['plate', 'card'] }, { layout: 'card' })).toBe(true);
    expect(holds({ path: 'layout', in: ['plate', 'card'] }, { layout: 'list' })).toBe(false);
    expect(holds({ path: 'layout', in: [] }, { layout: 'list' })).toBe(false);
  });

  it('orders numbers, and holds for nothing that is not one', () => {
    expect(holds({ path: 'n', above: 3 }, { n: 4 })).toBe(true);
    expect(holds({ path: 'n', above: 3 }, { n: 3 })).toBe(false);
    expect(holds({ path: 'n', atLeast: 3 }, { n: 3 })).toBe(true);
    expect(holds({ path: 'n', below: 3 }, { n: 2 })).toBe(true);
    expect(holds({ path: 'n', below: 3 }, { n: 3 })).toBe(false);
    expect(holds({ path: 'n', atMost: 3 }, { n: 3 })).toBe(true);
    expect(holds({ path: 'n', above: 3 }, { n: '4' })).toBe(false);
    expect(holds({ path: 'n', below: 3 }, {})).toBe(false);
    expect(holds({ path: 'n', above: 3 }, { n: Infinity })).toBe(true);
  });

  it('holds only when every operator on one test does', () => {
    const range: PrefCondition = { path: 'n', atLeast: 1, below: 10 };
    expect(holds(range, { n: 1 })).toBe(true);
    expect(holds(range, { n: 10 })).toBe(false);
    expect(holds({ path: 'n', isNot: 2, in: [1, 2] }, { n: 2 })).toBe(false);
  });

  it('combines with all, any, and not', () => {
    const both: PrefCondition = { all: [{ path: 'mode', is: 'row' }, { path: 'fade' }] };
    expect(holds(both, { mode: 'row', fade: true })).toBe(true);
    expect(holds(both, { mode: 'row', fade: false })).toBe(false);
    const either: PrefCondition = { any: [{ path: 'mode', is: 'row' }, { path: 'fade' }] };
    expect(holds(either, { mode: 'column', fade: true })).toBe(true);
    expect(holds(either, { mode: 'column', fade: false })).toBe(false);
    expect(holds({ not: either }, { mode: 'column', fade: false })).toBe(true);
    expect(holds({ all: [] }, {})).toBe(true);
    expect(holds({ any: [] }, {})).toBe(false);
    expect(holds({ not: { any: [both, { path: 'x', above: 1 }] } }, { x: 2 })).toBe(false);
  });
});

describe('isPrefCondition', () => {
  it('takes every form', () => {
    for (const ok of [
      { path: 'a' },
      { path: 'a', is: null },
      { path: 'a', in: [1, 'b', true, null] },
      { path: 'a', atLeast: 1, below: 2 },
      { all: [{ path: 'a' }, { any: [] }] },
      { not: { path: 'a', isNot: 'x' } },
    ]) expect(isPrefCondition(ok)).toBe(true);
  });

  it('refuses what is not one', () => {
    for (const bad of [
      null,
      'a',
      () => true,
      {},
      { path: 1 },
      { path: 'a', is: {} },
      { path: 'a', in: 'x' },
      { path: 'a', in: [[]] },
      { path: 'a', above: '3' },
      { path: 'a', equals: 1 },
      { all: { path: 'a' } },
      { all: [{}] },
      { not: [] },
      { all: [], any: [] },
      { path: 'a', all: [] },
    ]) expect(isPrefCondition(bad)).toBe(false);
  });
});

describe('prefConditionPaths', () => {
  it('lists each path a condition reads, once, in the order met', () => {
    expect(prefConditionPaths({ path: 'a' })).toEqual(['a']);
    expect(
      prefConditionPaths({ all: [{ path: 'b', is: 1 }, { any: [{ path: 'a' }, { not: { path: 'b' } }] }, { path: 'c.d' }] }),
    ).toEqual(['b', 'a', 'c.d']);
  });
});

describe('mapPrefConditionPaths', () => {
  it('rewrites every path, at any depth, and keeps the rest', () => {
    const before: PrefCondition = { all: [{ path: 'a.mode', in: ['x'] }, { not: { path: 'b', above: 2 } }, { any: [{ path: 'a.mode' }] }] };
    const after = mapPrefConditionPaths(before, (p) => (p === 'a.mode' ? 'z.kind' : p));
    expect(after).toEqual({ all: [{ path: 'z.kind', in: ['x'] }, { not: { path: 'b', above: 2 } }, { any: [{ path: 'z.kind' }] }] });
    expect(before.all[0]).toEqual({ path: 'a.mode', in: ['x'] });
  });

  it('returns the condition it was given when no path changes', () => {
    const cond: PrefCondition = { all: [{ path: 'a' }, { not: { path: 'b' } }] };
    expect(mapPrefConditionPaths(cond, (p) => p)).toBe(cond);
    const moved = mapPrefConditionPaths(cond, (p) => (p === 'b' ? 'c' : p)) as { all: PrefCondition[] };
    expect(moved.all[0]).toBe(cond.all[0]);
  });
});

const num = (extra: object = {}): PrefLeaf => ({ kind: 'number', name: 'N', description: '', default: 0, ...extra });
const flag = (extra: object = {}): PrefLeaf => ({ kind: 'boolean', name: 'B', description: '', default: false, ...extra });
const pick = (values: string[], extra: object = {}): PrefLeaf =>
  ({ kind: 'enum', name: 'E', description: '', default: values[0], options: values.map((value) => ({ value, label: value })), ...extra }) as PrefLeaf;

const SCHEMA: PrefGroup = {
  name: '',
  children: {
    mode: pick(['row', 'column']),
    script: pick(['super', 'sub'], { clearable: true, default: undefined }),
    title: { kind: 'string', name: 'T', description: '', default: '' },
    go: { kind: 'action', name: 'Go', description: '', default: undefined, run: () => {} } as PrefLeaf,
    widget: { kind: 'gauge', name: 'G', description: '', default: 3 },
    windows: {
      name: 'Windows',
      children: {
        count: num(),
        scrolling: { name: 'Scrolling', children: { scrolls: flag() } },
        stroke: {
          kind: 'object',
          name: 'Stroke',
          description: '',
          default: {},
          children: { width: num(), ends: { name: 'Ends', members: { cap: pick(['butt', 'round']) } } },
        } as PrefLeaf,
        fill: {
          kind: 'union',
          name: 'Fill',
          description: '',
          default: { type: 'solid' },
          tag: 'type',
          variants: {
            solid: { kind: 'object', name: 'Solid', description: '', default: {}, children: { color: { kind: 'color', name: 'C', description: '', default: '#000' } } },
            linear: { kind: 'object', name: 'Linear', description: '', default: {}, children: { angle: num() } },
          },
        } as PrefLeaf,
        stops: { kind: 'list', name: 'Stops', description: '', default: [], item: num() } as PrefLeaf,
      },
    },
  },
};

const codes = (condition: unknown, schema: PrefGroup | PrefSection = SCHEMA) => checkPrefCondition(condition, schema).map((p) => p.code);

describe('checkPrefCondition', () => {
  it('passes a condition every leaf can answer', () => {
    const ok: PrefCondition = {
      all: [
        { path: 'mode', is: 'row' },
        { path: 'mode', in: ['row', 'column'] },
        { path: 'script', is: null },
        { path: 'windows.scrolling.scrolls' },
        { path: 'windows.scrolling.scrolls', is: false },
        { path: 'windows.count', atLeast: 2, isNot: 5 },
        { path: 'title', isNot: '' },
        { path: 'widget', is: 'anything' },
        { path: 'windows.stops' },
        { not: { any: [{ path: 'windows.stroke' }] } },
      ],
    };
    expect(checkPrefCondition(ok, SCHEMA)).toEqual([]);
  });

  it('reports a path no leaf holds', () => {
    expect(checkPrefCondition({ path: 'windows.pagin', is: 'x' }, SCHEMA)).toEqual([
      { code: 'no-leaf', path: 'windows.pagin', problem: 'no leaf holds a value at "windows.pagin"' },
    ]);
    expect(codes({ path: 'windows' })).toEqual(['no-leaf']);
    expect(codes({ path: 'windows.count.digits' })).toEqual(['no-leaf']);
    expect(codes({ any: [{ path: 'nope' }, { not: { path: 'neither' } }] })).toEqual(['no-leaf', 'no-leaf']);
  });

  it('reports a leaf that holds no value', () => {
    expect(codes({ path: 'go' })).toEqual(['no-value']);
  });

  it('reports an in with nothing in it, which never holds whatever the leaf', () => {
    expect(checkPrefCondition({ path: 'mode', in: [] }, SCHEMA)).toEqual([
      { code: 'never', path: 'mode', problem: '"mode" is one of nothing, which never holds' },
    ]);
    expect(codes({ path: 'widget', in: [] })).toEqual(['never']);
    expect(codes({ path: 'nope', in: [] })).toEqual(['no-leaf', 'never']);
    expect(codes({ any: [{ path: 'mode', in: ['row'] }, { not: { path: 'mode', in: [] } }] })).toEqual(['never']);
  });

  it('reports a value the leaf cannot hold', () => {
    expect(codes({ path: 'mode', is: 'diagonal' })).toEqual(['option']);
    expect(codes({ path: 'mode', in: ['row', 'diagonal', 3] })).toEqual(['option', 'value']);
    expect(codes({ path: 'windows.scrolling.scrolls', is: 'yes' })).toEqual(['value']);
    expect(codes({ path: 'windows.count', is: '3' })).toEqual(['value']);
    expect(codes({ path: 'title', isNot: 3 })).toEqual(['value']);
    expect(codes({ path: 'windows.stroke', is: 'thick' })).toEqual(['value']);
    expect(checkPrefCondition({ path: 'mode', is: 'diagonal' }, SCHEMA)[0]!.problem).toBe(
      `"mode" never holds 'diagonal': its options are 'row', 'column'`,
    );
  });

  it('reports an ordering of anything but a number', () => {
    expect(codes({ path: 'title', above: 3 })).toEqual(['value']);
    expect(codes({ path: 'mode', atMost: 3 })).toEqual(['value']);
    expect(codes({ path: 'windows.count', above: 3, below: 9 })).toEqual([]);
  });

  it('holds a leaf stored through an encoding to what its control shows', () => {
    const schema: PrefGroup = {
      name: '',
      children: {
        italic: flag({ encoding: { read: (s: unknown) => s === 'italic', write: (on: boolean) => (on ? 'italic' : undefined) } }),
        dash: pick(['solid', 'dashed'], { encoding: { read: () => 'solid', write: () => [] } }),
      },
    };
    expect(codes({ all: [{ path: 'italic', is: 'italic' }, { path: 'dash', is: 4 }] }, schema)).toEqual(['value', 'value']);
    expect(codes({ all: [{ path: 'italic', is: true }, { path: 'dash', is: 'dashed' }] }, schema)).toEqual([]);
  });

  it('reads into an object leaf by its fields, through its sections', () => {
    expect(codes({ path: 'windows.stroke.width', above: 1 })).toEqual([]);
    expect(codes({ path: 'windows.stroke.cap', is: 'round' })).toEqual([]);
    expect(codes({ path: 'windows.stroke.cap', is: 'square' })).toEqual(['option']);
    expect(codes({ path: 'windows.stroke.miter' })).toEqual(['no-leaf']);
  });

  it('reads into a union leaf by its tag and by any variant\'s fields', () => {
    expect(codes({ path: 'windows.fill.type', is: 'linear' })).toEqual([]);
    expect(codes({ path: 'windows.fill.type', is: 'conic' })).toEqual(['option']);
    expect(codes({ path: 'windows.fill.angle', above: 90 })).toEqual([]);
    expect(codes({ path: 'windows.fill.radius' })).toEqual(['no-leaf']);
  });

  it('does not judge a path into a value it cannot see inside', () => {
    expect(codes({ path: 'windows.stops.0', above: 1 })).toEqual([]);
    expect(codes({ path: 'widget.needle', is: 'x' })).toEqual([]);
  });

  it('finds a section schema\'s leaves by their whole key', () => {
    const node: PrefSection = {
      name: '',
      members: {
        'pose.x': num(),
        look: { name: 'Look', members: { 'data.closed': flag(), 'data.stroke': SCHEMA.children.windows && ((SCHEMA.children.windows as PrefGroup).children.stroke as PrefLeaf) } },
      },
    };
    expect(codes({ all: [{ path: 'pose.x', above: 0 }, { path: 'data.closed' }, { path: 'data.stroke.width', is: 2 }] }, node)).toEqual([]);
    expect(codes({ path: 'pose' }, node)).toEqual(['no-leaf']);
    expect(codes({ path: 'look' }, node)).toEqual(['no-leaf']);
  });

  it('reports what is not a condition, where it sits', () => {
    expect(checkPrefCondition('mode == row', SCHEMA)).toEqual([{ code: 'malformed', problem: 'not a condition: "mode == row"' }]);
    expect(codes({ all: [{ path: 'mode' }, { path: 'mode', equals: 'row' }] })).toEqual(['malformed']);
    expect(codes(() => true)).toEqual(['malformed']);
  });
});

describe('checkPrefConditions', () => {
  it('reports every bad condition in a schema, by the node and the field holding it', () => {
    const schema: PrefGroup = {
      name: '',
      showIf: { path: 'gone' },
      children: {
        on: flag(),
        size: num({ enableIf: { path: 'on' }, showIf: { path: 'on', is: 'yes' } }),
        more: {
          name: 'More',
          enableIf: { path: 'more.depth', above: 'a' } as never,
          children: {
            depth: num(),
            stroke: {
              kind: 'object',
              name: 'Stroke',
              description: '',
              default: {},
              children: { width: num({ showIf: { path: 'more.nope' } }), ends: { name: 'Ends', showIf: { path: 'zip' }, members: {} } },
            } as PrefLeaf,
            stops: { kind: 'list', name: 'Stops', description: '', default: [], item: num({ enableIf: { path: 'zap' } }) } as PrefLeaf,
          },
        },
      },
    };
    expect(checkPrefConditions(schema).map(({ at, field, code, path }) => ({ at, field, code, path }))).toEqual([
      { at: '', field: 'showIf', code: 'no-leaf', path: 'gone' },
      { at: 'size', field: 'showIf', code: 'value', path: 'on' },
      { at: 'more', field: 'enableIf', code: 'malformed', path: undefined },
      { at: 'more.stroke.width', field: 'showIf', code: 'no-leaf', path: 'more.nope' },
      { at: 'more.stroke.ends', field: 'showIf', code: 'no-leaf', path: 'zip' },
      { at: 'more.stops.item', field: 'enableIf', code: 'no-leaf', path: 'zap' },
    ]);
  });

  it('walks a section schema, naming a leaf by its key and a section by its own', () => {
    const node: PrefSection = {
      name: '',
      members: {
        'pose.x': num(),
        look: { name: 'Look', enableIf: { path: 'pose.y' }, members: { 'data.closed': flag({ showIf: { path: 'pose.x', is: true } }) } },
      },
    };
    expect(checkPrefConditions(node).map(({ at, field, code }) => ({ at, field, code }))).toEqual([
      { at: 'look', field: 'enableIf', code: 'no-leaf' },
      { at: 'data.closed', field: 'showIf', code: 'value' },
    ]);
  });

  it('answers nothing for a schema with no conditions, or only good ones', () => {
    expect(checkPrefConditions(SCHEMA)).toEqual([]);
  });
});

describe('prefIsShown and prefIsEnabled', () => {
  const leaf = num({ showIf: { path: 'on' }, enableIf: { path: 'mode', is: 'row' } });
  const group: PrefGroup = { name: 'G', enableIf: { path: 'on' }, children: {} };

  it('answer a node\'s own condition, and yes for a node with none', () => {
    expect(prefIsShown(leaf, reader({ on: true }))).toBe(true);
    expect(prefIsShown(leaf, reader({ on: false }))).toBe(false);
    expect(prefIsEnabled(leaf, reader({ mode: 'row' }))).toBe(true);
    expect(prefIsEnabled(leaf, reader({ mode: 'column' }))).toBe(false);
    expect(prefIsShown(group, reader({}))).toBe(true);
    expect(prefIsEnabled(group, reader({}))).toBe(false);
    expect(prefIsEnabled(num(), reader({}))).toBe(true);
  });
});

describe('a schema carrying conditions', () => {
  it('keeps them through the walks that copy its nodes', () => {
    const schema: PrefGroup = {
      name: '',
      children: {
        on: flag(),
        more: { name: 'More', showIf: { path: 'on' }, children: { size: num({ enableIf: { path: 'on' } }), secret: num({ hidden: true }) } },
      },
    };
    const kept = visiblePrefSubtree(schema, false)!;
    const more = kept.children.more as PrefGroup;
    expect(more.showIf).toEqual({ path: 'on' });
    expect((more.children.size as PrefLeaf).enableIf).toEqual({ path: 'on' });
    expect(JSON.parse(JSON.stringify(schema))).toEqual(schema);
  });
});

describe('a store opened on a schema', () => {
  const open = (schema: PrefGroup) =>
    createPrefsStore(schema, createRecordCache({ storage: createMemoryAdapter(new Map()), prefix: 'p.', initial: [] }));

  it('warns of each bad condition, and opens all the same', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const store = open({ name: '', children: { on: flag(), size: num({ enableIf: { path: 'off' } }) } });
      expect(warn.mock.calls).toEqual([['[prefs] enableIf of "size": no leaf holds a value at "off"']]);
      expect(store.get('size')).toBe(0);
    } finally {
      warn.mockRestore();
    }
  });

  it('says nothing of a good one', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      open({ name: '', children: { on: flag(), size: num({ enableIf: { path: 'on' } }) } });
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
