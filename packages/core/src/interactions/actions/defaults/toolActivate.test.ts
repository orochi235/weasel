import { describe, it, expect, vi } from 'vitest';
import {
  makeToolActivateAction,
  buildToolActivateBindings,
  TOOL_ACTIVATE_ID,
} from './toolActivate';

describe('makeToolActivateAction', () => {
  it('produces a single action with id `tool.activate`', () => {
    const a = makeToolActivateAction([]);
    expect(a.id).toBe(TOOL_ACTIVATE_ID);
    expect(a.id).toBe('tool.activate');
  });

  it('carries the supplied bindings as defaultBinding', () => {
    const bindings = buildToolActivateBindings([
      { toolId: 'rect', keyOpts: { key: 'R' } },
      { toolId: 'ellipse', keyOpts: { key: 'E' } },
    ]);
    const a = makeToolActivateAction(bindings);
    expect(Array.isArray(a.defaultBinding)).toBe(true);
    const arr = a.defaultBinding as unknown as Array<{ opts: { params: { toolId: string } } }>;
    expect(arr).toHaveLength(2);
    expect(arr[0].opts.params.toolId).toBe('rect');
    expect(arr[1].opts.params.toolId).toBe('ellipse');
  });

  it('has hotkey scope so it beats active-tool bindings', () => {
    const a = makeToolActivateAction([]);
    expect(a.scope).toBe('hotkey');
  });

  it('has requires: [activeTool]', () => {
    const a = makeToolActivateAction([]);
    expect((a as { requires?: string[] }).requires).toEqual(['activeTool']);
  });

  it('run calls activeTool.setActive with params.toolId', () => {
    const setActive = vi.fn();
    const activeTool = {
      active: 'select',
      hotkeyStack: [],
      setActive,
      pushHotkey: () => {},
      popHotkey: () => {},
    };
    const action = makeToolActivateAction([]);
    if (!action.invoker || action.invoker.timing !== 'immediate') {
      throw new Error('Expected immediate invoker');
    }
    action.invoker.run({ activeTool } as never, { toolId: 'rect' });
    expect(setActive).toHaveBeenCalledWith('rect');
  });

  it('has timing immediate', () => {
    const a = makeToolActivateAction([]);
    expect(a.invoker?.timing).toBe('immediate');
  });

  it('run is a no-op when activeTool is absent from deps', () => {
    const action = makeToolActivateAction([]);
    if (!action.invoker || action.invoker.timing !== 'immediate') {
      throw new Error('Expected immediate invoker');
    }
    expect(() => {
      if (action.invoker?.timing !== 'immediate') throw new Error('not immediate');
      action.invoker.run({} as never, { toolId: 'rect' });
    }).not.toThrow();
  });

  it('run is a no-op when params.toolId is missing', () => {
    const setActive = vi.fn();
    const activeTool = {
      active: 'select',
      hotkeyStack: [],
      setActive,
      pushHotkey: () => {},
      popHotkey: () => {},
    };
    const action = makeToolActivateAction([]);
    if (!action.invoker || action.invoker.timing !== 'immediate') {
      throw new Error('Expected immediate invoker');
    }
    action.invoker.run({ activeTool } as never, undefined);
    expect(setActive).not.toHaveBeenCalled();
  });
});

describe('buildToolActivateBindings', () => {
  it('produces one BoundGesture per spec with params.toolId set', () => {
    const bindings = buildToolActivateBindings([
      { toolId: 'rect', keyOpts: { key: 'R' } },
      { toolId: 'hand', keyOpts: { key: 'H' } },
    ]);
    expect(bindings).toHaveLength(2);
    const first = bindings[0] as { spec: { kind: string; key: string }; opts: { params: { toolId: string } } };
    expect(first.spec.kind).toBe('key');
    expect(first.spec.key).toBe('R');
    expect(first.opts.params.toolId).toBe('rect');
  });

  it('puts modifier flags under `mods`, where the matcher reads them', () => {
    // They used to be spread flat onto the spec, with an `as never` cast
    // hiding the mismatch. `matchModifiers` only looks at `spec.mods`, and
    // treats an absent modifier as "must NOT be held" — so a modifier-
    // qualified shortcut could never match. It went unnoticed while
    // `useKeybindings` matched keys itself in a document listener.
    const bindings = buildToolActivateBindings([
      { toolId: 'rect', keyOpts: { key: 'R', mod: true, shift: 'optional' } },
    ]);
    const first = bindings[0] as {
      spec: { mods?: { mod?: boolean; shift?: boolean | 'optional' } };
    };
    expect(first.spec.mods).toEqual({ mod: true, shift: 'optional' });
  });

  it('omits `mods` entirely for an unmodified key', () => {
    const bindings = buildToolActivateBindings([{ toolId: 'rect', keyOpts: { key: 'R' } }]);
    expect((bindings[0] as unknown as { spec: Record<string, unknown> }).spec).not.toHaveProperty('mods');
  });
});
