/**
 * Tests for the pure dispatcher orchestrator.
 *
 * All stubs are inline — no React, no DOM, no real registry imports.
 */

import { describe, it, expect, vi } from 'vitest';
import { createDispatcher } from './dispatcher';
import type { DispatcherContext } from './dispatcher';
import type { ActionsRegistry, Action } from '../actions/registry';
import type { DepRegistry } from '../actions/depRegistry';
import type { Tool } from '../../tools/types';
import type { InputEvent } from './matcher';

// ---------------------------------------------------------------------------
// Test helpers / stubs
// ---------------------------------------------------------------------------

function makeRegistry(actions: Action[]): ActionsRegistry {
  const map = new Map(actions.map((a) => [a.id, a]));
  return {
    register: vi.fn().mockReturnValue(() => {}),
    unregister: vi.fn(),
    list: () => Array.from(map.values()),
    trigger: vi.fn().mockReturnValue(false),
    subscribe: vi.fn().mockReturnValue(() => {}),
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
    toolsById: new Map(),
    isMac: false,
    ...overrides,
  };
}

/** A minimal immediate action. */
function immediateAction(id: string, gestureKey: string, run = vi.fn()): Action {
  return {
    id,
    label: id,
    defaultBinding: { kind: 'key', key: gestureKey },
    invoker: { timing: 'immediate', run },
  };
}

/** Key-held ongoing action (pointerdown also supported via kind override). */
function ongoingAction(
  id: string,
  spec: Action['defaultBinding'],
  startFn = vi.fn().mockReturnValue({}),
): Action {
  return {
    id,
    label: id,
    defaultBinding: spec,
    invoker: { timing: 'ongoing', start: startFn },
  };
}

