import { describe, it, expect, vi } from 'vitest';
import { createDispatcher } from './dispatcher';
import type { DispatcherContext } from './dispatcher';
import type { Action } from '../actions/action';
import type { Tool } from '../../tools/types';
import type { InputEvent } from './matcher';
import type { InvocationCtx } from '../actions/invoker';
import {
  makeRegistry,
  makeCtx,
  immediateAction,
  keyAEvent,
} from './testing/dispatcherStubs';

// ---------------------------------------------------------------------------
// describe createDispatcher
// ---------------------------------------------------------------------------

describe('createDispatcher', () => {

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
        eligibility: { focus: true },
        bindings: [{ spec: { kind: 'key', key: 'a' }, actionId: 'active' }],
      };
      const entriesById = new Map([['myTool', activeTool]]);

      const dispatcher = createDispatcher();
      const result = dispatcher.handleInput(
        keyAEvent,
        makeCtx({ actions: registry, activeToolId: 'myTool', entriesById }),
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
        eligibility: { focus: true },
        bindings: [{ spec: { kind: 'key', key: 'a' }, actionId: 'active' }],
      };
      const hotkeyTool: Tool = {
        id: 'hotkeyTool',
        eligibility: { focus: true },
        bindings: [{ spec: { kind: 'key', key: 'a' }, actionId: 'hotkey-action' }],
      };
      const entriesById = new Map([
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
          entriesById,
        }),
      );

      expect(result).toBe('handled');
      expect(hotkeyRun).toHaveBeenCalledOnce();
      expect(activeRun).not.toHaveBeenCalled();
    });

    it('entriesById lookup for active tool when present', () => {
      const activeRun = vi.fn();
      const activeAction = immediateAction('active', 'a', activeRun);
      const registry = makeRegistry([activeAction]);

      const activeTool: Tool = {
        id: 'myTool',
        eligibility: { focus: true },
        bindings: [{ spec: { kind: 'key', key: 'a' }, actionId: 'active' }],
      };
      const entriesById = new Map([['myTool', activeTool]]);

      const dispatcher = createDispatcher();
      dispatcher.handleInput(
        keyAEvent,
        makeCtx({ actions: registry, activeToolId: 'myTool', entriesById }),
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
        eligibility: { focus: true },
        bindings: [{ spec: { kind: 'key', key: 'a' }, actionId: 'active.a' }],
      };
      const entriesById = new Map([['editor', activeTool]]);
      const dispatcher = createDispatcher();
      const ctx = makeCtx({ actions: registry, activeToolId: 'editor', entriesById });

      expect(dispatcher.handleInput(keyAEvent, ctx)).toBe('handled');
      expect(hotkeyRun).toHaveBeenCalledOnce();
      expect(activeRun).not.toHaveBeenCalled();
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
        eligibility: { focus: true },
        bindings: [{ spec: { kind: 'key', key: 'a' }, actionId: 'active' }],
      };
      const entriesById = new Map([['myTool', activeTool]]);

      const dispatcher = createDispatcher();
      const result = dispatcher.handleInput(
        keyAEvent,
        makeCtx({ actions: registry, activeToolId: 'myTool', entriesById }),
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
        eligibility: { focus: true },
        bindings: [{ spec: { kind: 'key', key: 'a' }, actionId: 'active' }],
      };
      const entriesById = new Map([['myTool', activeTool]]);

      const dispatcher = createDispatcher();
      const result = dispatcher.handleInput(
        keyAEvent,
        makeCtx({ actions: registry, activeToolId: 'myTool', entriesById }),
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
        eligibility: { focus: true },
        // References an actionId that doesn't exist in the registry.
        bindings: [{ spec: { kind: 'key', key: 'a' }, actionId: 'ghost' }],
      };
      const entriesById = new Map([['myTool', activeTool]]);

      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const dispatcher = createDispatcher();
      const result = dispatcher.handleInput(
        keyAEvent,
        makeCtx({ actions: registry, activeToolId: 'myTool', entriesById }),
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
        eligibility: { focus: true },
        bindings: [{ spec: { kind: 'key', key: 'a' }, actionId: 'active' }],
      };
      const entriesById = new Map([['myTool', activeTool]]);

      const dispatcher = createDispatcher();
      dispatcher.handleInput(
        keyAEvent,
        makeCtx({ actions: registry, activeToolId: 'myTool', entriesById }),
      );

      expect(activeRun).toHaveBeenCalledOnce();
      expect(ambientRun).not.toHaveBeenCalled();
    });
  });
});

