import { describe, it, expect, vi } from 'vitest';
import { matchModifiers, type ModifiersEvent } from '@weasel-js/gestures';
import { makeToolOffhandAction, buildToolOffhandBindings, heldKeySpec, offhandKeyFor, TOOL_OFFHAND_ID } from '@weasel-js/routing';

describe('makeToolOffhandAction', () => {
  it("declares scope:'hotkey' so the offhand action beats the active tool", () => {
    const a = makeToolOffhandAction([]);
    expect(a.scope).toBe('hotkey');
  });

  it('produces a single Action with id `tool.offhand` and ongoing timing', () => {
    const action = makeToolOffhandAction([]);
    expect(action.id).toBe(TOOL_OFFHAND_ID);
    expect(action.id).toBe('tool.offhand');
    expect(action.invoker).toBeDefined();
    expect(action.invoker?.timing).toBe('ongoing');
  });

  it('carries the supplied bindings as defaultBinding', () => {
    const bindings = buildToolOffhandBindings([
      { toolId: 'hand', key: ' ' },
      { toolId: 'eyedropper', key: 'i' },
    ]);
    const action = makeToolOffhandAction(bindings);
    expect(Array.isArray(action.defaultBinding)).toBe(true);
    const arr = action.defaultBinding as unknown as Array<{
      spec: { kind: string; key: string | string[] };
      opts: { params: { toolId: string } };
    }>;
    expect(arr).toHaveLength(2);
    expect(arr[0].spec).toMatchObject({ kind: 'key-held', key: ' ' });
    expect(arr[0].opts.params.toolId).toBe('hand');
    expect(arr[1].opts.params.toolId).toBe('eyedropper');
  });

  it('start reads params.toolId, pushes it; onEnd pops', () => {
    const pushSpy = vi.fn();
    const popSpy = vi.fn();
    const activeTool = {
      active: 'select',
      hotkeyStack: [],
      setActive: () => {},
      pushHotkey: pushSpy,
      popHotkey: popSpy,
    };
    const action = makeToolOffhandAction([]);
    if (!action.invoker || action.invoker.timing !== 'ongoing') throw new Error();
    const handle = action.invoker.start(
      {
        deps: { activeTool },
        world: { x: 0, y: 0 },
        screen: { x: 0, y: 0 },
        modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      } as never,
      { params: { toolId: 'hand' } },
    );
    expect(pushSpy).toHaveBeenCalledWith('hand');
    expect(popSpy).not.toHaveBeenCalled();
    handle.onEnd?.({} as never, 'commit');
    expect(popSpy).toHaveBeenCalledTimes(1);
  });

  it('start resolves thunk-form params at call time', () => {
    const pushSpy = vi.fn();
    const activeTool = {
      active: 'select', hotkeyStack: [], setActive: () => {},
      pushHotkey: pushSpy, popHotkey: () => {},
    };
    const action = makeToolOffhandAction([]);
    if (!action.invoker || action.invoker.timing !== 'ongoing') throw new Error();
    action.invoker.start(
      { deps: { activeTool } } as never,
      { params: () => ({ toolId: 'eyedropper' }) },
    );
    expect(pushSpy).toHaveBeenCalledWith('eyedropper');
  });

  it('start is a no-op when activeTool dep is missing', () => {
    const action = makeToolOffhandAction([]);
    if (!action.invoker || action.invoker.timing !== 'ongoing') throw new Error();
    const handle = action.invoker.start({ deps: {} } as never, { params: { toolId: 'hand' } });
    expect(handle).toEqual({});
  });

  it('start is a no-op when params.toolId is missing', () => {
    const pushSpy = vi.fn();
    const activeTool = {
      active: 'select', hotkeyStack: [], setActive: () => {},
      pushHotkey: pushSpy, popHotkey: () => {},
    };
    const action = makeToolOffhandAction([]);
    if (!action.invoker || action.invoker.timing !== 'ongoing') throw new Error();
    const handle = action.invoker.start({ deps: { activeTool } } as never, undefined);
    expect(handle).toEqual({});
    expect(pushSpy).not.toHaveBeenCalled();
  });
});

describe('buildToolOffhandBindings', () => {
  it('produces one key-held BoundGesture per spec with params.toolId set', () => {
    const bindings = buildToolOffhandBindings([
      { toolId: 'hand', key: ' ' },
      { toolId: 'eyedropper', key: 'i' },
    ]);
    expect(bindings).toHaveLength(2);
    const first = bindings[0] as { spec: { kind: string; key: string }; opts: { params: { toolId: string } } };
    expect(first.spec.kind).toBe('key-held');
    expect(first.spec.key).toBe(' ');
    expect(first.opts.params.toolId).toBe('hand');
  });

  it('supports key arrays', () => {
    const bindings = buildToolOffhandBindings([
      { toolId: 'hand', key: [' ', 'Spacebar'] },
    ]);
    const first = bindings[0] as { spec: { key: string | string[] } };
    expect(first.spec.key).toEqual([' ', 'Spacebar']);
  });
});

describe('heldKeySpec', () => {
  const ANY = { alt: 'optional', ctrl: 'optional', meta: 'optional', shift: 'optional' };

  it('leaves every modifier optional for a modifier key', () => {
    expect(heldKeySpec('Shift')).toEqual({ kind: 'key-held', key: 'Shift', mods: ANY });
    expect(heldKeySpec(['z', 'Alt'])).toEqual({ kind: 'key-held', key: ['z', 'Alt'], mods: ANY });
  });

  it('lets any other key engage with Shift or Alt held, and not with Cmd or Ctrl', () => {
    const spec = heldKeySpec(' ');
    expect(spec).toEqual({ kind: 'key-held', key: ' ', mods: { alt: 'optional', shift: 'optional' } });
    const held = (down: Partial<ModifiersEvent>): boolean =>
      matchModifiers({ altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, ...down }, spec.mods, true);
    expect(held({})).toBe(true);
    expect(held({ shiftKey: true })).toBe(true);
    expect(held({ altKey: true })).toBe(true);
    expect(held({ metaKey: true })).toBe(false);
    expect(held({ ctrlKey: true })).toBe(false);
  });

  it('is the spec an offhand binding carries, gated to between gestures', () => {
    const [binding] = buildToolOffhandBindings([{ toolId: 'eyedropper', key: 'Alt' }]);
    expect((binding as { spec: unknown }).spec)
      .toEqual({ ...heldKeySpec('Alt'), phase: [{ channel: '*', phase: 'initial' }] });
  });
});

describe('offhandKeyFor', () => {
  it('maps the named triggers to their DOM key names', () => {
    expect(['space', 'alt', 'ctrl', 'meta', 'shift'].map(offhandKeyFor))
      .toEqual([' ', 'Alt', 'Control', 'Meta', 'Shift']);
  });

  it('passes any other key through as the key it names', () => {
    expect(offhandKeyFor('o')).toBe('o');
    expect(offhandKeyFor('F2')).toBe('F2');
  });
});
