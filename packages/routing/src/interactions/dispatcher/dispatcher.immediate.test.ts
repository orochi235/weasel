import { describe, it, expect, vi } from 'vitest';
import { createDispatcher } from './dispatcher';
import type { Action } from '../actions/action';
import type { Tool } from '../../tools/types';
import type { InputEvent } from './matcher';
import {
  makeRegistry,
  makeDepRegistry,
  makeCtx,
  immediateAction,
  keyAEvent,
} from './testing/dispatcherStubs';

const keyBEvent: InputEvent = {
  kind: 'key',
  key: 'b',
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
};

// ---------------------------------------------------------------------------
// describe createDispatcher
// ---------------------------------------------------------------------------

describe('createDispatcher', () => {
  describe('immediate dispatch', () => {
    it('fires matching action and returns "handled"', () => {
      const run = vi.fn();
      const action = immediateAction('actionA', 'a', run);
      const registry = makeRegistry([action]);
      const dispatcher = createDispatcher();

      const result = dispatcher.handleInput(keyAEvent, makeCtx({ actions: registry }));
      expect(result).toBe('handled');
      expect(run).toHaveBeenCalledOnce();
    });

    it('walks on to the next match when run() returns "pass", and is unhandled when every one passes', () => {
      const passing = vi.fn().mockReturnValue('pass');
      const next = vi.fn();
      const dispatcher = createDispatcher();
      const both = makeRegistry([immediateAction('passer', 'a', passing), immediateAction('taker', 'a', next)]);
      expect(dispatcher.handleInput(keyAEvent, makeCtx({ actions: both }))).toBe('handled');
      expect(passing).toHaveBeenCalledOnce();
      expect(next).toHaveBeenCalledOnce();

      const alone = makeRegistry([immediateAction('passer', 'a', passing)]);
      expect(dispatcher.handleInput(keyAEvent, makeCtx({ actions: alone }))).toBe('unhandled');
    });

    it('returns "unhandled" when no binding matches', () => {
      const action = immediateAction('actionA', 'a');
      const registry = makeRegistry([action]);
      const dispatcher = createDispatcher();

      const result = dispatcher.handleInput(keyBEvent, makeCtx({ actions: registry }));
      expect(result).toBe('unhandled');
    });

    it('returns "unhandled" when matched action enabled() returns disabled', () => {
      const run = vi.fn();
      const action: Action = {
        ...immediateAction('actionA', 'a', run),
        enabled: () => 'selection-required' as const,
      };
      const registry = makeRegistry([action]);
      const dispatcher = createDispatcher();

      const result = dispatcher.handleInput(keyAEvent, makeCtx({ actions: registry }));
      expect(result).toBe('unhandled');
      expect(run).not.toHaveBeenCalled();
    });

    it('passes deps to the enabled() gate (deps-aware action gates on its dep)', () => {
      // Regression: the gate previously called `enabled()` with no args, so a
      // deps-aware predicate always saw `undefined` deps and a selection-gated
      // action (reorder/duplicate/flip/nudge/setFill/escape-fallthrough) could
      // never dispatch via the keyboard.
      const run = vi.fn();
      // `selection` is a dep core merges into `DepSchema`; routing alone declares only `activeTool`.
      const action = {
        id: 'actionA',
        label: 'A',
        defaultBinding: { kind: 'key', key: 'a' } as const,
        requires: ['selection'],
        enabled: (deps?: { selection?: unknown[] }): true | 'selection-required' =>
          deps?.selection?.length ? true : 'selection-required',
        invoker: { timing: 'immediate' as const, run },
      } as unknown as Action;
      const registry = makeRegistry([action]);
      const dispatcher = createDispatcher();

      // Empty selection → gate disabled → unhandled, run not called.
      const empty = makeDepRegistry({ selection: [] });
      expect(
        dispatcher.handleInput(keyAEvent, makeCtx({ actions: registry, depRegistry: empty })),
      ).toBe('unhandled');
      expect(run).not.toHaveBeenCalled();

      // Non-empty selection → gate enabled → handled, run called.
      const filled = makeDepRegistry({ selection: ['item1'] });
      expect(
        dispatcher.handleInput(keyAEvent, makeCtx({ actions: registry, depRegistry: filled })),
      ).toBe('handled');
      expect(run).toHaveBeenCalledOnce();
    });

    it('passes deps from depRegistry to invoker.run', () => {
      const run = vi.fn();
      const action = {
        id: 'actionA',
        label: 'A',
        defaultBinding: { kind: 'key', key: 'a' } as const,
        requires: ['selection'],
        invoker: { timing: 'immediate' as const, run },
        run,
      } as unknown as Action;
      const depRegistry = makeDepRegistry({ selection: ['item1'] });
      const registry = makeRegistry([action]);
      const dispatcher = createDispatcher();

      dispatcher.handleInput(keyAEvent, makeCtx({ actions: registry, depRegistry }));
      // Second arg is opts.params — undefined for a bare GestureSpec binding.
      expect(run).toHaveBeenCalledWith(
        expect.objectContaining({ selection: ['item1'] }),
        undefined,
      );
    });
  });

  describe('error paths', () => {
    it('action lookup miss warns and returns "unhandled"', () => {
      // Tool has a binding pointing to a non-existent action.
      const registry = makeRegistry([]); // no actions
      const activeTool: Tool = {
        id: 'myTool',
        eligibility: { focus: true },
        bindings: [{ spec: { kind: 'key', key: 'a' }, actionId: 'nonexistent' }],
      };
      const entriesById = new Map([['myTool', activeTool]]);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const dispatcher = createDispatcher();

      const result = dispatcher.handleInput(
        keyAEvent,
        makeCtx({ actions: registry, activeToolId: 'myTool', entriesById }),
      );

      expect(result).toBe('unhandled');
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('parametric bindings (BoundGesture[])', () => {
    /** Build an immediate action whose defaultBinding is a BoundGesture[]
     *  with two entries, each carrying distinct params. */
    function parametricAction(id: string, run = vi.fn()): Action {
      return {
        id,
        label: id,
        defaultBinding: [
          { spec: { kind: 'key', key: 'a' }, opts: { params: { x: 1 } } },
          { spec: { kind: 'key', key: 'b' }, opts: { params: { x: 2 } } },
        ],
        invoker: { timing: 'immediate', run },
      };
    }

    it('when binding A matches, invoker.run receives params { x: 1 }', () => {
      const run = vi.fn();
      const action = parametricAction('paramAction', run);
      const registry = makeRegistry([action]);
      const dispatcher = createDispatcher();

      dispatcher.handleInput(keyAEvent, makeCtx({ actions: registry }));
      expect(run).toHaveBeenCalledOnce();
      // Second arg to run() is the params object.
      expect(run.mock.calls[0][1]).toEqual({ x: 1 });
    });

    it('when binding B matches, invoker.run receives params { x: 2 }', () => {
      const run = vi.fn();
      const action = parametricAction('paramAction', run);
      const registry = makeRegistry([action]);
      const dispatcher = createDispatcher();

      dispatcher.handleInput(keyBEvent, makeCtx({ actions: registry }));
      expect(run).toHaveBeenCalledOnce();
      expect(run.mock.calls[0][1]).toEqual({ x: 2 });
    });

    it('bare GestureSpec entry in array (no opts) passes undefined params', () => {
      const run = vi.fn();
      const action: Action = {
        id: 'mixedAction',
        label: 'mixed',
        // Array with one bare GestureSpec (no opts) and one BoundGesture.
        defaultBinding: [
          { kind: 'key', key: 'a' },
          { spec: { kind: 'key', key: 'b' }, opts: { params: { x: 99 } } },
        ],
        invoker: { timing: 'immediate', run },
      };
      const registry = makeRegistry([action]);
      const dispatcher = createDispatcher();

      // Binding A is a bare spec — params should be undefined.
      dispatcher.handleInput(keyAEvent, makeCtx({ actions: registry }));
      expect(run).toHaveBeenCalledOnce();
      expect(run.mock.calls[0][1]).toBeUndefined();
    });
  });
});

describe('immediate params for affordance-carrying kinds', () => {
  const noMods = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };
  const affordance = { kind: 'layer:weasel-hud' };

  function paramsFor(spec: Action['defaultBinding'], event: InputEvent): Record<string, unknown> {
    const run = vi.fn();
    const action: Action = {
      id: 'probe', label: 'probe', defaultBinding: spec,
      invoker: { timing: 'immediate', run },
    };
    const dispatcher = createDispatcher();
    dispatcher.handleInput(event, makeCtx({ actions: makeRegistry([action]) }));
    expect(run).toHaveBeenCalledOnce();
    return run.mock.calls[0][1] as Record<string, unknown>;
  }

  it('a contextmenu invoker sees world coords and the affordance', () => {
    const params = paramsFor(
      { kind: 'contextMenu' },
      { kind: 'contextmenu', x: 3, y: 4, affordance, ...noMods },
    );
    expect(params).toMatchObject({ world: { x: 3, y: 4 }, affordance });
  });

  it('a longpress invoker sees world coords and the affordance', () => {
    const params = paramsFor(
      { kind: 'longPress' },
      { kind: 'longpress', x: 3, y: 4, affordance, ...noMods },
    );
    expect(params).toMatchObject({ world: { x: 3, y: 4 }, affordance });
  });

  it('a wheel invoker sees the affordance alongside the deltas', () => {
    const params = paramsFor(
      { kind: 'wheel', direction: 'down' },
      { kind: 'wheel', deltaX: 0, deltaY: 10, clientX: 1, clientY: 2, affordance, ...noMods },
    );
    expect(params).toMatchObject({ deltaX: 0, deltaY: 10, clientX: 1, clientY: 2, affordance });
  });

  it('a pinch invoker sees the scale step, rotation, focal point and affordance', () => {
    const params = paramsFor(
      { kind: 'pinch' },
      { kind: 'pinch', scale: 1.5, rotation: 3, clientX: 1, clientY: 2, affordance, ...noMods },
    );
    expect(params).toMatchObject({ scale: 1.5, rotation: 3, clientX: 1, clientY: 2, affordance });
  });

  it('a doubleclick invoker sees the affordance', () => {
    const params = paramsFor(
      { kind: 'doubleClick' },
      { kind: 'doubleclick', x: 3, y: 4, affordance, ...noMods },
    );
    expect(params).toMatchObject({ world: { x: 3, y: 4 }, affordance });
  });

  it('a click invoker keeps its press point', () => {
    const params = paramsFor(
      { kind: 'click' },
      { kind: 'click', x: 3, y: 4, press: { x: 1, y: 2 }, affordance, ...noMods },
    );
    expect(params).toMatchObject({ world: { x: 3, y: 4 }, press: { x: 1, y: 2 }, affordance });
  });
});
