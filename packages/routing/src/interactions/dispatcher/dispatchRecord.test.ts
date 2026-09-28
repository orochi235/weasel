/**
 * The dispatch record, checked against the two worked examples in
 * `docs/diagrams/precedence-fallthrough.svg`, a claim that drops candidates,
 * and the promise that a record, a real dispatch and `resolveAll` agree.
 */

import { describe, it, expect, vi } from 'vitest';
import { createDispatcher, type DispatcherContext, type TraceLogEntry } from './dispatcher';
import type { DispatchRecord } from './dispatchRecord';
import type { ActionsRegistry } from '../actions/registry';
import type { Action } from '../actions/action';
import type { Tool } from '../../tools/types';
import type { InputEvent } from './matcher';
import type { RuleCtx } from '../../eligibility';

function registryOf(actions: Action[]): ActionsRegistry {
  return {
    register: vi.fn().mockReturnValue(() => {}),
    unregister: vi.fn(),
    mute: vi.fn().mockReturnValue(() => {}),
    list: () => actions,
    trigger: vi.fn().mockReturnValue(false),
    subscribe: vi.fn().mockReturnValue(() => {}),
    begin: vi.fn().mockReturnValue(null),
    setDispatcher: vi.fn(),
    activate: vi.fn(),
    isActive: () => true,
  };
}

function ruleCtxIn(mode: string, allowed: string[] = []): RuleCtx {
  return {
    focused: true,
    selection: [],
    multiActive: false,
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    action: { kind: null, id: null },
    hover: null,
    mode,
    allowedCapabilities: new Set(allowed),
  } as RuleCtx;
}

function ctxOf(actions: Action[], extra: Partial<DispatcherContext> = {}): DispatcherContext {
  return {
    actions: registryOf(actions),
    depRegistry: { register: vi.fn().mockReturnValue(() => {}), get: vi.fn() },
    activeToolId: null,
    hotkeyStack: [],
    toolsById: new Map(),
    isMac: false,
    ...extra,
  };
}

const NO_MODS = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };
const escapeKey: InputEvent = { kind: 'key', key: 'Escape', ...NO_MODS };
const press = (extra: Record<string, unknown> = {}): InputEvent =>
  ({ kind: 'pointerdown', pointerId: 1, x: 5, y: 7, ...NO_MODS, ...extra }) as InputEvent;

function lastRecord(): DispatchRecord {
  const log = (window as unknown as { __weaselDispatchLog__: TraceLogEntry[] }).__weaselDispatchLog__;
  const last = log.at(-1);
  if (last?.kind !== 'dispatch') throw new Error('no dispatch record in the trace');
  return last;
}

/** Action id, placed-by step and walk step per ranked row. */
function rows(record: DispatchRecord): string[] {
  return record.ranked.map(({ candidate, placedBy, walk }) => [
    candidate.actionId,
    placedBy.step === 'specificity' ? `specificity:${placedBy.part}` : placedBy.step,
    walk.kind === 'declined' ? `declined:${walk.reason}` : walk.kind,
  ].join(' '));
}

// Escape while a path is edited: all four actions ambient, all on Escape.
function escapeScenario() {
  const run = { cancel: vi.fn(), escape: vi.fn(), reset: vi.fn(), exit: vi.fn() };
  const actions: Action[] = [
    {
      id: 'cancelGesture', label: 'cancel',
      defaultBinding: { kind: 'key', key: 'Escape', phase: [{ channel: '*', phase: 'engaged' }] },
      invoker: { timing: 'immediate', run: run.cancel },
    },
    {
      id: 'escape', label: 'escape',
      defaultBinding: { kind: 'key', key: 'Escape', phase: [{ channel: '*', phase: 'initial' }] },
      enabled: () => 'not-applicable',
      invoker: { timing: 'immediate', run: run.escape },
    },
    {
      id: 'tool.resetToDefault', label: 'reset',
      defaultBinding: { kind: 'key', key: 'Escape' },
      invoker: { timing: 'immediate', run: run.reset },
    },
    {
      id: 'exitPathEdit', label: 'exit',
      defaultBinding: { kind: 'key', key: 'Escape' },
      eligible: { mode: 'path-edit' },
      invoker: { timing: 'immediate', run: run.exit },
    },
  ];
  return { run, ctx: ctxOf(actions, { getRuleCtx: () => ruleCtxIn('path-edit') }) };
}

