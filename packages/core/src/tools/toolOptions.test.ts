import { describe, expect, it, vi } from 'vitest';
import { createToolOptionValues, defineTool, type ActionTuning, type ToolOptions, type ToolOptionValues } from '@weasel-js/routing';
import { tuneToolOptions } from './toolOptions';

const OPTIONS: ToolOptions = {
  actionId: 'brush',
  prefs: {
    name: 'Brush', description: '',
    children: { radiusPx: { kind: 'number', name: 'Size', description: '', default: 40 } },
  },
};

const depsOf = (values: ToolOptionValues, active = { active: 'b' as string | null }) => ({
  get: (name: string) => (name === 'toolOptionValues' ? values : name === 'activeTool' ? active : undefined),
});

describe('tuneToolOptions', () => {
  it("tunes each tool's action with the values the toolOptionValues dep holds, read per invocation", () => {
    const tunings = new Map<string, ActionTuning>();
    const release = vi.fn();
    const registry = { tune: (id: string, t: ActionTuning) => { tunings.set(id, t); return release; } };
    const values = createToolOptionValues();
    const deps = depsOf(values);
    const tools = [defineTool({ id: 'b', options: OPTIONS }), defineTool({ id: 'plain' })];
    const done = tuneToolOptions(registry, deps as never, tools);
    expect([...tunings.keys()]).toEqual(['brush']);
    const params = tunings.get('brush')!.params as () => Record<string, unknown>;
    // Nothing held: the option's default.
    expect(params()).toEqual({ radiusPx: 40 });
    values.set('b', 'radiusPx', 25);
    expect(params()).toEqual({ radiusPx: 25 });
    done();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('writes what the last-operation panel keeps back to the dep, so the options row and the panel agree', () => {
    const tunings = new Map<string, ActionTuning>();
    const registry = { tune: (id: string, t: ActionTuning) => { tunings.set(id, t); return () => {}; } };
    const values = createToolOptionValues();
    const set = vi.spyOn(values, 'set');
    const deps = depsOf(values);
    tuneToolOptions(registry, deps as never, [defineTool({ id: 'b', options: OPTIONS })]);
    const tuning = tunings.get('brush')!;
    // The default already: nothing to write. Not an option: never written.
    tuning.keep!({ radiusPx: 40, strength: 0.2 });
    expect(set).not.toHaveBeenCalled();
    tuning.keep!({ radiusPx: 60 });
    expect(values.get('b')).toEqual({ radiusPx: 60 });
    expect((tuning.params as () => Record<string, unknown>)()).toEqual({ radiusPx: 60 });
  });

  it('reaches an action several tools bind with only the active tool’s options', () => {
    const tunings = new Map<string, ActionTuning[]>();
    const registry = {
      tune: (id: string, t: ActionTuning) => { tunings.set(id, [...(tunings.get(id) ?? []), t]); return () => {}; },
    };
    const values = createToolOptionValues();
    const active = { active: 'b' as string | null };
    const shared: ToolOptions = { ...OPTIONS, actionId: ['brush', 'tap'] };
    tuneToolOptions(registry, depsOf(values, active) as never, [
      defineTool({ id: 'b', options: shared }), defineTool({ id: 'c', options: shared }),
    ]);
    expect([...tunings.keys()]).toEqual(['brush', 'tap']);
    values.set('b', 'radiusPx', 10);
    values.set('c', 'radiusPx', 20);
    const read = () => tunings.get('tap')!.map((t) => (t.params as () => Record<string, unknown>)());
    expect(read()).toEqual([{ radiusPx: 10 }, {}]);
    active.active = 'c';
    expect(read()).toEqual([{}, { radiusPx: 20 }]);
    for (const t of tunings.get('brush')!) t.keep!({ radiusPx: 30 });
    expect(values.get('b')).toEqual({ radiusPx: 10 });
    expect(values.get('c')).toEqual({ radiusPx: 30 });
  });

  it('keeps a panel change made after a tool switch in the options of the tool its operation ran with', () => {
    const tunings: ActionTuning[] = [];
    const registry = { tune: (_id: string, t: ActionTuning) => { tunings.push(t); return () => {}; } };
    const values = createToolOptionValues();
    const active = { active: 'c' as string | null };
    tuneToolOptions(registry, depsOf(values, active) as never, [
      defineTool({ id: 'b', options: OPTIONS }), defineTool({ id: 'c', options: OPTIONS }),
    ]);
    // The operation reads its params while `c` is active; the user then switches tools and adjusts it.
    for (const t of tunings) (t.params as () => Record<string, unknown>)();
    active.active = 'select';
    for (const t of tunings) t.keep!({ radiusPx: 30 });
    expect(values.get('b')).toEqual({});
    expect(values.get('c')).toEqual({ radiusPx: 30 });
  });
});
