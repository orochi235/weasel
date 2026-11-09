import { describe, expect, it } from 'vitest';
import type { MenuEntry } from '@weasel-js/menu';
import { pref, type PrefGroup, type PrefLeaf, type PrefObject } from '@weasel-js/prefs';
import { resolveSchemaMenu, type MenuSources } from './resolveMenu';
import type { Action } from '../interactions/actions/action';

const immediate = { timing: 'immediate' as const, run: () => {} };
const actions: Action[] = [
  { id: 'cut', label: 'Cut', invoker: immediate },
  { id: 'paste', label: 'Paste', invoker: immediate, enabled: () => 'Nothing copied' },
];

function store(initial: Record<string, unknown>): MenuSources {
  const values = (path: string) => {
    let cur: unknown = initial;
    for (const seg of path.split('.')) cur = cur !== null && typeof cur === 'object' ? (cur as Record<string, unknown>)[seg] : undefined;
    return cur;
  };
  return { actions: () => actions, depsFor: () => undefined, trigger: () => true, values, onChange: () => {} };
}

const menu = (children: Record<string, PrefLeaf | PrefGroup>): PrefGroup => ({ name: '', children });
const off = { enableIf: { path: 'on' }, disabledReason: 'Turn it on' };

/** Every row that is not a separator, submenus' entries included. */
const rows = (es: readonly MenuEntry[]): MenuEntry[] =>
  es.flatMap((e) => (e.kind === 'separator' ? [] : e.kind === 'submenu' ? [e, ...rows(e.entries)] : [e]));

describe("resolveSchemaMenu: a disabled pref's reason", () => {
  it('reaches every row a disabled boolean, enum, number, color, string and action draws', () => {
    const es = resolveSchemaMenu(menu({
      on: pref.boolean('On', false),
      b: pref.boolean('B', false, off),
      e: pref.enum('E', 'x', [{ value: 'x', label: 'X' }, { value: 'y', label: 'Y' }], off),
      n: pref.number('N', 1, off),
      c: pref.color('C', '#000000', off),
      s: pref.string('S', '', off),
      a: pref.action('cut', off),
    }), store({ on: false }));
    const drawn = rows(es).slice(1);
    expect(drawn).toHaveLength(7);
    for (const row of drawn) expect(row).toMatchObject({ disabled: true, disabledReason: 'Turn it on' });
  });

  it("is the reason an action row gives over the action's own", () => {
    const es = resolveSchemaMenu(menu({ on: pref.boolean('On', false), p: pref.action('paste', off) }), store({ on: false }));
    expect(es[1]).toMatchObject({ disabled: true, disabledReason: 'Turn it on' });
  });

  it("reaches an object's rows, each of which keeps a reason of its own", () => {
    const pen = {
      kind: 'object', name: 'Pen', description: '', default: { width: 1 }, ...off,
      children: {
        width: pref.number('Width', 1),
        name: pref.string('Name', '', { disabledReason: 'Named by the tool' }),
        cut: pref.action('cut'),
      },
    } as unknown as PrefObject;
    const es = resolveSchemaMenu(menu({ on: pref.boolean('On', false), pen }), store({ on: false, pen: { width: 2 } }));
    const [, width, name, cut] = rows(es).slice(1);
    expect(width).toMatchObject({ disabled: true, disabledReason: 'Turn it on' });
    expect(name).toMatchObject({ disabled: true, disabledReason: 'Named by the tool' });
    expect(cut).toMatchObject({ disabled: true, disabledReason: 'Turn it on' });
  });

  it('is absent while the pref is enabled', () => {
    const es = resolveSchemaMenu(menu({ on: pref.boolean('On', true), n: pref.number('N', 1, off) }), store({ on: true }));
    expect(es[1]).not.toHaveProperty('disabledReason');
  });
});