// A bare drag on empty canvas with the select tool active.
function dragScenario(allowed: string[]) {
  const start = { area: vi.fn(() => ({ onEnd: vi.fn() })), pan: vi.fn(() => ({ onEnd: vi.fn() })) };
  const areaSelect: Action = {
    id: 'areaSelect', label: 'area',
    defaultBinding: { kind: 'drag' },
    eligible: { capability: 'creates-selection' },
    invoker: { timing: 'ongoing', start: start.area },
  };
  const dragPan: Action = {
    id: 'viewport.dragPan', label: 'pan',
    defaultBinding: { kind: 'drag' },
    invoker: { timing: 'ongoing', start: start.pan },
  };
  const select: Tool = {
    id: 'select',
    eligibility: { focus: true },
    bindings: [{ spec: { kind: 'drag', target: { kindOf: (h: unknown) => h == null } }, actionId: 'areaSelect' }],
  };
  const ctx = ctxOf([areaSelect, dragPan], {
    activeToolId: 'select',
    toolsById: new Map([['select', select]]),
    getRuleCtx: () => ruleCtxIn('normal', allowed),
  });
  return { start, ctx };
}

describe('the dispatch record', () => {
  it('records Escape in path edit as the static diagram draws it', () => {
    const { run, ctx } = escapeScenario();
    expect(createDispatcher().handleInput(escapeKey, ctx)).toBe('handled');
    expect(run.exit).toHaveBeenCalledOnce();

    const r = lastRecord();
    expect(r.predicted).toBe(false);
    expect(r.input).toEqual({
      eventKind: 'key', key: 'Escape',
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      viewId: null, mode: 'path-edit',
    });
    // cancelGesture's engaged phase does not match with nothing in flight.
    expect(r.matched.map((c) => c.actionId)).toEqual(['escape', 'exitPathEdit', 'tool.resetToDefault']);
    expect(r.dropped).toEqual([]);
    expect(rows(r)).toEqual([
      'escape first declined:not-applicable',
      'exitPathEdit specificity:phase fired',
      'tool.resetToDefault context not-asked',
    ]);
    const [escape, exit, reset] = r.ranked.map((x) => x.candidate);
    expect(escape).toEqual({
      actionId: 'escape', routes: ['[*:initial] keyDown(Escape)'], scope: 'ambient',
      ownerToolId: null, namesView: false, specificity: [0, 0, 1, 1],
    });
    expect(exit).toMatchObject({ specificity: [0, 0, 0, 1], eligible: 'mode:path-edit' });
    expect(reset!.eligible).toBeUndefined();
    expect(r.fired).toBe('exitPathEdit');
    expect(r.outcome).toBe('handled');
  });

  it('records a bare drag with the select tool as the static diagram draws it', () => {
    const { start, ctx } = dragScenario(['creates-selection']);
    expect(createDispatcher().handleInput(press(), ctx)).toBe('handled');
    expect(start.area).toHaveBeenCalledOnce();

    const r = lastRecord();
    expect(r.input.world).toEqual({ x: 5, y: 7 });
    expect(rows(r)).toEqual([
      'areaSelect first fired',
      'areaSelect tier duplicate',
      'viewport.dragPan context not-asked',
    ]);
    expect(r.ranked.map((x) => [x.candidate.scope, x.candidate.ownerToolId, x.candidate.specificity]))
      .toEqual([
        ['active', 'select', [1, 0, 0, 1]],
        ['ambient', null, [0, 0, 0, 1]],
        ['ambient', null, [0, 0, 0, 1]],
      ]);
    expect(r.ranked[0]!.candidate.routes).toEqual(['[*:*] drag => predicate']);
    expect(r.fired).toBe('areaSelect');
  });

  it('drops both areaSelect rows as ineligible when the mode forbids creating a selection', () => {
    const { start, ctx } = dragScenario([]);
    createDispatcher().handleInput(press(), ctx);
    expect(start.pan).toHaveBeenCalledOnce();

    const r = lastRecord();
    expect(r.dropped.map((d) => [d.candidate.actionId, d.filter, d.filter === 'ineligible' ? d.rule : ''])).toEqual([
      ['areaSelect', 'ineligible', 'capability:creates-selection'],
      ['areaSelect', 'ineligible', 'capability:creates-selection'],
    ]);
    expect(rows(r)).toEqual(['viewport.dragPan first fired']);
  });

  it('reports the bindings an exclusive claim barred', () => {
    const connect: Action = {
      id: 'ports.connect', label: 'connect',
      defaultBinding: { kind: 'drag', target: 'affordance:layer:diagram-ports' },
      invoker: { timing: 'ongoing', start: () => ({ onEnd: vi.fn() }) },
    };
    const pan: Action = {
      id: 'viewport.dragPan', label: 'pan', defaultBinding: { kind: 'drag' },
      invoker: { timing: 'ongoing', start: () => ({ onEnd: vi.fn() }) },
    };
    const event = press({
      affordance: { kind: 'layer:diagram-ports', owner: 'diagram-ports', strength: 'exclusive' },
    });
    createDispatcher().handleInput(event, ctxOf([pan, connect]));

    const r = lastRecord();
    expect(r.dropped).toEqual([
      { candidate: expect.objectContaining({ actionId: 'viewport.dragPan' }), filter: 'claim', owner: 'diagram-ports' },
    ]);
    expect(r.matched.map((c) => c.actionId)).toEqual(['ports.connect', 'viewport.dragPan']);
    expect(rows(r)).toEqual(['ports.connect first fired']);
  });

  it('records an ongoing action that bails at start() and the fall-through past it', () => {
    const bail: Action = {
      id: 'bail', label: 'bail', defaultBinding: { kind: 'drag', mods: { shift: 'optional' } },
      invoker: { timing: 'ongoing', start: () => ({}) },
    };
    const pan: Action = {
      id: 'pan', label: 'pan', defaultBinding: { kind: 'drag' },
      invoker: { timing: 'ongoing', start: () => ({ onEnd: vi.fn() }) },
    };
    createDispatcher().handleInput(press(), ctxOf([bail, pan]));
    expect(rows(lastRecord())).toEqual(['bail first empty-handle', 'pan order fired']);
  });

  it('marks a record from explain() as predicted, with a would-fire winner, and invokes nothing', () => {
    const { run, ctx } = escapeScenario();
    const r = createDispatcher().explain(escapeKey, ctx);
    expect(r.predicted).toBe(true);
    expect(rows(r)).toEqual([
      'escape first declined:not-applicable',
      'exitPathEdit specificity:phase would-fire',
      'tool.resetToDefault context not-asked',
    ]);
    expect(Object.values(run).every((f) => f.mock.calls.length === 0)).toBe(true);
  });
});

