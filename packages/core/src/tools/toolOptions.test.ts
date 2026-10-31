import { describe, expect, it, vi } from 'vitest';
import { createToolOptionValues, defineTool, type ActionTuning, type ToolOptions } from '@weasel-js/routing';
import { tuneToolOptions } from './toolOptions';

const OPTIONS: ToolOptions = {
  actionId: 'brush',
  prefs: {
    name: 'Brush', description: '',
    children: { radiusPx: { kind: 'number', name: 'Size', description: '', default: 40 } },
  },
};

describe('tuneToolOptions', () => {
  it("tunes each tool's action with the values the toolOptionValues dep holds, read per invocation", () => {
    const tunings = new Map<string, ActionTuning>();
    const release = vi.fn();
    const registry = { tune: (id: string, t: ActionTuning) => { tunings.set(id, t); return release; } };
    const values = createToolOptionValues();
    const deps = { get: (name: string) => (name === 'toolOptionValues' ? values : undefined) };
    const tools = [defineTool({ id: 'b', options: OPTIONS }), defineTool({ id: 'plain' })];
    const done = tuneToolOptions(registry, deps as never, tools);
    expect([...tunings.keys()]).toEqual(['brush']);
    const params = tunings.get('brush')!.params as () => Record<string, unknown>;
    // Nothing held: the action's own default, or another tuning, stands.
    expect(params()).toEqual({});
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
    const deps = { get: (name: string) => (name === 'toolOptionValues' ? values : undefined) };
    tuneToolOptions(registry, deps as never, [defineTool({ id: 'b', options: OPTIONS })]);
    const tuning = tunings.get('brush')!;
    // The default already: nothing to write. Not an option: never written.
    tuning.keep!({ radiusPx: 40, strength: 0.2 });
    expect(set).not.toHaveBeenCalled();
    tuning.keep!({ radiusPx: 60 });
    expect(values.get('b')).toEqual({ radiusPx: 60 });
    expect((tuning.params as () => Record<string, unknown>)()).toEqual({ radiusPx: 60 });
  });
});
