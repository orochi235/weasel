import { describe, it, expect, vi } from 'vitest';
import { makeToolHoldAction } from './toolHold';

describe('makeToolHoldAction', () => {
  it('produces an Action with the right id and timing', () => {
    const action = makeToolHoldAction('hand', ' ');
    expect(action.id).toBe('tool.hold.hand');
    expect(action.invoker).toBeDefined();
    expect(action.invoker?.timing).toBe('ongoing');
  });

  it('defaultBinding is a key-held spec with the right key', () => {
    const action = makeToolHoldAction('hand', ' ');
    expect(action.defaultBinding).toEqual({ kind: 'key-held', key: ' ' });
  });

  it('start pushes the toolId; onEnd pops it', () => {
    const pushSpy = vi.fn();
    const popSpy = vi.fn();
    const activeTool = {
      active: 'select',
      hotkeyStack: [],
      setActive: () => {},
      pushHotkey: pushSpy,
      popHotkey: popSpy,
    };
    const action = makeToolHoldAction('hand', ' ');
    if (!action.invoker || action.invoker.timing !== 'ongoing') throw new Error();
    const handle = action.invoker.start(
      { deps: { activeTool }, world: { x: 0, y: 0 }, screen: { x: 0, y: 0 }, modifiers: { alt: false, ctrl: false, meta: false, shift: false } } as any,
      undefined,
    );
    expect(pushSpy).toHaveBeenCalledWith('hand');
    expect(popSpy).not.toHaveBeenCalled();
    handle.onEnd?.({} as any, 'commit');
    expect(popSpy).toHaveBeenCalledTimes(1);
  });

  it('start is a no-op when activeTool dep is missing', () => {
    const action = makeToolHoldAction('hand', ' ');
    if (!action.invoker || action.invoker.timing !== 'ongoing') throw new Error();
    const handle = action.invoker.start({ deps: {} } as any, undefined);
    expect(handle).toEqual({});  // empty handle, no onEnd
  });

  it('different toolIds produce independent actions', () => {
    const handAction = makeToolHoldAction('hand', ' ');
    const eyedropAction = makeToolHoldAction('eyedropper', 'i');
    expect(handAction.id).not.toBe(eyedropAction.id);
  });

  it('also supports key arrays', () => {
    const action = makeToolHoldAction('hand', [' ', 'Spacebar']);
    expect(action.defaultBinding).toEqual({ kind: 'key-held', key: [' ', 'Spacebar'] });
  });
});
