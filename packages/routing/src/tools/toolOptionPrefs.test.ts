import { describe, expect, it, vi } from 'vitest';
import { SHARED_TOOL_OPTIONS, toolOptionParams, setToolOption, type ToolOptionsSpec } from './toolOptions';
import { prefsToolOptionValues, toolOptionsPrefs, type ToolOptionPrefsStore } from './toolOptionPrefs';

/** A store over a flat map of paths, filling in the shared fill's default as a `PrefsStore` does. */
function fakeStore(): ToolOptionPrefsStore & { get(path: string): unknown } {
  const held = new Map<string, unknown>();
  const listeners = new Set<() => void>();
  let tree: Record<string, unknown> = {};
  const rebuild = () => {
    tree = { tools: { shared: { fill: '#ffffff' } } };
    for (const [path, v] of held) {
      const parts = path.split('.');
      let at = tree;
      for (const p of parts.slice(0, -1)) at = (at[p] ??= {}) as Record<string, unknown>;
      at[parts.at(-1)!] = v;
    }
  };
  rebuild();
  return {
    get: (path) => held.get(path),
    values: () => tree,
    set(path, value) {
      held.set(path, value);
      rebuild();
      for (const l of listeners) l();
    },
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

const options = (fill: string): ToolOptionsSpec => ({
  actionId: 'insert',
  prefs: {
    name: 'Shape',
    children: {
      fill: { kind: 'color', name: 'Fill', description: '', default: fill },
      sides: { kind: 'number', name: 'Sides', description: '', default: 6, min: 3, max: 12 },
    },
  },
  share: { fill: 'fill' },
});
const RECT = { id: 'rect', options: options('#ff0000') };
const STAR = { id: 'star', options: options('#0000ff') };

describe('toolOptionsPrefs', () => {
  it('groups each tool’s own options under its id and the shared ones once', () => {
    const schema = toolOptionsPrefs([RECT, STAR, { id: 'select' }]);
    expect(Object.keys(schema.children)).toEqual(['rect', 'star', SHARED_TOOL_OPTIONS]);
    expect(Object.keys((schema.children.rect as { children: object }).children)).toEqual(['sides']);
    expect((schema.children[SHARED_TOOL_OPTIONS] as { children: Record<string, { default: unknown }> }).children.fill.default)
      .toBe('#ff0000');
  });

  it('gives a shared key the default the host names', () => {
    const schema = toolOptionsPrefs([RECT, STAR], { name: 'T', shared: { fill: '#ffffff', nope: 1 } });
    const shared = (schema.children[SHARED_TOOL_OPTIONS] as { children: Record<string, { default: unknown }> }).children;
    expect(shared.fill.default).toBe('#ffffff');
    expect(Object.keys(shared)).toEqual(['fill']);
    expect(schema.name).toBe('T');
  });
});

describe('toolOptionsPrefs: a shared number', () => {
  const sized = (id: string, max: number, min = 2) => ({
    id,
    options: {
      actionId: 'paint',
      prefs: { name: 'Brush', children: { radiusPx: { kind: 'number', name: 'Size', description: '', default: 20, min, max } } },
      share: { radiusPx: 'size' },
    } satisfies ToolOptionsSpec,
  });
  const sharedLeaf = (schema: ReturnType<typeof toolOptionsPrefs>) =>
    (schema.children[SHARED_TOOL_OPTIONS] as { children: Record<string, { min?: number; max?: number; default?: unknown }> })
      .children.size;

  it('holds the widest bounds of every tool naming it, so each tool clamps it alone', () => {
    for (const tools of [[sized('small', 30), sized('big', 400, 5)], [sized('big', 400, 5), sized('small', 30)]]) {
      const leaf = sharedLeaf(toolOptionsPrefs(tools));
      expect([leaf.min, leaf.max]).toEqual([2, 400]);
    }
  });

  it('is unbounded at an end any tool leaves open', () => {
    const open = sized('open', 30);
    delete (open.options.prefs.children.radiusPx as { max?: number }).max;
    expect(sharedLeaf(toolOptionsPrefs([sized('big', 400), open])).max).toBeUndefined();
  });
});

describe('prefsToolOptionValues', () => {
  const open = () => {
    const store = fakeStore();
    return { store, values: prefsToolOptionValues(store, 'tools') };
  };

  it('keeps each option at <base>.<owner>.<key>', () => {
    const { store, values } = open();
    setToolOption('rect', RECT.options, values, 'fill', '#00ff00');
    setToolOption('star', STAR.options, values, 'sides', 9);
    expect(store.get('tools.shared.fill')).toBe('#00ff00');
    expect(store.get('tools.star.sides')).toBe(9);
    expect(toolOptionParams('star', STAR.options, values)).toEqual({ fill: '#00ff00', sides: 9 });
  });

  it('reads a shared key nobody set as the default the store’s schema gives it', () => {
    const { values } = open();
    expect(toolOptionParams('star', STAR.options, values).fill).toBe('#ffffff');
  });

  it('hands back the same object until a value changes, and notifies', () => {
    const { values } = open();
    const listener = vi.fn();
    values.subscribe(listener);
    values.set('rect', 'sides', 4);
    const first = values.get('rect');
    expect(values.get('rect')).toBe(first);
    values.set('star', 'sides', 5);
    expect(values.get('rect')).toBe(first);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('tool ids and option keys named like Object.prototype members', () => {
  it('keeps a tool named __proto__ and an option named constructor as their own groups and leaves', () => {
    const opts: ToolOptionsSpec = {
      actionId: 'insert',
      prefs: { name: 'Odd', children: { constructor: { kind: 'number', name: 'C', description: '', default: 1 } } },
    };
    const group = toolOptionsPrefs([{ id: '__proto__', options: opts }]);
    expect(Object.getPrototypeOf(group.children)).toBe(Object.prototype);
    expect(Object.hasOwn(group.children, '__proto__')).toBe(true);
    const tool = group.children['__proto__'] as { children: Record<string, unknown> };
    expect(Object.hasOwn(tool.children, 'constructor')).toBe(true);
  });

  it('reads nothing for a tool named toString that the store holds no values for', () => {
    const values = prefsToolOptionValues(fakeStore(), 'tools');
    expect(values.get('toString')).toEqual({});
  });
});
