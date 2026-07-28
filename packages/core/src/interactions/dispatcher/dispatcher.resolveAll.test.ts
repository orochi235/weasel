/**
 * `Dispatcher.resolveAll` — the ordered candidate list behind `resolveOnly`.
 * Covers ordering across scopes, every verdict kind, and the invariant that
 * keeps the two methods from drifting.
 */
import { describe, it, expect, vi } from 'vitest';
import { createDispatcher } from './dispatcher';
import type { DispatcherContext } from './dispatcher';
import type { ActionsRegistry, Action } from '../actions/registry';
import type { DepRegistry } from '../actions/depRegistry';
import type { InputEvent } from './matcher';
import type { Tool } from '../../tools/types';
import type { RuleCtx } from '../../features/chrome-caps';

function makeRegistry(actions: Action[]): ActionsRegistry {
  const map = new Map(actions.map((a) => [a.id, a]));
  return {
    register: vi.fn().mockReturnValue(() => {}),
    unregister: vi.fn(),
    list: () => Array.from(map.values()),
    trigger: vi.fn().mockReturnValue(false),
    subscribe: vi.fn().mockReturnValue(() => {}),
    begin: vi.fn().mockReturnValue(null),
    setDispatcher: vi.fn(),
    setDepRegistry: vi.fn(),
  };
}

function makeDepRegistry(): DepRegistry {
  return { register: vi.fn().mockReturnValue(() => {}), get: vi.fn() as DepRegistry['get'] };
}

