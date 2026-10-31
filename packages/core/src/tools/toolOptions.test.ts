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
    expect(params()).toEqual({ radiusPx: 40 });
    values.set('b', 'radiusPx', 25);
    expect(params()).toEqual({ radiusPx: 25 });
    done();
    expect(release).toHaveBeenCalledTimes(1);
  });
});