describe('view-scoped bindings', () => {
  const noMods = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };
  const down: InputEvent = { kind: 'pointerdown', x: 5, y: 6, ...noMods };
  const ruleCtx = {
    focused: true, selection: [], multiActive: false,
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    action: { kind: null, id: null }, hover: null, mode: 'normal',
    allowedCapabilities: new Set<string>(),
  } as unknown as NonNullable<ReturnType<NonNullable<DispatcherContext['getRuleCtx']>>>;

  /** A `mini`-scoped ambient drag, and the active tool's own unscoped drag. */
  function setup() {
    const miniStart = vi.fn().mockReturnValue({ onMove: vi.fn(), onEnd: vi.fn() });
    const toolStart = vi.fn().mockReturnValue({ onMove: vi.fn(), onEnd: vi.fn() });
    const registry = makeRegistry([
      { id: 'mini.pan', label: 'mini', invoker: { timing: 'ongoing', start: miniStart } },
      { id: 'tool.drag', label: 'tool', invoker: { timing: 'ongoing', start: toolStart } },
    ]);
    const mini: Tool = {
      id: 'mini',
      eligibility: { always: true },
      bindings: [{ spec: { kind: 'drag' }, actionId: 'mini.pan', opts: { views: ['mini'] } }],
    };
    const tool: Tool = {
      id: 'select',
      eligibility: { focus: true },
      bindings: [{ spec: { kind: 'drag' }, actionId: 'tool.drag' }],
    };
    const entriesById = new Map([['mini', mini], ['select', tool]]);
    return { registry, entriesById, miniStart, toolStart };
  }

  it('is not live for input routed to another view', () => {
    const { registry, entriesById, miniStart } = setup();
    const onlyMini = new Map([['mini', entriesById.get('mini')!]]);
    const result = createDispatcher().handleInput(
      down, makeCtx({ actions: registry, entriesById: onlyMini, viewId: null }),
    );
    expect(result).toBe('unhandled');
    expect(miniStart).not.toHaveBeenCalled();
  });

  it('outranks an active-tier binding for input in the view it names', () => {
    const { registry, entriesById, miniStart, toolStart } = setup();
    createDispatcher().handleInput(down, makeCtx({ actions: registry, entriesById, viewId: 'mini' }));
    expect(miniStart).toHaveBeenCalledOnce();
    expect(toolStart).not.toHaveBeenCalled();
  });

  it('hands the routed view to the invoker', () => {
    const { registry, entriesById, miniStart } = setup();
    createDispatcher().handleInput(down, makeCtx({ actions: registry, entriesById, viewId: 'mini' }));
    expect((miniStart.mock.calls[0][0] as InvocationCtx).viewId).toBe('mini');
  });

  it('keeps a binding naming the view ahead of a context-gated one that does not', () => {
    const miniStart = vi.fn().mockReturnValue({ onMove: vi.fn(), onEnd: vi.fn() });
    const gatedStart = vi.fn().mockReturnValue({ onMove: vi.fn(), onEnd: vi.fn() });
    const registry = makeRegistry([
      { id: 'mini.pan', label: 'mini', invoker: { timing: 'ongoing', start: miniStart } },
      {
        id: 'gated', label: 'gated', defaultBinding: { kind: 'drag' },
        eligible: { mode: 'normal' },
        invoker: { timing: 'ongoing', start: gatedStart },
      },
    ]);
    const mini: Tool = {
      id: 'mini',
      eligibility: { always: true },
      bindings: [{ spec: { kind: 'drag' }, actionId: 'mini.pan', opts: { views: ['mini'] } }],
    };
    createDispatcher().handleInput(down, makeCtx({
      actions: registry, entriesById: new Map([['mini', mini]]), getRuleCtx: () => ruleCtx, viewId: 'mini',
    }));
    expect(miniStart).toHaveBeenCalledOnce();
    expect(gatedStart).not.toHaveBeenCalled();
  });

  it('hands the routed view to an eligibility rule', () => {
    const seen: (string | null | undefined)[] = [];
    const start = vi.fn().mockReturnValue({ onMove: vi.fn(), onEnd: vi.fn() });
    const registry = makeRegistry([{
      id: 'probe', label: 'probe',
      defaultBinding: { kind: 'drag' },
      eligible: { when: (c) => { seen.push(c.viewId); return c.viewId === 'mini'; } },
      invoker: { timing: 'ongoing', start },
    }]);
    const d = createDispatcher();
    d.handleInput(down, makeCtx({ actions: registry, getRuleCtx: () => ruleCtx, viewId: null }));
    expect(start).not.toHaveBeenCalled();
    d.handleInput(down, makeCtx({ actions: registry, getRuleCtx: () => ruleCtx, viewId: 'mini' }));
    expect(start).toHaveBeenCalledOnce();
    expect(seen).toEqual([null, 'mini']);
  });
});

describe('context-gated precedence', () => {
  const ruleIn = (mode: string) => ({
    focused: true,
    selection: [],
    multiActive: false,
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    action: { kind: null, id: null },
    hover: null,
    view: { x: 0, y: 0, scale: { x: 1, y: 1 } },
    mode,
    allowedCapabilities: new Set<string>(),
  });

  function setup() {
    const reset = vi.fn();
    const exit = vi.fn();
    // The ungated action registers first, so registration order alone would pick it.
    const registry = makeRegistry([
      {
        id: 'reset', label: 'reset', defaultBinding: { kind: 'key', key: 'a' },
        invoker: { timing: 'immediate', run: reset },
      },
      {
        id: 'exit', label: 'exit', defaultBinding: { kind: 'key', key: 'a' },
        eligible: { mode: 'path-edit' },
        invoker: { timing: 'immediate', run: exit },
      },
    ]);
    return { registry, reset, exit };
  }

  it('fires the action gated on the current context ahead of an ungated one', () => {
    const { registry, reset, exit } = setup();
    createDispatcher().handleInput(
      keyAEvent, makeCtx({ actions: registry, getRuleCtx: () => ruleIn('path-edit') }),
    );
    expect(exit).toHaveBeenCalledOnce();
    expect(reset).not.toHaveBeenCalled();
  });

  it('leaves the ungated action to fire when the context does not hold', () => {
    const { registry, reset, exit } = setup();
    createDispatcher().handleInput(
      keyAEvent, makeCtx({ actions: registry, getRuleCtx: () => ruleIn('normal') }),
    );
    expect(reset).toHaveBeenCalledOnce();
    expect(exit).not.toHaveBeenCalled();
  });
});