function makeRuleCtx(overrides: Partial<RuleCtx> = {}): RuleCtx {
  return {
    focused: true,
    selection: [],
    multiActive: false,
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    action: { kind: null, id: null },
    hover: null,
    view: { x: 0, y: 0, scale: { x: 1, y: 1 } },
    mode: 'normal',
    allowedCapabilities: new Set(),
    ...overrides,
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

/** An action that would fire: ongoing invoker, no eligibility restriction. */
function action(id: string, extra: Partial<Action> = {}): Action {
  return {
    id,
    label: id,
    invoker: { timing: 'ongoing', start: vi.fn().mockReturnValue({}) as never },
    ...extra,
  };
}

function tool(id: string, bindings: unknown[]): Tool<unknown> {
  return { id, bindings } as unknown as Tool<unknown>;
}

/** The event a `{ kind: 'drag' }` spec matches: a buffered pointerdown (one
 *  with `stage` omitted — `stage: 'press'` is the eager dispatch, which drag
 *  specs deliberately ignore). There is no `kind: 'drag'` InputEvent arm. */
const dragEvent: InputEvent = {
  kind: 'pointerdown',
  x: 0, y: 0, clientX: 0, clientY: 0,
  altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
};

describe('resolveAll', () => {
  it('returns an empty array when nothing matches', () => {
    const d = createDispatcher();
    const ctx = makeCtx({ actions: makeRegistry([]) });
    expect(d.resolveAll(dragEvent, ctx)).toEqual([]);
  });

  it('orders candidates hotkey > active > ambient', () => {
    const d = createDispatcher();
    const bind = (actionId: string) => ({ spec: { kind: 'drag' }, actionId });
    const ctx = makeCtx({
      actions: makeRegistry([action('hk'), action('act'), action('amb')]),
      activeToolId: 'activeTool',
      hotkeyStack: ['hotkeyTool'],
      ambientToolIds: ['ambientTool'],
      toolsById: new Map<string, Tool<unknown>>([
        ['hotkeyTool', tool('hotkeyTool', [bind('hk')])],
        ['activeTool', tool('activeTool', [bind('act')])],
        ['ambientTool', tool('ambientTool', [bind('amb')])],
      ]),
    });
    const out = d.resolveAll(dragEvent, ctx);
    expect(out.map((c) => c.actionId)).toEqual(['hk', 'act', 'amb']);
    expect(out.map((c) => c.scope)).toEqual(['hotkey', 'active', 'ambient']);
  });

  it('marks the first passing candidate would-fire and the rest shadowed', () => {
    const d = createDispatcher();
    const ctx = makeCtx({
      actions: makeRegistry([action('first'), action('second')]),
      activeToolId: 't',
      toolsById: new Map<string, Tool<unknown>>([['t', tool('t', [
        { spec: { kind: 'drag', target: 'selected-body' }, actionId: 'first' },
        { spec: { kind: 'drag' }, actionId: 'second' },
      ])]]),
    });
    const out = d.resolveAll({ ...dragEvent, bodyTarget: 'selected-body' } as InputEvent, ctx);
    expect(out.map((c) => c.verdict.kind)).toEqual(['would-fire', 'shadowed']);
  });

  it('reports the specificity tuple that drove the ordering', () => {
    const d = createDispatcher();
    const ctx = makeCtx({
      actions: makeRegistry([action('narrow'), action('broad')]),
      activeToolId: 't',
      toolsById: new Map<string, Tool<unknown>>([['t', tool('t', [
        // `shift: 'optional'` so the broad binding still matches a shift-held
        // event (unlisted modifiers are forbidden by default). `'optional'`
        // does not count toward specificity, so this stays a [0,0,0,1] spec.
        { spec: { kind: 'drag', mods: { shift: 'optional' } }, actionId: 'broad' },
        { spec: { kind: 'drag', target: 'selected-body', mods: { shift: true } }, actionId: 'narrow' },
      ])]]),
    });
    const out = d.resolveAll(
      { ...dragEvent, shiftKey: true, bodyTarget: 'selected-body' } as InputEvent,
      ctx,
    );
    // Declared broad-first, but the narrow one outranks it on specificity.
    expect(out[0].actionId).toBe('narrow');
    expect(out[0].specificity).toEqual([1, 1, 0, 1]);
    expect(out[1].specificity).toEqual([0, 0, 0, 1]);
  });

  it('marks a candidate disabled and carries its reason, then fires the next', () => {
    const d = createDispatcher();
    const ctx = makeCtx({
      actions: makeRegistry([
        action('off', { enabled: () => 'selection-required' as never }),
        action('on'),
      ]),
      activeToolId: 't',
      toolsById: new Map<string, Tool<unknown>>([['t', tool('t', [
        { spec: { kind: 'drag', target: 'selected-body' }, actionId: 'off' },
        { spec: { kind: 'drag' }, actionId: 'on' },
      ])]]),
    });
    const out = d.resolveAll({ ...dragEvent, bodyTarget: 'selected-body' } as InputEvent, ctx);
    expect(out[0].verdict).toEqual({ kind: 'disabled', reason: 'selection-required' });
    expect(out[1].verdict).toEqual({ kind: 'would-fire' });
  });

  it('asks enabled() once per candidate down to the winner, and never below it', () => {
    const d = createDispatcher();
    const offEnabled = vi.fn().mockReturnValue('selection-required');
    const onEnabled = vi.fn().mockReturnValue(true);
    const belowEnabled = vi.fn().mockReturnValue(true);
    const ctx = makeCtx({
      actions: makeRegistry([
        action('off', { enabled: offEnabled as never }),
        action('on', { enabled: onEnabled as never }),
        action('below', { enabled: belowEnabled as never }),
      ]),
      activeToolId: 't',
      toolsById: new Map<string, Tool<unknown>>([['t', tool('t', [
        { spec: { kind: 'drag', target: 'selected-body' }, actionId: 'off' },
        { spec: { kind: 'drag' }, actionId: 'on' },
        { spec: { kind: 'drag' }, actionId: 'below' },
      ])]]),
    });
    const out = d.resolveAll({ ...dragEvent, bodyTarget: 'selected-body' } as InputEvent, ctx);
    expect(out.map((c) => c.verdict.kind)).toEqual(['disabled', 'would-fire', 'shadowed']);
    expect(offEnabled).toHaveBeenCalledTimes(1);
    expect(onEnabled).toHaveBeenCalledTimes(1);
    // Anything after the winner is shadowed without ever being asked — the
    // property that keeps resolveAll as cheap as the dispatch it replays.
    expect(belowEnabled).not.toHaveBeenCalled();
  });

  it('marks a candidate ineligible when its rule fails', () => {
    const d = createDispatcher();
    const ctx = makeCtx({
      actions: makeRegistry([
        action('gated', { eligible: { capability: 'edits-page' } }),
        action('open'),
      ]),
      activeToolId: 't',
      getRuleCtx: () => makeRuleCtx({ allowedCapabilities: new Set() }),
      toolsById: new Map<string, Tool<unknown>>([['t', tool('t', [
        { spec: { kind: 'drag', target: 'selected-body' }, actionId: 'gated' },
        { spec: { kind: 'drag' }, actionId: 'open' },
      ])]]),
    });
    const out = d.resolveAll({ ...dragEvent, bodyTarget: 'selected-body' } as InputEvent, ctx);
    expect(out[0].verdict.kind).toBe('ineligible');
    // The rule itself, serialized — `evaluate()` yields a bare boolean, so
    // there is no reason string to carry.
    expect((out[0].verdict as { reason: string }).reason).toBe('{"capability":"edits-page"}');
    expect(out[1].verdict).toEqual({ kind: 'would-fire' });
  });

  it('reports an ineligible candidate below the winner as shadowed, not ineligible', () => {
    const d = createDispatcher();
    const ctx = makeCtx({
      actions: makeRegistry([
        action('win'),
        action('gated', { eligible: { capability: 'edits-page' } }),
      ]),
      activeToolId: 't',
      getRuleCtx: () => makeRuleCtx({ allowedCapabilities: new Set() }),
      toolsById: new Map<string, Tool<unknown>>([['t', tool('t', [
        { spec: { kind: 'drag', target: 'selected-body' }, actionId: 'win' },
        { spec: { kind: 'drag' }, actionId: 'gated' },
      ])]]),
    });
    const out = d.resolveAll({ ...dragEvent, bodyTarget: 'selected-body' } as InputEvent, ctx);
    // `fired` is checked before eligibility, so once something has won the
    // reason a lower candidate stays silent is the shadowing, not its rule.
    expect(out[0].verdict).toEqual({ kind: 'would-fire' });
    expect(out[1].verdict).toEqual({ kind: 'shadowed' });
  });

  it('gives a repeated action the verdict of its first occurrence', () => {
    const d = createDispatcher();
    const ctx = makeCtx({
      actions: makeRegistry([action('same', { enabled: () => 'scene-empty' as never })]),
      activeToolId: 't',
      toolsById: new Map<string, Tool<unknown>>([['t', tool('t', [
        { spec: { kind: 'drag', target: 'selected-body' }, actionId: 'same' },
        { spec: { kind: 'drag' }, actionId: 'same' },
      ])]]),
    });
    const out = d.resolveAll({ ...dragEvent, bodyTarget: 'selected-body' } as InputEvent, ctx);
    expect(out).toHaveLength(2);
    expect(out[0].verdict).toEqual({ kind: 'disabled', reason: 'scene-empty' });
    expect(out[1].verdict).toEqual({ kind: 'disabled', reason: 'scene-empty' });
  });

  it('shadows a repeat of the action that already won, keeping one would-fire', () => {
    const d = createDispatcher();
    const ctx = makeCtx({
      actions: makeRegistry([action('same')]),
      activeToolId: 't',
      toolsById: new Map<string, Tool<unknown>>([['t', tool('t', [
        { spec: { kind: 'drag', target: 'selected-body' }, actionId: 'same' },
        { spec: { kind: 'drag' }, actionId: 'same' },
      ])]]),
    });
    const out = d.resolveAll({ ...dragEvent, bodyTarget: 'selected-body' } as InputEvent, ctx);
    expect(out.map((c) => c.verdict.kind)).toEqual(['would-fire', 'shadowed']);
  });
});

describe('resolveOnly agrees with resolveAll', () => {
  // The anti-drift property: resolveOnly must be exactly the first would-fire
  // entry, so a change to one can't silently diverge from the other.
  const cases: Array<{ name: string; ctx: () => DispatcherContext }> = [
    {
      name: 'no match',
      ctx: () => makeCtx({ actions: makeRegistry([]) }),
    },
    {
      name: 'single match',
      ctx: () => makeCtx({
        actions: makeRegistry([action('only')]),
        activeToolId: 't',
        toolsById: new Map<string, Tool<unknown>>([
          ['t', tool('t', [{ spec: { kind: 'drag' }, actionId: 'only' }])],
        ]),
      }),
    },
    {
      name: 'first disabled, second fires',
      ctx: () => makeCtx({
        actions: makeRegistry([
          action('off', { enabled: () => 'not-applicable' as never }),
          action('on'),
        ]),
        activeToolId: 't',
        toolsById: new Map<string, Tool<unknown>>([['t', tool('t', [
          { spec: { kind: 'drag', target: 'selected-body' }, actionId: 'off' },
          { spec: { kind: 'drag' }, actionId: 'on' },
        ])]]),
      }),
    },
    {
      name: 'every candidate disabled',
      ctx: () => makeCtx({
        actions: makeRegistry([action('off', { enabled: () => 'not-applicable' as never })]),
        activeToolId: 't',
        toolsById: new Map<string, Tool<unknown>>([
          ['t', tool('t', [{ spec: { kind: 'drag' }, actionId: 'off' }])],
        ]),
      }),
    },
    {
      // Winner comes from the hotkey scope, so agreement depends on both
      // methods assembling the scopes in the same order.
      name: 'candidates spanning hotkey, active and ambient scopes',
      ctx: () => {
        const bind = (actionId: string) => ({ spec: { kind: 'drag' }, actionId });
        return makeCtx({
          actions: makeRegistry([action('hk'), action('act'), action('amb')]),
          activeToolId: 'activeTool',
          hotkeyStack: ['hotkeyTool'],
          ambientToolIds: ['ambientTool'],
          toolsById: new Map<string, Tool<unknown>>([
            ['hotkeyTool', tool('hotkeyTool', [bind('hk')])],
            ['activeTool', tool('activeTool', [bind('act')])],
            ['ambientTool', tool('ambientTool', [bind('amb')])],
          ]),
        });
      },
    },
    {
      // resolveOnly used to drop ineligible candidates before the walk;
      // resolveAll keeps and labels them. Same winner either way.
      name: 'first candidate ineligible, second fires',
      ctx: () => makeCtx({
        actions: makeRegistry([
          action('gated', { eligible: { capability: 'edits-page' } }),
          action('open'),
        ]),
        activeToolId: 't',
        getRuleCtx: () => makeRuleCtx({ allowedCapabilities: new Set() }),
        toolsById: new Map<string, Tool<unknown>>([['t', tool('t', [
          { spec: { kind: 'drag', target: 'selected-body' }, actionId: 'gated' },
          { spec: { kind: 'drag' }, actionId: 'open' },
        ])]]),
      }),
    },
    {
      // Two bindings, one action: the per-action dedup must not make
      // resolveOnly pick a different entry than the first would-fire.
      name: 'two bindings pointing at the same action',
      ctx: () => makeCtx({
        actions: makeRegistry([action('same')]),
        activeToolId: 't',
        toolsById: new Map<string, Tool<unknown>>([['t', tool('t', [
          { spec: { kind: 'drag', target: 'selected-body' }, actionId: 'same' },
          { spec: { kind: 'drag' }, actionId: 'same' },
        ])]]),
      }),
    },
  ];

  for (const { name, ctx: makeCase } of cases) {
    it(name, () => {
      const d = createDispatcher();
      const ctx = makeCase();
      const event = { ...dragEvent, bodyTarget: 'selected-body' } as InputEvent;
      const only = d.resolveOnly(event, ctx);
      const first = d.resolveAll(event, ctx).find((c) => c.verdict.kind === 'would-fire');
      if (first === undefined) {
        expect(only).toBeNull();
      } else {
        expect(only).not.toBeNull();
        expect(only!.actionId).toBe(first.actionId);
        expect(only!.scope).toBe(first.scope);
        expect(only!.ownerToolId).toBe(first.ownerToolId);
        expect(only!.action).toBe(first.action);
      }
    });
  }
});
