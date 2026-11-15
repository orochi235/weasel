/**
 * The precedence table in `docs/taxonomy.md` ("When several bindings match
 * one input"), one case per claim the existing precedence tests leave open.
 */
import { describe, expect, it, vi } from 'vitest';
import { hitPredicate } from '@weasel-js/gestures';
import { createDispatcher } from './dispatcher';
import type { Action } from '../actions/action';
import type { Contribution } from '../../contributions/types';
import type { InputEvent } from './matcher';
import { immediateAction, keyAEvent, makeCtx, makeRegistry } from './testing/dispatcherStubs';

const noMods = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };

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

function clickAction(id: string, run = vi.fn()): Action {
  return { id, label: id, invoker: { timing: 'immediate', run } };
}

describe('step 3: specificity within a tier', () => {
  it('ranks target narrowness ahead of required modifiers', () => {
    const shifted = vi.fn();
    const targeted = vi.fn();
    const isAnchor = hitPredicate((h: unknown) => (h as { kind?: string } | null)?.kind === 'anchor');
    const entry: Contribution<never> = {
      id: 'e',
      eligibility: { always: true },
      bindings: [
        { spec: { kind: 'click', mods: { shift: true } }, actionId: 'shifted' },
        { spec: { kind: 'click', target: { kindOf: isAnchor }, mods: { shift: 'optional' } }, actionId: 'targeted' },
      ],
    };
    const e: InputEvent = { kind: 'click', x: 0, y: 0, ...noMods, shiftKey: true, affordance: { kind: 'anchor' } };
    createDispatcher().handleInput(e, makeCtx({
      actions: makeRegistry([clickAction('shifted', shifted), clickAction('targeted', targeted)]),
      entriesById: new Map([['e', entry]]),
    }));
    expect(targeted).toHaveBeenCalledOnce();
    expect(shifted).not.toHaveBeenCalled();
  });

  it('ranks required modifiers ahead of phase', () => {
    const phased = vi.fn();
    const shifted = vi.fn();
    const entry: Contribution<never> = {
      id: 'e',
      eligibility: { always: true },
      bindings: [
        { spec: { kind: 'key', key: 'a', mods: { shift: 'optional' }, phase: 'initial' }, actionId: 'phased' },
        { spec: { kind: 'key', key: 'a', mods: { shift: true } }, actionId: 'shifted' },
      ],
    };
    createDispatcher().handleInput({ ...keyAEvent, shiftKey: true }, makeCtx({
      actions: makeRegistry([clickAction('phased', phased), clickAction('shifted', shifted)]),
      entriesById: new Map([['e', entry]]),
    }));
    expect(shifted).toHaveBeenCalledOnce();
    expect(phased).not.toHaveBeenCalled();
  });
});

describe('step 4 with no rule context', () => {
  function gatedSecond() {
    const reset = vi.fn();
    const exit = vi.fn();
    const registry = makeRegistry([
      immediateAction('reset', 'a', reset),
      { ...immediateAction('exit', 'a', exit), eligible: { mode: 'path-edit' } },
    ]);
    return { registry, reset, exit };
  }

  it('does nothing when getRuleCtx is absent: registration order decides', () => {
    const { registry, reset, exit } = gatedSecond();
    createDispatcher().handleInput(keyAEvent, makeCtx({ actions: registry }));
    expect(reset).toHaveBeenCalledOnce();
    expect(exit).not.toHaveBeenCalled();
  });

  it('does nothing when getRuleCtx answers undefined', () => {
    const { registry, reset, exit } = gatedSecond();
    createDispatcher().handleInput(keyAEvent, makeCtx({ actions: registry, getRuleCtx: () => undefined }));
    expect(reset).toHaveBeenCalledOnce();
    expect(exit).not.toHaveBeenCalled();
  });

  it('drops no gated action, whatever its rule would say', () => {
    const exit = vi.fn();
    const registry = makeRegistry([{ ...immediateAction('exit', 'a', exit), eligible: { mode: 'path-edit' } }]);
    expect(createDispatcher().handleInput(keyAEvent, makeCtx({ actions: registry }))).toBe('handled');
    expect(exit).toHaveBeenCalledOnce();
  });

  it('drops a gated action whose rule is false once there is a context', () => {
    const exit = vi.fn();
    const registry = makeRegistry([{ ...immediateAction('exit', 'a', exit), eligible: { mode: 'path-edit' } }]);
    const ctx = makeCtx({ actions: registry, getRuleCtx: () => ruleIn('normal') });
    expect(createDispatcher().handleInput(keyAEvent, ctx)).toBe('unhandled');
    expect(exit).not.toHaveBeenCalled();
  });
});

