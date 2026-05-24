import { describe, it, expect, vi } from 'vitest';
import {
  makeToolOffhandAction,
  buildToolOffhandBindings,
  TOOL_OFFHAND_ID,
} from './toolOffhand';

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
