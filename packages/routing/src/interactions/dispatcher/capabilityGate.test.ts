/**
 * `Eligibility.capabilities` — populated by `defineTool` from every
 * `ToolDef.capabilities` — gated nothing. `liveScope` short-circuits on
 * `state.allows &&`, and the dispatcher never supplied `allows`, so a tool
 * declaring a capability the active mode forbids kept routing input.
 *
 * Most tools were covered by accident: the action a binding points at repeats
 * the tag in its own `eligible` rule, a separate gate that does fire. What the
 * tool-level gate reaches is a binding whose action carries no rule —
 * `polygon.adjustSides` and `star.adjustPoints`, the wheel and arrow-key
 * bindings a shape tool owns, which kept routing in a mode that forbids
 * `creates-shapes` while the same tool's `insert` binding was stripped.
 */
import { describe, it, expect, vi } from 'vitest';
import { createDispatcher } from './dispatcher';
import type { DispatcherContext } from './dispatcher';
import type { ActionsRegistry } from '../actions/registry';
import type { Action } from '../actions/action';
import type { DepRegistry } from '../actions/depRegistry';
import type { Tool } from '../../tools/types';
import type { InputEvent } from './matcher';
import type { RuleCtx } from '../../eligibility';

const slice = (onStart: () => void): Action => ({
  id: 'slice', label: 'slice',
  invoker: { timing: 'ongoing', start: () => { onStart(); return { onEnd: () => {} }; } },
} as unknown as Action);

const sliceTool = {
  id: 'slice',
  eligibility: { focus: true, capabilities: ['edits-page'] },
  bindings: [{ spec: { kind: 'drag' }, actionId: 'slice' }],
} as unknown as Tool;

function ctxOf(action: Action, allowed: string[] | null): DispatcherContext {
  const depRegistry: DepRegistry = {
    register: vi.fn().mockReturnValue(() => {}), get: vi.fn() as DepRegistry['get'],
  };
  const actions = {
    register: vi.fn(), unregister: vi.fn(), mute: vi.fn(), subscribe: vi.fn(),
    trigger: vi.fn(), begin: vi.fn(), setDispatcher: vi.fn(), setDepRegistry: vi.fn(),
    list: () => [action],
  } as unknown as ActionsRegistry;
  return {
    depRegistry, actions, activeToolId: 'slice', hotkeyStack: [],
    toolsById: new Map([['slice', sliceTool]]), isMac: false,
    ...(allowed === null ? {} : {
      getRuleCtx: () => ({
        focused: true, selection: [], multiActive: false,
        modifiers: { alt: false, shift: false, meta: false, ctrl: false },
        action: { kind: null, id: null }, hover: null,
        view: { x: 0, y: 0, scale: { x: 1, y: 1 } },
        mode: 'normal', allowedCapabilities: new Set(allowed),
      } as unknown as RuleCtx),
    }),
  } as DispatcherContext;
}

const down = {
  kind: 'pointerdown', x: 0, y: 0, clientX: 0, clientY: 0,
  altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
} as unknown as InputEvent;

describe('a tool capability the active mode forbids takes its bindings out', () => {
  it('does not route to a tool whose capability is disallowed', () => {
    const onStart = vi.fn();
    const action = slice(onStart);
    const d = createDispatcher({ getAction: (id) => (id === 'slice' ? action : undefined) });
    d.handleInput(down, ctxOf(action, ['navigate']));
    expect(onStart).not.toHaveBeenCalled();
  });

  it('routes when the mode allows it', () => {
    const onStart = vi.fn();
    const action = slice(onStart);
    const d = createDispatcher({ getAction: (id) => (id === 'slice' ? action : undefined) });
    d.handleInput(down, ctxOf(action, ['navigate', 'edits-page']));
    expect(onStart).toHaveBeenCalledOnce();
  });

  // A consumer that never wired the modes system supplies no `getRuleCtx`, and
  // must keep routing exactly as before rather than losing every tool that
  // declares a tag.
  it('routes when no mode system is wired at all', () => {
    const onStart = vi.fn();
    const action = slice(onStart);
    const d = createDispatcher({ getAction: (id) => (id === 'slice' ? action : undefined) });
    d.handleInput(down, ctxOf(action, null));
    expect(onStart).toHaveBeenCalledOnce();
  });
});