describe('a record, a dispatch and resolveAll agree', () => {
  const scenarios: Array<[string, () => { ctx: DispatcherContext; event: InputEvent }]> = [
    ['Escape in path edit', () => ({ ctx: escapeScenario().ctx, event: escapeKey })],
    ['drag, select tool, selection allowed', () => ({ ctx: dragScenario(['creates-selection']).ctx, event: press() })],
    ['drag, select tool, selection forbidden', () => ({ ctx: dragScenario([]).ctx, event: press() })],
  ];

  it.each(scenarios)('%s', (_name, make) => {
    const { ctx, event } = make();
    const fired: string[] = [];
    // Watch what a real dispatch runs, without changing what it does.
    const watched: DispatcherContext = {
      ...ctx,
      actions: registryOf(ctx.actions.list().map((a) => {
        const inv = a.invoker;
        if (inv?.timing === 'immediate') {
          return { ...a, invoker: { ...inv, run: (...args: Parameters<typeof inv.run>) => { fired.push(a.id); inv.run(...args); } } };
        }
        if (inv?.timing === 'ongoing') {
          return { ...a, invoker: { ...inv, start: (...args: Parameters<typeof inv.start>) => { fired.push(a.id); return inv.start(...args); } } };
        }
        return a;
      })),
    };
    const d = createDispatcher();
    const predicted = d.explain(event, watched);
    const resolved = d.resolveAll(event, watched).find((c) => c.verdict.kind === 'would-fire')?.actionId ?? null;
    expect(fired).toEqual([]);
    d.handleInput(event, watched);
    expect(fired).toEqual([predicted.fired]);
    expect(resolved).toBe(predicted.fired);
    expect(lastRecord().fired).toBe(predicted.fired);
  });
});
