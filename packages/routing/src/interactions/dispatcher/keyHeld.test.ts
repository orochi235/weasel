/**
 * Invariant tests for keyHeld engagement — channel-phase advancement on
 * hold/release, sticky engagement under mid-hold modifier presses, mid-hold
 * modifier hot-swap of [engaged] routes, and independent simultaneous holds
 * on different keys.
 */

import { describe, it, expect, vi } from 'vitest';
import { createDispatcher } from './dispatcher';
import type { DispatcherContext } from './dispatcher';
import type { ActionsRegistry } from '../actions/registry';
import type { Action } from '../actions/action';
import type { DepRegistry } from '../actions/depRegistry';
import type { Tool } from '../../tools/types';
import type { InputEvent } from './matcher';

function makeRegistry(actions: Action[]): ActionsRegistry {
  const map = new Map(actions.map((a) => [a.id, a]));
  return {
    register: vi.fn().mockReturnValue(() => {}),
    unregister: vi.fn(),
    mute: vi.fn().mockReturnValue(() => {}),
    tune: vi.fn().mockReturnValue(() => {}),
    paramsOf: (_id: string, given?: Record<string, unknown>) => ({ ...given }),
    list: () => Array.from(map.values()),
    trigger: vi.fn().mockReturnValue(false),
    preview: vi.fn(() => () => {}),
    subscribe: vi.fn().mockReturnValue(() => {}),
    begin: vi.fn().mockReturnValue(null),
    setDispatcher: vi.fn(),
    activate: vi.fn(),
    isActive: () => true,
    holdsKeys: () => true,
    dropKeys: () => {},
  };
}

function makeDepRegistry(deps: Record<string, unknown> = {}): DepRegistry {
  return {
    register: vi.fn().mockReturnValue(() => {}),
    get: vi.fn((name: string) => deps[name]) as DepRegistry['get'],
  };
}

function makeCtx(
  overrides: Partial<DispatcherContext> & { actions: ActionsRegistry },
): DispatcherContext {
  return {
    depRegistry: makeDepRegistry(),
    activeToolId: 'select',
    hotkeyStack: [],
    entriesById: new Map(),
    isMac: false,
    ...overrides,
  };
}

/** Build a tool with the given bindings registered in a entriesById map. */
function makeTool(
  toolId: string,
  bindings: Tool['bindings'],
): { tool: Tool; entriesById: Map<string, Tool> } {
  const tool: Tool = { id: toolId, eligibility: { focus: true }, bindings };
  return { tool, entriesById: new Map([[toolId, tool]]) };
}

/** Minimal ongoing action. The default mock returns a non-empty handle so the
 *  dispatcher records it as engaged — an empty `{}` falls through to the next
 *  match. */
function ongoingAction(
  id: string,
  spec: Action['defaultBinding'],
  startFn = vi.fn().mockReturnValue({ onEnd: () => {} }),
): Action {
  return {
    id,
    label: id,
    defaultBinding: spec,
    invoker: { timing: 'ongoing', start: startFn },
  };
}

/** Minimal immediate action. */
function immediateAction(id: string, spec: Action['defaultBinding'], run = vi.fn()): Action {
  return {
    id,
    label: id,
    defaultBinding: spec,
    invoker: { timing: 'immediate', run },
  };
}

/** Synthesise a key-held down event. */
function keyHeldDown(
  key: string,
  mods: Partial<{ altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }> = {},
): InputEvent {
  return {
    kind: 'key-held',
    key,
    phase: 'down',
    altKey: mods.altKey ?? false,
    ctrlKey: mods.ctrlKey ?? false,
    metaKey: mods.metaKey ?? false,
    shiftKey: mods.shiftKey ?? false,
  };
}

/** Synthesise a key-held up event. */
function keyHeldUp(key: string): InputEvent {
  return {
    kind: 'key-held',
    key,
    phase: 'up',
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
  };
}

/** A keydown event (kind: 'key') for modifier tracking tests. */
function keyDown(
  key: string,
  mods: Partial<{ altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }> = {},
): InputEvent {
  return {
    kind: 'key',
    key,
    altKey: mods.altKey ?? false,
    ctrlKey: mods.ctrlKey ?? false,
    metaKey: mods.metaKey ?? false,
    shiftKey: mods.shiftKey ?? false,
  };
}