describe('step 5: registration order', () => {
  const keyEntry = (id: string, actionId: string, eligibility: Contribution<never>['eligibility']): Contribution<never> => ({
    id, eligibility, bindings: [{ spec: { kind: 'key', key: 'a' }, actionId }],
  });

  it('puts the newest hold first among held entries', () => {
    const older = vi.fn();
    const newer = vi.fn();
    const entriesById = new Map([
      ['newer', keyEntry('newer', 'newer.a', { focus: true })],
      ['older', keyEntry('older', 'older.a', { focus: true })],
    ]);
    createDispatcher().handleInput(keyAEvent, makeCtx({
      actions: makeRegistry([clickAction('older.a', older), clickAction('newer.a', newer)]),
      hotkeyStack: ['older', 'newer'],
      activeToolId: null,
      entriesById,
    }));
    expect(newer).toHaveBeenCalledOnce();
    expect(older).not.toHaveBeenCalled();
  });

  it('puts an entry ahead of a registered action in the same tier', () => {
    const fromAction = vi.fn();
    const fromEntry = vi.fn();
    createDispatcher().handleInput(keyAEvent, makeCtx({
      actions: makeRegistry([immediateAction('action.a', 'a', fromAction), clickAction('entry.a', fromEntry)]),
      entriesById: new Map([['e', keyEntry('e', 'entry.a', { always: true })]]),
    }));
    expect(fromEntry).toHaveBeenCalledOnce();
    expect(fromAction).not.toHaveBeenCalled();
  });

  it('keeps entries in the order given', () => {
    const first = vi.fn();
    const second = vi.fn();
    createDispatcher().handleInput(keyAEvent, makeCtx({
      actions: makeRegistry([clickAction('second.a', second), clickAction('first.a', first)]),
      entriesById: new Map([
        ['first', keyEntry('first', 'first.a', { always: true })],
        ['second', keyEntry('second', 'second.a', { always: true })],
      ]),
    }));
    expect(first).toHaveBeenCalledOnce();
    expect(second).not.toHaveBeenCalled();
  });
});

describe('an exclusive claim is a hard filter', () => {
  it('does nothing when every binding that consults the claim is ineligible', () => {
    const insert = vi.fn();
    const hud = vi.fn();
    const ownsHit = hitPredicate((h: unknown) => (h as { owner?: string } | null)?.owner === 'weasel-hud');
    const entriesById = new Map<string, Contribution<never>>([
      ['rect', { id: 'rect', eligibility: { focus: true }, bindings: [{ spec: { kind: 'click' }, actionId: 'insert' }] }],
      ['hud', { id: 'hud', eligibility: { always: true }, bindings: [{ spec: { kind: 'click', target: { kindOf: ownsHit } }, actionId: 'hud' }] }],
    ]);
    const e: InputEvent = {
      kind: 'click', x: 0, y: 0, ...noMods,
      affordance: { kind: 'layer:weasel-hud', owner: 'weasel-hud', strength: 'exclusive' },
    };
    const result = createDispatcher().handleInput(e, makeCtx({
      actions: makeRegistry([clickAction('insert', insert), { ...clickAction('hud', hud), eligible: { mode: 'hud' } }]),
      activeToolId: 'rect',
      entriesById,
      getRuleCtx: () => ruleIn('normal'),
    }));
    expect(result).toBe('unhandled');
    expect(insert).not.toHaveBeenCalled();
    expect(hud).not.toHaveBeenCalled();
  });
});