const keyAEvent: InputEvent = {
  kind: 'key',
  key: 'a',
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
};

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

    it('passes deps from depRegistry to invoker.run', () => {
      const run = vi.fn();
      // `requires` is a Phase 4 field not yet on Action's type; cast to add it.
      const action = {
        id: 'actionA',
        label: 'A',
        defaultBinding: { kind: 'key', key: 'a' } as const,
        requires: ['selection'],
        invoker: { timing: 'immediate' as const, run },
        run,
      } as Action & { requires: string[] };
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

  describe('scope assembly + precedence', () => {
    it('walks actions registry for ambient bindings', () => {
      const run = vi.fn();
      const action = immediateAction('actionA', 'a', run);
      const registry = makeRegistry([action]);
      const dispatcher = createDispatcher();

      dispatcher.handleInput(keyAEvent, makeCtx({ actions: registry }));
      expect(run).toHaveBeenCalledOnce();
    });

    it('active tool bindings beat ambient on same spec', () => {
      const ambientRun = vi.fn();
      const activeRun = vi.fn();

      const ambientAction = immediateAction('ambient', 'a', ambientRun);
      const activeAction = immediateAction('active', 'a', activeRun);

      const registry = makeRegistry([ambientAction, activeAction]);

      const activeTool: Tool = {
        id: 'myTool',
        bindings: [{ spec: { kind: 'key', key: 'a' }, actionId: 'active' }],
      };
      const toolsById = new Map([['myTool', activeTool]]);

      const dispatcher = createDispatcher();
      const result = dispatcher.handleInput(
        keyAEvent,
        makeCtx({ actions: registry, activeToolId: 'myTool', toolsById }),
      );

      expect(result).toBe('handled');
      expect(activeRun).toHaveBeenCalledOnce();
      expect(ambientRun).not.toHaveBeenCalled();
    });

    it('hotkey-stack bindings beat active on same spec', () => {
      const activeRun = vi.fn();
      const hotkeyRun = vi.fn();

      const activeAction = immediateAction('active', 'a', activeRun);
      const hotkeyAction = immediateAction('hotkey-action', 'a', hotkeyRun);

      const registry = makeRegistry([activeAction, hotkeyAction]);

      const activeTool: Tool = {
        id: 'myTool',
        bindings: [{ spec: { kind: 'key', key: 'a' }, actionId: 'active' }],
      };
      const hotkeyTool: Tool = {
        id: 'hotkeyTool',
        bindings: [{ spec: { kind: 'key', key: 'a' }, actionId: 'hotkey-action' }],
      };
      const toolsById = new Map([
        ['myTool', activeTool],
        ['hotkeyTool', hotkeyTool],
      ]);

      const dispatcher = createDispatcher();
      const result = dispatcher.handleInput(
        keyAEvent,
        makeCtx({
          actions: registry,
          activeToolId: 'myTool',
          hotkeyStack: ['hotkeyTool'],
          toolsById,
        }),
      );

      expect(result).toBe('handled');
      expect(hotkeyRun).toHaveBeenCalledOnce();
      expect(activeRun).not.toHaveBeenCalled();
    });

    it('toolsById lookup for active tool when present', () => {
      const activeRun = vi.fn();
      const activeAction = immediateAction('active', 'a', activeRun);
      const registry = makeRegistry([activeAction]);

      const activeTool: Tool = {
        id: 'myTool',
        bindings: [{ spec: { kind: 'key', key: 'a' }, actionId: 'active' }],
      };
      const toolsById = new Map([['myTool', activeTool]]);

      const dispatcher = createDispatcher();
      dispatcher.handleInput(
        keyAEvent,
        makeCtx({ actions: registry, activeToolId: 'myTool', toolsById }),
      );
      expect(activeRun).toHaveBeenCalledOnce();
    });

    it("Action.scope:'hotkey' bindings beat active-tool bindings on the same spec", () => {
      const activeRun = vi.fn();
      const hotkeyRun = vi.fn();

      // Active tool binds 'a' to its own action.
      const activeAction = immediateAction('active.a', 'a', activeRun);
      // Registry has a hotkey-scope action also bound to 'a'.
      const hotkeyAction: Action = {
        ...immediateAction('hotkey.a', 'a', hotkeyRun),
        scope: 'hotkey',
      };

      const registry = makeRegistry([activeAction, hotkeyAction]);
      const activeTool: Tool = {
        id: 'editor',
        bindings: [{ spec: { kind: 'key', key: 'a' }, actionId: 'active.a' }],
      };
      const toolsById = new Map([['editor', activeTool]]);
      const dispatcher = createDispatcher();
      const ctx = makeCtx({ actions: registry, activeToolId: 'editor', toolsById });

      expect(dispatcher.handleInput(keyAEvent, ctx)).toBe('handled');
      expect(hotkeyRun).toHaveBeenCalledOnce();
      expect(activeRun).not.toHaveBeenCalled();
    });
  });

  describe('ongoing dispatch', () => {
    it('pointerdown calls invoker.start and stores OngoingHandle', () => {
      const handle = { onMove: vi.fn(), onEnd: vi.fn() };
      const startFn = vi.fn().mockReturnValue(handle);
      const action = ongoingAction('drag-action', { kind: 'drag' }, startFn);
      const registry = makeRegistry([action]);
      const dispatcher = createDispatcher();

      const pointerdownEvent: InputEvent = {
        kind: 'pointerdown',
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      };

      const result = dispatcher.handleInput(pointerdownEvent, makeCtx({ actions: registry }));
      expect(result).toBe('handled');
      expect(startFn).toHaveBeenCalledOnce();
    });

    it('inFlight() shows the active handle', () => {
      const handle = { onMove: vi.fn(), onEnd: vi.fn() };
      const startFn = vi.fn().mockReturnValue(handle);
      const action = ongoingAction('drag-action', { kind: 'drag' }, startFn);
      const registry = makeRegistry([action]);
      const dispatcher = createDispatcher();

      const pointerdownEvent: InputEvent = {
        kind: 'pointerdown',
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      };

      dispatcher.handleInput(pointerdownEvent, makeCtx({ actions: registry }));
      expect(dispatcher.inFlight().size).toBe(1);
    });

    it('cancelAll calls onEnd("cancel") on every handle and clears map', () => {
      const handle = { onEnd: vi.fn() };
      const startFn = vi.fn().mockReturnValue(handle);
      const action = ongoingAction('drag-action', { kind: 'drag' }, startFn);
      const registry = makeRegistry([action]);
      const dispatcher = createDispatcher();

      const pointerdownEvent: InputEvent = {
        kind: 'pointerdown',
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      };

      dispatcher.handleInput(pointerdownEvent, makeCtx({ actions: registry }));
      expect(dispatcher.inFlight().size).toBe(1);

      dispatcher.cancelAll('cancel');
      expect(handle.onEnd).toHaveBeenCalledWith(expect.anything(), 'cancel');
      expect(dispatcher.inFlight().size).toBe(0);
    });

    describe('getActiveGesture', () => {
      it('returns { kind: null, id: null } when nothing in flight', () => {
        const dispatcher = createDispatcher();
        expect(dispatcher.getActiveGesture()).toEqual({ kind: null, id: null });
      });

      it("reports the in-flight handle's kind and the internal gestureId", () => {
        const handle = { kind: 'marquee', onMove: vi.fn(), onEnd: vi.fn() };
        const startFn = vi.fn().mockReturnValue(handle);
        const action = ongoingAction('marquee-action', { kind: 'drag' }, startFn);
        const registry = makeRegistry([action]);
        const dispatcher = createDispatcher();

        dispatcher.handleInput(
          { kind: 'pointerdown', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false },
          makeCtx({ actions: registry }),
        );
        expect(dispatcher.getActiveGesture()).toEqual({ kind: 'marquee', id: 'pointer-mouse' });
      });

      it('reports kind: null when the in-flight handle did not declare one', () => {
        const handle = { onMove: vi.fn(), onEnd: vi.fn() };
        const startFn = vi.fn().mockReturnValue(handle);
        const action = ongoingAction('anon-action', { kind: 'drag' }, startFn);
        const registry = makeRegistry([action]);
        const dispatcher = createDispatcher();

        dispatcher.handleInput(
          { kind: 'pointerdown', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false },
          makeCtx({ actions: registry }),
        );
        expect(dispatcher.getActiveGesture()).toEqual({ kind: null, id: 'pointer-mouse' });
      });

      it('clears after pointerup', () => {
        const handle = { kind: 'marquee', onMove: vi.fn(), onEnd: vi.fn() };
        const startFn = vi.fn().mockReturnValue(handle);
        const action = ongoingAction('marquee-action', { kind: 'drag' }, startFn);
        const registry = makeRegistry([action]);
        const dispatcher = createDispatcher();
        const ctx = makeCtx({ actions: registry });

        dispatcher.handleInput(
          { kind: 'pointerdown', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false },
          ctx,
        );
        dispatcher.handleInput(
          { kind: 'pointerup', x: 0, y: 0, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false },
          ctx,
        );
        expect(dispatcher.getActiveGesture()).toEqual({ kind: null, id: null });
      });
    });

    it('key-held down starts a handle; up calls onEnd("commit") and clears', () => {
      const handle = { onEnd: vi.fn() };
      const startFn = vi.fn().mockReturnValue(handle);
      const action = ongoingAction('space-held', { kind: 'key-held', key: ' ' }, startFn);
      const registry = makeRegistry([action]);
      const dispatcher = createDispatcher();

      const downEvent: InputEvent = {
        kind: 'key-held',
        key: ' ',
        phase: 'down',
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      };
      const upEvent: InputEvent = {
        kind: 'key-held',
        key: ' ',
        phase: 'up',
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      };

      const ctx = makeCtx({ actions: registry });
      dispatcher.handleInput(downEvent, ctx);
      expect(dispatcher.inFlight().size).toBe(1);
      expect(startFn).toHaveBeenCalledOnce();

      dispatcher.handleInput(upEvent, ctx);
      expect(handle.onEnd).toHaveBeenCalledWith(expect.anything(), 'commit');
      expect(dispatcher.inFlight().size).toBe(0);
    });
  });

  describe('error paths', () => {
    it('action lookup miss warns and returns "unhandled"', () => {
      // Tool has a binding pointing to a non-existent action.
      const registry = makeRegistry([]); // no actions
      const activeTool: Tool = {
        id: 'myTool',
        bindings: [{ spec: { kind: 'key', key: 'a' }, actionId: 'nonexistent' }],
      };
      const toolsById = new Map([['myTool', activeTool]]);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const dispatcher = createDispatcher();

      const result = dispatcher.handleInput(
        keyAEvent,
        makeCtx({ actions: registry, activeToolId: 'myTool', toolsById }),
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

  describe('specificity-ordered fall-through', () => {
    it('falls through to lower-precedence binding when higher action is disabled', () => {
      const activeRun = vi.fn();
      const ambientRun = vi.fn();

      // Higher-specificity (active-scope) action: disabled.
      const activeAction: Action = {
        ...immediateAction('active', 'a', activeRun),
        enabled: () => 'selection-required' as const,
      };
      // Lower-specificity (ambient-scope) action: enabled (default).
      const ambientAction = immediateAction('ambient', 'a', ambientRun);

      const registry = makeRegistry([activeAction, ambientAction]);

      const activeTool: Tool = {
        id: 'myTool',
        bindings: [{ spec: { kind: 'key', key: 'a' }, actionId: 'active' }],
      };
      const toolsById = new Map([['myTool', activeTool]]);

      const dispatcher = createDispatcher();
      const result = dispatcher.handleInput(
        keyAEvent,
        makeCtx({ actions: registry, activeToolId: 'myTool', toolsById }),
      );

      expect(result).toBe('handled');
      expect(activeRun).not.toHaveBeenCalled();
      expect(ambientRun).toHaveBeenCalledOnce();
    });

    it('returns "unhandled" when every matching action is disabled', () => {
      const activeRun = vi.fn();
      const ambientRun = vi.fn();

      const activeAction: Action = {
        ...immediateAction('active', 'a', activeRun),
        enabled: () => 'selection-required' as const,
      };
      const ambientAction: Action = {
        ...immediateAction('ambient', 'a', ambientRun),
        enabled: () => 'scene-empty' as const,
      };

      const registry = makeRegistry([activeAction, ambientAction]);
      const activeTool: Tool = {
        id: 'myTool',
        bindings: [{ spec: { kind: 'key', key: 'a' }, actionId: 'active' }],
      };
      const toolsById = new Map([['myTool', activeTool]]);

      const dispatcher = createDispatcher();
      const result = dispatcher.handleInput(
        keyAEvent,
        makeCtx({ actions: registry, activeToolId: 'myTool', toolsById }),
      );

      expect(result).toBe('unhandled');
      expect(activeRun).not.toHaveBeenCalled();
      expect(ambientRun).not.toHaveBeenCalled();
    });

    it('falls through past missing actionId to next match', () => {
      const ambientRun = vi.fn();
      const ambientAction = immediateAction('ambient', 'a', ambientRun);

      const registry = makeRegistry([ambientAction]);
      const activeTool: Tool = {
        id: 'myTool',
        // References an actionId that doesn't exist in the registry.
        bindings: [{ spec: { kind: 'key', key: 'a' }, actionId: 'ghost' }],
      };
      const toolsById = new Map([['myTool', activeTool]]);

      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const dispatcher = createDispatcher();
      const result = dispatcher.handleInput(
        keyAEvent,
        makeCtx({ actions: registry, activeToolId: 'myTool', toolsById }),
      );

      expect(result).toBe('handled');
      expect(ambientRun).toHaveBeenCalledOnce();
      warn.mockRestore();
    });

    it('stops at the first enabled action (does not invoke later candidates)', () => {
      const activeRun = vi.fn();
      const ambientRun = vi.fn();

      // Both enabled — higher precedence must win exclusively.
      const activeAction = immediateAction('active', 'a', activeRun);
      const ambientAction = immediateAction('ambient', 'a', ambientRun);

      const registry = makeRegistry([activeAction, ambientAction]);
      const activeTool: Tool = {
        id: 'myTool',
        bindings: [{ spec: { kind: 'key', key: 'a' }, actionId: 'active' }],
      };
      const toolsById = new Map([['myTool', activeTool]]);

      const dispatcher = createDispatcher();
      dispatcher.handleInput(
        keyAEvent,
        makeCtx({ actions: registry, activeToolId: 'myTool', toolsById }),
      );

      expect(activeRun).toHaveBeenCalledOnce();
      expect(ambientRun).not.toHaveBeenCalled();
    });
  });
});
