import { describe, it, expect, vi } from 'vitest';
import { createDispatcher } from './dispatcher';
import type { Action } from '../actions/action';
import type { InputEvent } from './matcher';
import type { InvocationCtx } from '../actions/invoker';
import {
  makeRegistry,
  makeCtx,
  immediateAction,
  ongoingAction,
  keyAEvent,
} from './testing/dispatcherStubs';

/**
 * `ctx.world` and `ctx.screen` are two different spaces, and for a long time
 * both were filled from the same event field — so `screen` was never screen.
 * Only an ongoing invoker is handed the ctx; an immediate one gets deps and
 * params, which is why these bind `drag` and `click` to an ongoing action.
 */
describe('invocation coordinates', () => {
  const noMods = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };

  function ctxFor(spec: Action['defaultBinding'], event: InputEvent): InvocationCtx {
    const start = vi.fn().mockReturnValue({ onMove: vi.fn(), onEnd: vi.fn() });
    const dispatcher = createDispatcher();
    dispatcher.handleInput(event, makeCtx({ actions: makeRegistry([ongoingAction('probe', spec, start)]) }));
    expect(start).toHaveBeenCalledOnce();
    return start.mock.calls[0][0] as InvocationCtx;
  }

  it('fills ctx.screen from the event\u2019s client point, not its world point', () => {
    const ctx = ctxFor(
      { kind: 'drag' },
      { kind: 'pointerdown', x: 50, y: 60, clientX: 150, clientY: 160, ...noMods },
    );
    expect(ctx.world).toEqual({ x: 50, y: 60 });
    expect(ctx.screen).toEqual({ x: 150, y: 160 });
  });

  it('leaves ctx.screen unset when the event carries no client point', () => {
    const ctx = ctxFor(
      { kind: 'drag' },
      { kind: 'pointerdown', x: 50, y: 60, ...noMods },
    );
    expect(ctx.world).toEqual({ x: 50, y: 60 });
    expect(ctx.screen).toBeUndefined();
  });

  it('gives a click\u2019s ctx the click\u2019s own world point', () => {
    const ctx = ctxFor(
      { kind: 'click' },
      { kind: 'click', x: 3, y: 4, press: { x: 1, y: 2 }, ...noMods },
    );
    expect(ctx.world).toEqual({ x: 3, y: 4 });
  });

  // Placing a menu at the pointer is the canonical use for `ctx.screen`, and
  // for a while the click family declared no client coords at all — so the one
  // kind that needs it was the one kind that could never read it.
  it.each(['click', 'doubleclick', 'contextmenu'] as const)(
    'fills ctx.screen for a %s',
    (kind) => {
      const ctx = ctxFor(
        { kind: kind === 'doubleclick' ? 'doubleClick' : kind === 'contextmenu' ? 'contextMenu' : 'click' },
        { kind, x: 3, y: 4, clientX: 103, clientY: 104, ...noMods },
      );
      expect(ctx.world).toEqual({ x: 3, y: 4 });
      expect(ctx.screen).toEqual({ x: 103, y: 104 });
    },
  );
});

describe('enabled() sees where the event landed', () => {
  const noMods = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };
  const click: InputEvent = { kind: 'click', x: 3, y: 4, press: { x: 1, y: 2 }, ...noMods };

  it('hands a click’s world point to the gate', () => {
    const enabled = vi.fn().mockReturnValue(true);
    const action: Action = { ...immediateAction('probe', 'x'), defaultBinding: { kind: 'click' }, enabled };
    createDispatcher().handleInput(click, makeCtx({ actions: makeRegistry([action]) }));
    expect(enabled.mock.calls[0][1]).toEqual({ x: 3, y: 4 });
  });

  it('hands a press its world point', () => {
    const enabled = vi.fn().mockReturnValue(true);
    const action: Action = { ...ongoingAction('probe', { kind: 'drag' }), enabled };
    createDispatcher().handleInput(
      { kind: 'pointerdown', x: 50, y: 60, ...noMods },
      makeCtx({ actions: makeRegistry([action]) }),
    );
    expect(enabled.mock.calls[0][1]).toEqual({ x: 50, y: 60 });
  });

  it('passes no point for an event that has none', () => {
    const enabled = vi.fn().mockReturnValue(true);
    const action: Action = { ...immediateAction('probe', 'a'), enabled };
    createDispatcher().handleInput(keyAEvent, makeCtx({ actions: makeRegistry([action]) }));
    expect(enabled.mock.calls[0][1]).toBeUndefined();
  });

  it('falls through to the next binding when the gate refuses that point', () => {
    const near = vi.fn();
    const far = vi.fn();
    const onlyNearOrigin: Action = {
      id: 'near',
      label: 'near',
      defaultBinding: { kind: 'click', mods: { alt: true } },
      enabled: (_deps, at) => (at && Math.hypot(at.x, at.y) < 2 ? true : 'not-applicable'),
      invoker: { timing: 'immediate', run: near },
    };
    const fallback: Action = {
      id: 'far',
      label: 'far',
      defaultBinding: { kind: 'click', mods: { alt: true } },
      invoker: { timing: 'immediate', run: far },
    };
    const ctx = makeCtx({ actions: makeRegistry([onlyNearOrigin, fallback]) });
    const altClick = (x: number, y: number): InputEvent =>
      ({ kind: 'click', x, y, ...noMods, altKey: true });
    const dispatcher = createDispatcher();
    dispatcher.handleInput(altClick(3, 4), ctx);
    expect(near).not.toHaveBeenCalled();
    expect(far).toHaveBeenCalledOnce();
    dispatcher.handleInput(altClick(1, 0), ctx);
    expect(near).toHaveBeenCalledOnce();
    // Prediction runs the same gate at the same point.
    expect(dispatcher.resolveOnly(altClick(3, 4), ctx)?.actionId).toBe('far');
    expect(dispatcher.resolveOnly(altClick(1, 0), ctx)?.actionId).toBe('near');
  });

  it('hands a wheel its world point, and its immediate invoker the same point as `world`', () => {
    const enabled = vi.fn().mockReturnValue(true);
    const run = vi.fn();
    const action: Action = {
      id: 'probe', label: 'probe', defaultBinding: { kind: 'wheel' }, enabled, invoker: { timing: 'immediate', run },
    };
    createDispatcher().handleInput(
      { kind: 'wheel', deltaX: 0, deltaY: 5, clientX: 10, clientY: 20, x: 7, y: 8, ...noMods },
      makeCtx({ actions: makeRegistry([action]) }),
    );
    expect(enabled.mock.calls[0][1]).toEqual({ x: 7, y: 8 });
    expect(run.mock.calls[0][1]).toMatchObject({ world: { x: 7, y: 8 }, deltaY: 5 });
  });
});