/** A pointerdown event. */
function pointerDown(
  mods: Partial<{ shiftKey: boolean }> = {},
): InputEvent {
  return {
    kind: 'pointerdown',
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: mods.shiftKey ?? false,
  };
}


describe('keyHeld engagement', () => {
  it('advancing channel: [initial] keyHeld starts an ongoing handle; [engaged] route fires during hold', () => {
    const engagedRun = vi.fn();
    // Non-empty handle so the dispatcher records the engagement.
    const engageStart = vi.fn().mockReturnValue({ onEnd: () => {} });

    const engageAction = ongoingAction('space-held', {
      kind: 'key-held',
      key: ' ',
      phase: 'initial',
    }, engageStart);

    const engagedKeyAction = immediateAction('engaged-key', {
      kind: 'key',
      key: 'x',
      phase: 'engaged',
    }, engagedRun);

    const registry = makeRegistry([engageAction, engagedKeyAction]);
    const { entriesById } = makeTool('myTool', [
      { spec: { kind: 'key-held', key: ' ', phase: 'initial' }, actionId: 'space-held' },
      { spec: { kind: 'key', key: 'x', phase: 'engaged' }, actionId: 'engaged-key' },
    ]);

    const dispatcher = createDispatcher();
    const ctx = makeCtx({ actions: registry, activeToolId: 'myTool', entriesById });

    // Before keydown — 'x' with [engaged] phase should NOT fire.
    const preResult = dispatcher.handleInput(keyDown('x'), ctx);
    expect(preResult).toBe('unhandled');
    expect(engagedRun).not.toHaveBeenCalled();

    // Keydown(Space) — engages the channel.
    const downResult = dispatcher.handleInput(keyHeldDown(' '), ctx);
    expect(downResult).toBe('handled');
    expect(engageStart).toHaveBeenCalledOnce();

    // Now the [engaged] route should fire.
    const engagedResult = dispatcher.handleInput(keyDown('x'), ctx);
    expect(engagedResult).toBe('handled');
    expect(engagedRun).toHaveBeenCalledOnce();
  });

  it('disengage restores channel: [engaged] route no longer fires after keyup', () => {
    const engagedRun = vi.fn();
    const onEnd = vi.fn();
    const engageStart = vi.fn().mockReturnValue({ onEnd });

    const engageAction = ongoingAction('space-held', {
      kind: 'key-held',
      key: ' ',
      phase: 'initial',
    }, engageStart);

    const engagedKeyAction = immediateAction('engaged-key', {
      kind: 'key',
      key: 'x',
      phase: 'engaged',
    }, engagedRun);

    const registry = makeRegistry([engageAction, engagedKeyAction]);
    const { entriesById } = makeTool('myTool', [
      { spec: { kind: 'key-held', key: ' ', phase: 'initial' }, actionId: 'space-held' },
      { spec: { kind: 'key', key: 'x', phase: 'engaged' }, actionId: 'engaged-key' },
    ]);

    const dispatcher = createDispatcher();
    const ctx = makeCtx({ actions: registry, activeToolId: 'myTool', entriesById });

    // Engage.
    dispatcher.handleInput(keyHeldDown(' '), ctx);
    expect(dispatcher.inFlight().size).toBe(1);

    // Disengage.
    dispatcher.handleInput(keyHeldUp(' '), ctx);
    expect(onEnd).toHaveBeenCalledWith(expect.anything(), 'commit');
    expect(dispatcher.inFlight().size).toBe(0);

    // Channel restored — [engaged] route should no longer fire.
    engagedRun.mockClear();
    const postResult = dispatcher.handleInput(keyDown('x'), ctx);
    expect(postResult).toBe('unhandled');
    expect(engagedRun).not.toHaveBeenCalled();
  });

  it('[engaged] click route fires during the hold window', () => {
    const clickRun = vi.fn();
    const engageStart = vi.fn().mockReturnValue({ onEnd: () => {} });

    const engageAction = ongoingAction('space-held', {
      kind: 'key-held',
      key: ' ',
      phase: 'initial',
    }, engageStart);

    const clickAction = immediateAction('engaged-click', {
      kind: 'click',
      phase: 'engaged',
    }, clickRun);

    const registry = makeRegistry([engageAction, clickAction]);
    const { entriesById } = makeTool('myTool', [
      { spec: { kind: 'key-held', key: ' ', phase: 'initial' }, actionId: 'space-held' },
      { spec: { kind: 'click', phase: 'engaged' }, actionId: 'engaged-click' },
    ]);

    const clickEvent: InputEvent = {
      kind: 'click',
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
    };

    const dispatcher = createDispatcher();
    const ctx = makeCtx({ actions: registry, activeToolId: 'myTool', entriesById });

    // Click before hold — should not fire.
    expect(dispatcher.handleInput(clickEvent, ctx)).toBe('unhandled');
    expect(clickRun).not.toHaveBeenCalled();

    // Hold Space.
    dispatcher.handleInput(keyHeldDown(' '), ctx);

    // Click during hold — should fire.
    expect(dispatcher.handleInput(clickEvent, ctx)).toBe('handled');
    expect(clickRun).toHaveBeenCalledOnce();

    // Release Space.
    dispatcher.handleInput(keyHeldUp(' '), ctx);

    // Click after hold — should not fire again.
    clickRun.mockClear();
    expect(dispatcher.handleInput(clickEvent, ctx)).toBe('unhandled');
    expect(clickRun).not.toHaveBeenCalled();
  });

  it('sticky engagement: Shift press mid-hold does not end the hold', () => {
    const onEnd = vi.fn();
    const engageStart = vi.fn().mockReturnValue({ onEnd });
    const engagedRun = vi.fn();

    const engageAction = ongoingAction('space-held', {
      kind: 'key-held',
      key: ' ',
      phase: 'initial',
    }, engageStart);

    // An [engaged] route to verify hold is still active after Shift press.
    const engagedAction = immediateAction('engaged-action', {
      kind: 'key',
      key: 'z',
      phase: 'engaged',
    }, engagedRun);

    const registry = makeRegistry([engageAction, engagedAction]);
    const { entriesById } = makeTool('myTool', [
      { spec: { kind: 'key-held', key: ' ', phase: 'initial' }, actionId: 'space-held' },
      { spec: { kind: 'key', key: 'z', phase: 'engaged' }, actionId: 'engaged-action' },
    ]);

    const dispatcher = createDispatcher();
    const ctx = makeCtx({ actions: registry, activeToolId: 'myTool', entriesById });

    // Engage Space.
    dispatcher.handleInput(keyHeldDown(' '), ctx);
    expect(dispatcher.inFlight().size).toBe(1);

    // Press Shift mid-hold (a modifier key — should not end the hold).
    // Modifier keys produce `kind: 'key'` events, not `kind: 'key-held'`,
    // so they don't trigger the keyHeld up-pump.
    dispatcher.handleInput(keyDown('Shift', { shiftKey: true }), ctx);

    // Hold is still active — onEnd not called.
    expect(onEnd).not.toHaveBeenCalled();
    expect(dispatcher.inFlight().size).toBe(1);

    // Only releasing Space ends it.
    dispatcher.handleInput(keyHeldUp(' '), ctx);
    expect(onEnd).toHaveBeenCalledWith(expect.anything(), 'commit');
    expect(dispatcher.inFlight().size).toBe(0);
  });

  it('mid-hold modifier hot-swap: different [engaged] routes match with/without shift', () => {
    const dragNoShiftStart = vi.fn().mockReturnValue({ onEnd: () => {} });
    const dragShiftStart = vi.fn().mockReturnValue({ onEnd: () => {} });
    const engageStart = vi.fn().mockReturnValue({ onEnd: () => {} });

    const engageAction = ongoingAction('space-held', {
      kind: 'key-held',
      key: ' ',
      phase: 'initial',
    }, engageStart);

    // [engaged] drag, no shift.
    const dragNoShift = ongoingAction('engaged-drag', {
      kind: 'drag',
      phase: 'engaged',
    }, dragNoShiftStart);

    // [engaged] drag +shift.
    const dragShift = ongoingAction('engaged-drag-shift', {
      kind: 'drag',
      mods: { shift: true },
      phase: 'engaged',
    }, dragShiftStart);

    const registry = makeRegistry([engageAction, dragNoShift, dragShift]);
    const { entriesById } = makeTool('myTool', [
      { spec: { kind: 'key-held', key: ' ', phase: 'initial' }, actionId: 'space-held' },
      { spec: { kind: 'drag', phase: 'engaged' }, actionId: 'engaged-drag' },
      { spec: { kind: 'drag', mods: { shift: true }, phase: 'engaged' }, actionId: 'engaged-drag-shift' },
    ]);

    const dispatcher = createDispatcher();
    const ctx = makeCtx({ actions: registry, activeToolId: 'myTool', entriesById });

    // Engage Space.
    dispatcher.handleInput(keyHeldDown(' '), ctx);

    // First pointerdown — no shift → no-shift drag route.
    dispatcher.handleInput(pointerDown(), ctx);
    expect(dragNoShiftStart).toHaveBeenCalledOnce();
    expect(dragShiftStart).not.toHaveBeenCalled();

    // End that drag.
    dispatcher.handleInput({ kind: 'pointerup', x: 0, y: 0, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false }, ctx);

    // Second pointerdown — with shift → shift drag route.
    dispatcher.handleInput(pointerDown({ shiftKey: true }), ctx);
    expect(dragNoShiftStart).toHaveBeenCalledOnce(); // still only 1 from before
    expect(dragShiftStart).toHaveBeenCalledOnce();

    // Two in-flight handles: the space-held ongoing AND the new shift-drag.
    // Both are alive simultaneously — the hold is sticky.
    expect(dispatcher.inFlight().size).toBe(2);
  });

  it('one held key engages one tool when two bind it, and its release frees that tool', () => {
    const aStart = vi.fn().mockReturnValue({ onEnd: () => {} });
    const bStart = vi.fn().mockReturnValue({ onEnd: () => {} });
    const aEngagedRun = vi.fn();
    const bEngagedRun = vi.fn();

    const channel = (id: string, phase: 'initial' | 'engaged') => [{ channel: id, phase }];
    const registry = makeRegistry([
      ongoingAction('a-held', { kind: 'key-held', key: ' ', phase: channel('toolA', 'initial') }, aStart),
      ongoingAction('b-held', { kind: 'key-held', key: ' ', phase: channel('toolB', 'initial') }, bStart),
      immediateAction('a-engaged', { kind: 'key', key: 'z', phase: channel('toolA', 'engaged') }, aEngagedRun),
      immediateAction('b-engaged', { kind: 'key', key: 'q', phase: channel('toolB', 'engaged') }, bEngagedRun),
    ]);
    const toolOf = (id: string, held: string, engaged: string, key: string): Tool => ({
      id,
      eligibility: { focus: true },
      bindings: [
        { spec: { kind: 'key-held', key: ' ', phase: channel(id, 'initial') }, actionId: held },
        { spec: { kind: 'key', key, phase: channel(id, 'engaged') }, actionId: engaged },
      ],
    });
    const entriesById = new Map([
      ['toolA', toolOf('toolA', 'a-held', 'a-engaged', 'z')],
      ['toolB', toolOf('toolB', 'b-held', 'b-engaged', 'q')],
    ]);
    const dispatcher = createDispatcher();
    const ctx = makeCtx({ actions: registry, activeToolId: 'toolA', hotkeyStack: ['toolB'], entriesById });

    dispatcher.handleInput(keyHeldDown(' '), ctx);
    // An autorepeat keydown must not hand the slot to the other tool.
    dispatcher.handleInput(keyHeldDown(' '), ctx);
    expect(aStart.mock.calls.length + bStart.mock.calls.length).toBe(1);
    const [winnerRun, loserRun, winnerKey, loserKey] = aStart.mock.calls.length === 1
      ? [aEngagedRun, bEngagedRun, 'z', 'q']
      : [bEngagedRun, aEngagedRun, 'q', 'z'];

    expect(dispatcher.handleInput(keyDown(winnerKey), ctx)).toBe('handled');
    expect(winnerRun).toHaveBeenCalledOnce();
    expect(dispatcher.handleInput(keyDown(loserKey), ctx)).toBe('unhandled');
    expect(loserRun).not.toHaveBeenCalled();

    expect(dispatcher.handleInput(keyHeldUp(' '), ctx)).toBe('handled');
    expect(dispatcher.inFlight().size).toBe(0);
    expect(dispatcher.handleInput(keyDown(winnerKey), ctx)).toBe('unhandled');
    expect(winnerRun).toHaveBeenCalledOnce();
  });

  it('two held keys produce independent channel engagements', () => {
    const spaceEngagedRun = vi.fn();
    const aEngagedRun = vi.fn();
    const spaceStart = vi.fn().mockReturnValue({ onEnd: () => {} });
    const aStart = vi.fn().mockReturnValue({ onEnd: () => {} });

    // Tool A: holds Space → [engaged] 'z' fires.
    const spaceHeld = ongoingAction('space-held', {
      kind: 'key-held',
      key: ' ',
      phase: 'initial',
    }, spaceStart);

    const spaceEngaged = immediateAction('space-engaged', {
      kind: 'key',
      key: 'z',
      phase: 'engaged',
    }, spaceEngagedRun);

    // Tool B: holds 'a' → [engaged] 'z' also fires (different channel).
    // Use the same 'z' key but routed via tool B's channel.
    const aHeld = ongoingAction('a-held', {
      kind: 'key-held',
      key: 'a',
      phase: [{ channel: 'toolB', phase: 'initial' }],
    }, aStart);

    const aEngaged = immediateAction('a-engaged', {
      kind: 'key',
      key: 'q',
      phase: [{ channel: 'toolB', phase: 'engaged' }],
    }, aEngagedRun);

    const registry = makeRegistry([spaceHeld, spaceEngaged, aHeld, aEngaged]);

    const toolA: Tool = {
      id: 'toolA',
      eligibility: { focus: true },
      bindings: [
        { spec: { kind: 'key-held', key: ' ', phase: 'initial' }, actionId: 'space-held' },
        { spec: { kind: 'key', key: 'z', phase: 'engaged' }, actionId: 'space-engaged' },
      ],
    };
    const toolB: Tool = {
      id: 'toolB',
      eligibility: { focus: true },
      bindings: [
        { spec: { kind: 'key-held', key: 'a', phase: [{ channel: 'toolB', phase: 'initial' }] }, actionId: 'a-held' },
        { spec: { kind: 'key', key: 'q', phase: [{ channel: 'toolB', phase: 'engaged' }] }, actionId: 'a-engaged' },
      ],
    };
    const entriesById = new Map([['toolA', toolA], ['toolB', toolB]]);

    const dispatcher = createDispatcher();

    // Both tools active simultaneously (toolA is active, toolB on hotkey stack).
    const ctx = makeCtx({
      actions: registry,
      activeToolId: 'toolA',
      hotkeyStack: ['toolB'],
      entriesById,
    });

    // Engage toolA by holding Space.
    dispatcher.handleInput(keyHeldDown(' '), ctx);
    expect(spaceStart).toHaveBeenCalledOnce();

    // Engage toolB by holding 'a'.
    dispatcher.handleInput(keyHeldDown('a'), ctx);
    expect(aStart).toHaveBeenCalledOnce();

    // Both channels engaged. Space-engaged route (z) should fire.
    expect(dispatcher.handleInput(keyDown('z'), ctx)).toBe('handled');
    expect(spaceEngagedRun).toHaveBeenCalledOnce();

    // a-engaged route (q) should fire.
    expect(dispatcher.handleInput(keyDown('q'), ctx)).toBe('handled');
    expect(aEngagedRun).toHaveBeenCalledOnce();

    // Release Space — toolA disengages. a-engaged still live.
    dispatcher.handleInput(keyHeldUp(' '), ctx);
    expect(dispatcher.inFlight().size).toBe(1); // only the 'a' hold remains

    // Space-engaged route (z) no longer fires.
    spaceEngagedRun.mockClear();
    expect(dispatcher.handleInput(keyDown('z'), ctx)).toBe('unhandled');
    expect(spaceEngagedRun).not.toHaveBeenCalled();

    // a-engaged still fires.
    aEngagedRun.mockClear();
    expect(dispatcher.handleInput(keyDown('q'), ctx)).toBe('handled');
    expect(aEngagedRun).toHaveBeenCalledOnce();

    // Release 'a' — toolB disengages.
    dispatcher.handleInput(keyHeldUp('a'), ctx);
    expect(dispatcher.inFlight().size).toBe(0);
  });
});

