import { describe, it, expect } from 'vitest';
import {
  matchModifiers,
  matchKey,
  matchSpec,
  matchTarget,
  matchPhase,
  mimeMatchesGlob,
  matchIngestTypes,
  type PhaseContext,
} from './match';
import type { InputEvent } from './inputEvent';

const noMods = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };
// Default wheel event data fields (matcher only reads mods; these are pass-through).
const noWheelData = { deltaX: 0, deltaY: 0, clientX: 0, clientY: 0 };

describe('matchModifiers (strict semantics)', () => {
  it('undefined spec matches only when NO modifiers held', () => {
    expect(matchModifiers(noMods, undefined, false)).toBe(true);
    expect(matchModifiers({ ...noMods, shiftKey: true }, undefined, false)).toBe(false);
    expect(matchModifiers({ ...noMods, metaKey: true }, undefined, false)).toBe(false);
  });

  it('explicit shift: true requires shift held; rejects other modifiers', () => {
    expect(matchModifiers({ ...noMods, shiftKey: true }, { shift: true }, false)).toBe(true);
    expect(matchModifiers(noMods, { shift: true }, false)).toBe(false);
    expect(matchModifiers({ ...noMods, shiftKey: true, metaKey: true }, { shift: true }, false)).toBe(false);
  });

  it('shift: "optional" accepts shifted and unshifted (other mods must be absent)', () => {
    expect(matchModifiers(noMods, { shift: 'optional' }, false)).toBe(true);
    expect(matchModifiers({ ...noMods, shiftKey: true }, { shift: 'optional' }, false)).toBe(true);
    expect(matchModifiers({ ...noMods, metaKey: true }, { shift: 'optional' }, false)).toBe(false);
  });

  it('alt: "optional" accepts both alt-held and unheld', () => {
    expect(matchModifiers(noMods, { alt: 'optional' }, false)).toBe(true);
    expect(matchModifiers({ ...noMods, altKey: true }, { alt: 'optional' }, false)).toBe(true);
    expect(matchModifiers({ ...noMods, metaKey: true }, { alt: 'optional' }, false)).toBe(false);
  });

  it('ctrl: "optional" accepts both ctrl-held and unheld', () => {
    expect(matchModifiers(noMods, { ctrl: 'optional' }, false)).toBe(true);
    expect(matchModifiers({ ...noMods, ctrlKey: true }, { ctrl: 'optional' }, false)).toBe(true);
    expect(matchModifiers({ ...noMods, altKey: true }, { ctrl: 'optional' }, false)).toBe(false);
  });

  it('meta: "optional" accepts both meta-held and unheld', () => {
    expect(matchModifiers(noMods, { meta: 'optional' }, false)).toBe(true);
    expect(matchModifiers({ ...noMods, metaKey: true }, { meta: 'optional' }, false)).toBe(true);
    expect(matchModifiers({ ...noMods, ctrlKey: true }, { meta: 'optional' }, false)).toBe(false);
  });

  it('mod: "optional" resolves platform-aware — meta-optional on mac, ctrl-optional elsewhere', () => {
    // mac
    expect(matchModifiers(noMods, { mod: 'optional' }, true)).toBe(true);
    expect(matchModifiers({ ...noMods, metaKey: true }, { mod: 'optional' }, true)).toBe(true);
    expect(matchModifiers({ ...noMods, ctrlKey: true }, { mod: 'optional' }, true)).toBe(false);
    // non-mac
    expect(matchModifiers(noMods, { mod: 'optional' }, false)).toBe(true);
    expect(matchModifiers({ ...noMods, ctrlKey: true }, { mod: 'optional' }, false)).toBe(true);
    expect(matchModifiers({ ...noMods, metaKey: true }, { mod: 'optional' }, false)).toBe(false);
  });

  it('multiple optional mods compose (alt + shift both optional)', () => {
    const spec = { alt: 'optional', shift: 'optional' } as const;
    expect(matchModifiers(noMods, spec, false)).toBe(true);
    expect(matchModifiers({ ...noMods, altKey: true }, spec, false)).toBe(true);
    expect(matchModifiers({ ...noMods, shiftKey: true }, spec, false)).toBe(true);
    expect(matchModifiers({ ...noMods, altKey: true, shiftKey: true }, spec, false)).toBe(true);
    expect(matchModifiers({ ...noMods, metaKey: true }, spec, false)).toBe(false);
  });

  it('mod: true matches metaKey on mac, ctrlKey elsewhere', () => {
    expect(matchModifiers({ ...noMods, metaKey: true }, { mod: true }, true)).toBe(true);
    expect(matchModifiers({ ...noMods, ctrlKey: true }, { mod: true }, true)).toBe(false);
    expect(matchModifiers({ ...noMods, ctrlKey: true }, { mod: true }, false)).toBe(true);
    expect(matchModifiers({ ...noMods, metaKey: true }, { mod: true }, false)).toBe(false);
  });

  it('mod: true requires only one of meta/ctrl (the platform one)', () => {
    // on mac, ctrl must not be held when mod: true
    expect(matchModifiers({ ...noMods, metaKey: true, ctrlKey: true }, { mod: true }, true)).toBe(false);
    // on non-mac, meta must not be held when mod: true
    expect(matchModifiers({ ...noMods, metaKey: true, ctrlKey: true }, { mod: true }, false)).toBe(false);
  });

  it('explicit shift: false same as omitted', () => {
    expect(matchModifiers(noMods, { shift: false }, false)).toBe(true);
    expect(matchModifiers({ ...noMods, shiftKey: true }, { shift: false }, false)).toBe(false);
  });

  it('combined mods (mod: true + shift: true) — both required', () => {
    expect(matchModifiers({ ...noMods, metaKey: true, shiftKey: true }, { mod: true, shift: true }, true)).toBe(true);
    expect(matchModifiers({ ...noMods, metaKey: true }, { mod: true, shift: true }, true)).toBe(false);
  });

  it('alt: true requires alt held', () => {
    expect(matchModifiers({ ...noMods, altKey: true }, { alt: true }, false)).toBe(true);
    expect(matchModifiers(noMods, { alt: true }, false)).toBe(false);
  });

  it('explicit meta/ctrl (without mod shorthand) — strict', () => {
    expect(matchModifiers({ ...noMods, metaKey: true }, { meta: true }, false)).toBe(true);
    expect(matchModifiers({ ...noMods, ctrlKey: true }, { meta: true }, false)).toBe(false);
    expect(matchModifiers({ ...noMods, ctrlKey: true }, { ctrl: true }, false)).toBe(true);
  });

  it('alt: false is same as omitted (must be absent)', () => {
    expect(matchModifiers(noMods, { alt: false }, false)).toBe(true);
    expect(matchModifiers({ ...noMods, altKey: true }, { alt: false }, false)).toBe(false);
  });

  it('extra held modifier rejected when not specified', () => {
    // shift: true specified but alt also held — should fail
    expect(matchModifiers({ ...noMods, shiftKey: true, altKey: true }, { shift: true }, false)).toBe(false);
  });
});

describe('matchKey (case-insensitive)', () => {
  it('single key match is case-insensitive', () => {
    expect(matchKey('a', 'A')).toBe(true);
    expect(matchKey('Escape', 'escape')).toBe(true);
    expect(matchKey('b', 'a')).toBe(false);
  });
  it('array of keys — any matches', () => {
    expect(matchKey('Delete', ['Delete', 'Backspace'])).toBe(true);
    expect(matchKey('Backspace', ['Delete', 'Backspace'])).toBe(true);
    expect(matchKey('Escape', ['Delete', 'Backspace'])).toBe(false);
  });
  it('array match is also case-insensitive', () => {
    expect(matchKey('delete', ['Delete', 'Backspace'])).toBe(true);
  });
});

describe('matchSpec', () => {
  it('KeySpec matches on key + modifiers', () => {
    const e: InputEvent = { kind: 'key', key: 'a', ...noMods };
    expect(matchSpec(e, { kind: 'key', key: 'a' }, false)).toBe(true);
    expect(matchSpec(e, { kind: 'key', key: 'b' }, false)).toBe(false);
  });

  it('KeySpec rejects wrong kind', () => {
    const wheel: InputEvent = { kind: 'wheel', ...noMods, ...noWheelData };
    expect(matchSpec(wheel, { kind: 'key', key: 'a' }, false)).toBe(false);
  });

  it('KeySpec rejects when modifier not held but required', () => {
    const e: InputEvent = { kind: 'key', key: 'z', ...noMods };
    expect(matchSpec(e, { kind: 'key', key: 'z', mods: { mod: true } }, false)).toBe(false);
    expect(matchSpec(e, { kind: 'key', key: 'z', mods: { mod: true } }, true)).toBe(false);
  });

  it('KeySpec rejects when extra modifier held but not specified', () => {
    const e: InputEvent = { kind: 'key', key: 'a', ...noMods, shiftKey: true };
    expect(matchSpec(e, { kind: 'key', key: 'a' }, false)).toBe(false);
  });

  it('KeyHeldSpec matches on phase: down', () => {
    const down: InputEvent = { kind: 'key-held', key: ' ', phase: 'down', ...noMods };
    expect(matchSpec(down, { kind: 'key-held', key: ' ' }, false)).toBe(true);
  });

  it('KeyHeldSpec does NOT match on phase: up (dispatcher gates phase independently)', () => {
    const up: InputEvent = { kind: 'key-held', key: ' ', phase: 'up', ...noMods };
    expect(matchSpec(up, { kind: 'key-held', key: ' ' }, false)).toBe(false);
  });

  it('WheelSpec matches wheel events with matching modifiers', () => {
    const ctrlWheel: InputEvent = { kind: 'wheel', ...noMods, ...noWheelData, ctrlKey: true };
    expect(matchSpec(ctrlWheel, { kind: 'wheel', mods: { ctrl: true } }, false)).toBe(true);
    expect(matchSpec(ctrlWheel, { kind: 'wheel' }, false)).toBe(false);
  });

  it('WheelSpec rejects non-wheel event', () => {
    const e: InputEvent = { kind: 'key', key: 'w', ...noMods };
    expect(matchSpec(e, { kind: 'wheel' }, false)).toBe(false);
  });

  it('ClickSpec matches click events; no target spec matches any target', () => {
    const e: InputEvent = { kind: 'click', target: { foo: 1 }, ...noMods };
    expect(matchSpec(e, { kind: 'click' }, false)).toBe(true);
  });

  it('ClickSpec target predicate receives the affordance, not the DOM target', () => {
    // Symmetric with drag: one predicate describes a piece of chrome for both
    // gestures, and `hit == null` reliably means "not chrome" even though the
    // click event always carries a DOM `target`.
    const e: InputEvent = {
      kind: 'click', target: { dom: true }, affordance: { foo: 1 }, ...noMods,
    };
    expect(matchSpec(e, { kind: 'click', target: { kindOf: (t: any) => t?.foo === 1 } }, false)).toBe(true);
    expect(matchSpec(e, { kind: 'click', target: { kindOf: (t: any) => t?.dom === true } }, false)).toBe(false);

    const bare: InputEvent = { kind: 'click', target: { dom: true }, ...noMods };
    expect(matchSpec(bare, { kind: 'click', target: { kindOf: (t: any) => t == null } }, false)).toBe(true);
  });

  it('ClickSpec with no event target and no spec target — matches', () => {
    const e: InputEvent = { kind: 'click', ...noMods };
    expect(matchSpec(e, { kind: 'click' }, false)).toBe(true);
  });

  it('DragSpec — kind: "drag" matches pointerdown events', () => {
    const e: InputEvent = { kind: 'pointerdown', target: { id: 'x' }, ...noMods };
    expect(matchSpec(e, { kind: 'drag' }, false)).toBe(true);
  });

  it('DragSpec target predicate gates when present', () => {
    // For drag specs, `kindOf` receives the `affordance` field from the
    // pointerdown event, NOT the raw DOM target. This aligns `kindOf` with
    // `InvocationCtx.drag.affordance` so predicates like
    // `hit => hit?.kind.startsWith('handle:')` work without a kind registry.
    const e: InputEvent = { kind: 'pointerdown', affordance: { kind: 'handle:top-left' }, ...noMods };
    expect(matchSpec(e, { kind: 'drag', target: { kindOf: (t: any) => t?.kind === 'handle:top-left' } }, false)).toBe(true);
    expect(matchSpec(e, { kind: 'drag', target: { kindOf: (t: any) => t?.kind === 'rotate-handle' } }, false)).toBe(false);
    // When no affordance is present, kindOf receives undefined.
    const eNoAffordance: InputEvent = { kind: 'pointerdown', ...noMods };
    expect(matchSpec(eNoAffordance, { kind: 'drag', target: { kindOf: (t: any) => t === undefined } }, false)).toBe(true);
    expect(matchSpec(eNoAffordance, { kind: 'drag', target: { kindOf: (t: any) => !!t } }, false)).toBe(false);
  });

  it('PointerDownSpec matches only the eager press dispatch', () => {
    const press: InputEvent = { kind: 'pointerdown', stage: 'press', ...noMods };
    const buffered: InputEvent = { kind: 'pointerdown', ...noMods };
    expect(matchSpec(press, { kind: 'pointerDown' }, false)).toBe(true);
    expect(matchSpec(buffered, { kind: 'pointerDown' }, false)).toBe(false);
  });

  it('DragSpec ignores the eager press dispatch', () => {
    // The two dispatches come from one physical press. If both matched, the
    // press would fire its pointerDown binding AND open its drag handle.
    const press: InputEvent = { kind: 'pointerdown', stage: 'press', ...noMods };
    expect(matchSpec(press, { kind: 'drag' }, false)).toBe(false);
  });

  it('PointerDownSpec gates on the affordance, like drag does', () => {
    const e: InputEvent = {
      kind: 'pointerdown',
      stage: 'press',
      affordance: { kind: 'handle:top-left' },
      ...noMods,
    };
    expect(matchSpec(e, { kind: 'pointerDown', target: { kindOf: (t: any) => t?.kind === 'handle:top-left' } }, false)).toBe(true);
    expect(matchSpec(e, { kind: 'pointerDown', target: { kindOf: (t: any) => t?.kind === 'rotate-handle' } }, false)).toBe(false);
  });

  it('PointerDownSpec takes strict modifiers, and `optional` widens them', () => {
    // Load-bearing for select: its classifier must fire on a shift-extend
    // click as well as a plain one, so it opts every modifier into 'optional'
    // rather than relying on the strict default.
    const shifted: InputEvent = { kind: 'pointerdown', stage: 'press', ...noMods, shiftKey: true };
    expect(matchSpec(shifted, { kind: 'pointerDown' }, false)).toBe(false);
    expect(matchSpec(shifted, { kind: 'pointerDown', mods: { shift: true } }, false)).toBe(true);
    expect(matchSpec(shifted, { kind: 'pointerDown', mods: { shift: 'optional' } }, false)).toBe(true);
    const plain: InputEvent = { kind: 'pointerdown', stage: 'press', ...noMods };
    expect(matchSpec(plain, { kind: 'pointerDown', mods: { shift: 'optional' } }, false)).toBe(true);
    expect(matchSpec(plain, { kind: 'pointerDown', mods: { shift: true } }, false)).toBe(false);
  });

  it('MultiTouchSpec matches when fingers count matches', () => {
    const e: InputEvent = { kind: 'multitouch', fingers: 2, ...noMods };
    expect(matchSpec(e, { kind: 'multiTouch', fingers: 2 }, false)).toBe(true);
    expect(matchSpec(e, { kind: 'multiTouch', fingers: 3 }, false)).toBe(false);
  });

  it('TargetSpec string forms return false when bodyTarget is absent (no kind registry yet)', () => {
    const e: InputEvent = { kind: 'click', target: 'anything', ...noMods };
    expect(matchSpec(e, { kind: 'click', target: 'selected-body' as any }, false)).toBe(false);
  });

  it('mod: true in KeySpec matches correctly on mac vs non-mac', () => {
    const macE: InputEvent = { kind: 'key', key: 's', ...noMods, metaKey: true };
    const winE: InputEvent = { kind: 'key', key: 's', ...noMods, ctrlKey: true };
    expect(matchSpec(macE, { kind: 'key', key: 's', mods: { mod: true } }, true)).toBe(true);
    expect(matchSpec(macE, { kind: 'key', key: 's', mods: { mod: true } }, false)).toBe(false);
    expect(matchSpec(winE, { kind: 'key', key: 's', mods: { mod: true } }, false)).toBe(true);
    expect(matchSpec(winE, { kind: 'key', key: 's', mods: { mod: true } }, true)).toBe(false);
  });
});

describe('matchSpec — wheel direction', () => {
  const baseEvent: InputEvent = { kind: 'wheel', ...noMods, ...noWheelData };

  it('direction: "up" matches deltaY < 0 only', () => {
    const spec = { kind: 'wheel' as const, direction: 'up' as const };
    expect(matchSpec({ ...baseEvent, deltaY: -3 }, spec, false)).toBe(true);
    expect(matchSpec({ ...baseEvent, deltaY:  3 }, spec, false)).toBe(false);
  });

  it('direction: "down" matches deltaY > 0 only', () => {
    const spec = { kind: 'wheel' as const, direction: 'down' as const };
    expect(matchSpec({ ...baseEvent, deltaY:  3 }, spec, false)).toBe(true);
    expect(matchSpec({ ...baseEvent, deltaY: -3 }, spec, false)).toBe(false);
  });

  it('direction: "*" (or absent) matches both signs', () => {
    const specStar = { kind: 'wheel' as const, direction: '*' as const };
    const specAbsent = { kind: 'wheel' as const };
    for (const spec of [specStar, specAbsent]) {
      expect(matchSpec({ ...baseEvent, deltaY: -3 }, spec, false)).toBe(true);
      expect(matchSpec({ ...baseEvent, deltaY:  3 }, spec, false)).toBe(true);
    }
  });
});

describe('matchSpec — contextMenu', () => {
  it('matches a bare contextmenu event', () => {
    const spec = { kind: 'contextMenu' as const };
    const e = { kind: 'contextmenu' as const, target: undefined, ...noMods, bodyTarget: 'empty' as const };
    expect(matchSpec(e, spec, false)).toBe(true);
  });

  it('respects target on contextmenu', () => {
    const spec = { kind: 'contextMenu' as const, target: 'empty' as const };
    const onEmpty = { kind: 'contextmenu' as const, target: undefined, ...noMods, bodyTarget: 'empty' as const };
    const onBody  = { kind: 'contextmenu' as const, target: undefined, ...noMods, bodyTarget: 'selected-body' as const };
    expect(matchSpec(onEmpty, spec, false)).toBe(true);
    expect(matchSpec(onBody,  spec, false)).toBe(false);
  });

  it('respects modifiers on contextmenu', () => {
    const spec = { kind: 'contextMenu' as const, mods: { shift: true } };
    const plain   = { kind: 'contextmenu' as const, target: undefined, ...noMods, bodyTarget: 'empty' as const };
    const shifted = { ...plain, shiftKey: true };
    expect(matchSpec(plain,   spec, false)).toBe(false);
    expect(matchSpec(shifted, spec, false)).toBe(true);
  });
});

describe('matchSpec — multiTouchTap', () => {
  it('matches a multitouchtap with the right fingers count', () => {
    const spec = { kind: 'multiTouchTap' as const, fingers: 2 };
    const e = { kind: 'multitouchtap' as const, fingers: 2, ...noMods };
    expect(matchSpec(e, spec, false)).toBe(true);
  });

  it('rejects wrong fingers count', () => {
    const spec = { kind: 'multiTouchTap' as const, fingers: 3 };
    const e = { kind: 'multitouchtap' as const, fingers: 2, ...noMods };
    expect(matchSpec(e, spec, false)).toBe(false);
  });

  it('respects modifiers', () => {
    const spec = { kind: 'multiTouchTap' as const, fingers: 2, mods: { shift: true } };
    const plain = { kind: 'multitouchtap' as const, fingers: 2, ...noMods };
    const shifted = { ...plain, shiftKey: true };
    expect(matchSpec(plain,   spec, false)).toBe(false);
    expect(matchSpec(shifted, spec, false)).toBe(true);
  });
});

describe('matchPhase', () => {
  const polygonEngaged: PhaseContext = { selfChannel: 'polygon', engagedChannels: new Set(['polygon']) };
  const polygonIdle:    PhaseContext = { selfChannel: 'polygon', engagedChannels: new Set() };
  const otherEngaged:   PhaseContext = { selfChannel: 'polygon', engagedChannels: new Set(['rect']) };
  const noSelf:         PhaseContext = { selfChannel: null,       engagedChannels: new Set(['polygon']) };

  it('omitted spec always matches', () => {
    expect(matchPhase(undefined, polygonEngaged)).toBe(true);
    expect(matchPhase(undefined, polygonIdle)).toBe(true);
  });

  it('shorthand "engaged" gates on self engagement', () => {
    expect(matchPhase('engaged', polygonEngaged)).toBe(true);
    expect(matchPhase('engaged', polygonIdle)).toBe(false);
    // Another tool engaged ≠ self engaged.
    expect(matchPhase('engaged', otherEngaged)).toBe(false);
  });

  it('shorthand "initial" gates on self idle', () => {
    expect(matchPhase('initial', polygonEngaged)).toBe(false);
    expect(matchPhase('initial', polygonIdle)).toBe(true);
    expect(matchPhase('initial', otherEngaged)).toBe(true);
  });

  it('shorthand "*" always matches when self is set', () => {
    expect(matchPhase('*', polygonEngaged)).toBe(true);
    expect(matchPhase('*', polygonIdle)).toBe(true);
  });

  it('"&" with no selfChannel never matches', () => {
    expect(matchPhase('engaged', noSelf)).toBe(false);
    expect(matchPhase('initial', noSelf)).toBe(false);
    expect(matchPhase('*', noSelf)).toBe(false);
  });

  it('named channel resolves to that tool id', () => {
    expect(matchPhase([{ channel: 'rect', phase: 'engaged' }], otherEngaged)).toBe(true);
    expect(matchPhase([{ channel: 'rect', phase: 'engaged' }], polygonEngaged)).toBe(false);
    expect(matchPhase([{ channel: 'polygon', phase: 'engaged' }], polygonEngaged)).toBe(true);
  });

  it('"*" channel matches any-tool engagement', () => {
    expect(matchPhase([{ channel: '*', phase: 'engaged' }], polygonEngaged)).toBe(true);
    expect(matchPhase([{ channel: '*', phase: 'engaged' }], otherEngaged)).toBe(true);
    expect(matchPhase([{ channel: '*', phase: 'engaged' }], polygonIdle)).toBe(false);
    expect(matchPhase([{ channel: '*', phase: 'initial' }], polygonIdle)).toBe(true);
    expect(matchPhase([{ channel: '*', phase: 'initial' }], polygonEngaged)).toBe(false);
    expect(matchPhase([{ channel: '*', phase: '*' }], noSelf)).toBe(true);
  });

  it('atom list has union (any-of) semantics', () => {
    const spec = [
      { channel: 'rect' as const, phase: 'engaged' as const },
      { channel: 'ellipse' as const, phase: 'engaged' as const },
    ];
    expect(matchPhase(spec, otherEngaged)).toBe(true);                       // rect engaged
    expect(matchPhase(spec, { selfChannel: null, engagedChannels: new Set(['ellipse']) })).toBe(true);
    expect(matchPhase(spec, polygonIdle)).toBe(false);                       // neither
  });
});

describe('matchSpec — drop / paste', () => {
  const mods = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };
  const png = { kind: 'file' as const, mime: 'image/png', file: {} as File };
  const txt = { kind: 'string' as const, mime: 'text/plain', text: 'hi' };

  it('drop spec matches a drop event', () => {
    expect(matchSpec({ kind: 'drop', items: [png], ...mods }, { kind: 'drop' }, false)).toBe(true);
  });

  it('drop spec does not match a paste event (and vice versa)', () => {
    expect(matchSpec({ kind: 'paste', items: [png], ...mods }, { kind: 'drop' }, false)).toBe(false);
    expect(matchSpec({ kind: 'drop', items: [png], ...mods }, { kind: 'paste' }, false)).toBe(false);
  });

  it('types filters by MIME glob — any item matching any glob', () => {
    expect(matchSpec({ kind: 'drop', items: [txt], ...mods }, { kind: 'drop', types: ['image/*'] }, false)).toBe(false);
    expect(matchSpec({ kind: 'drop', items: [txt, png], ...mods }, { kind: 'drop', types: ['image/*'] }, false)).toBe(true);
    expect(matchSpec({ kind: 'drop', items: [png], ...mods }, { kind: 'drop', types: ['image/png'] }, false)).toBe(true);
    expect(matchSpec({ kind: 'drop', items: [png], ...mods }, { kind: 'drop', types: ['image/jpeg'] }, false)).toBe(false);
  });

  it('paste spec honors mods', () => {
    const shifted = { ...mods, shiftKey: true };
    expect(matchSpec({ kind: 'paste', items: [png], ...shifted }, { kind: 'paste' }, false)).toBe(false);
    expect(matchSpec({ kind: 'paste', items: [png], ...shifted }, { kind: 'paste', mods: { shift: true } }, false)).toBe(true);
  });
});

describe('matchSpec — phase gate', () => {
  const wheelEv = { kind: 'wheel' as const, ...noMods, ...noWheelData };
  const polygonEngaged: PhaseContext = { selfChannel: 'polygon', engagedChannels: new Set(['polygon']) };
  const polygonIdle:    PhaseContext = { selfChannel: 'polygon', engagedChannels: new Set() };

  it('spec without phase ignores the ctx', () => {
    const spec = { kind: 'wheel' as const };
    expect(matchSpec(wheelEv, spec, false, polygonIdle)).toBe(true);
    expect(matchSpec(wheelEv, spec, false, polygonEngaged)).toBe(true);
    expect(matchSpec(wheelEv, spec, false)).toBe(true);  // no ctx supplied
  });

  it('phase: "engaged" matches only when self is engaged', () => {
    const spec = { kind: 'wheel' as const, phase: 'engaged' as const };
    expect(matchSpec(wheelEv, spec, false, polygonEngaged)).toBe(true);
    expect(matchSpec(wheelEv, spec, false, polygonIdle)).toBe(false);
  });

  it('phase: "initial" matches only when self is idle', () => {
    const spec = { kind: 'wheel' as const, phase: 'initial' as const };
    expect(matchSpec(wheelEv, spec, false, polygonEngaged)).toBe(false);
    expect(matchSpec(wheelEv, spec, false, polygonIdle)).toBe(true);
  });

  it('phase gate runs alongside mods gate', () => {
    const spec = { kind: 'wheel' as const, phase: 'engaged' as const, mods: { mod: true } };
    const cmdWheel = { ...wheelEv, ctrlKey: true };
    // Engaged + cmd held: passes both.
    expect(matchSpec(cmdWheel, spec, false, polygonEngaged)).toBe(true);
    // Engaged but no cmd: mod gate fails.
    expect(matchSpec(wheelEv, spec, false, polygonEngaged)).toBe(false);
    // Cmd held but idle: phase gate fails.
    expect(matchSpec(cmdWheel, spec, false, polygonIdle)).toBe(false);
  });
});

describe('matchTarget — affordance: string form', () => {
  it('matches the affordance hit whose kind equals the suffix', () => {
    expect(matchTarget({ kind: 'rotate-handle' }, 'affordance:rotate-handle')).toBe(true);
  });

  it('does not match a different affordance kind', () => {
    expect(matchTarget({ kind: 'handle:top-left' }, 'affordance:rotate-handle')).toBe(false);
  });

  it('does not match when there is no affordance hit', () => {
    expect(matchTarget(null, 'affordance:rotate-handle')).toBe(false);
    expect(matchTarget(undefined, 'affordance:rotate-handle')).toBe(false);
  });

  it('does not match a hit whose kind is not a string', () => {
    expect(matchTarget({ kind: 7 }, 'affordance:7')).toBe(false);
  });

  it('matches parameterized kinds exactly, including the parameter', () => {
    expect(matchTarget({ kind: 'anchor:3' }, 'affordance:anchor:3')).toBe(true);
    expect(matchTarget({ kind: 'anchor:3' }, 'affordance:anchor')).toBe(false);
  });

  it('matches a registered layer hit by its layer:<id> kind', () => {
    expect(matchTarget({ kind: 'layer:weasel-hud' }, 'affordance:layer:weasel-hud')).toBe(true);
  });
});

describe('matchTarget — kind: string form', () => {
  it('matches the body kind regardless of selection state', () => {
    expect(matchTarget(null, 'kind:text', 'unselected-body', 'text')).toBe(true);
    expect(matchTarget(null, 'kind:text', 'selected-body', 'text')).toBe(true);
  });

  it('does not match a different body kind', () => {
    expect(matchTarget(null, 'kind:text', 'selected-body', 'rect')).toBe(false);
  });

  it('does not match when the body kind is unknown', () => {
    expect(matchTarget(null, 'kind:text', 'selected-body', undefined)).toBe(false);
  });

  it('does not match empty canvas', () => {
    expect(matchTarget(null, 'kind:text', 'empty', undefined)).toBe(false);
  });

  it(':selected suffix additionally requires the body to be selected', () => {
    expect(matchTarget(null, 'kind:text:selected', 'selected-body', 'text')).toBe(true);
    expect(matchTarget(null, 'kind:text:selected', 'unselected-body', 'text')).toBe(false);
  });

  it(':selected suffix still requires the kind to match', () => {
    expect(matchTarget(null, 'kind:text:selected', 'selected-body', 'rect')).toBe(false);
  });

  it('treats a kind containing colons as part of the kind, not the :selected suffix', () => {
    expect(matchTarget(null, 'kind:app:note', 'unselected-body', 'app:note')).toBe(true);
    expect(matchTarget(null, 'kind:app:note:selected', 'selected-body', 'app:note')).toBe(true);
    expect(matchTarget(null, 'kind:app:note:selected', 'unselected-body', 'app:note')).toBe(false);
  });
});

describe('matchSpec — bodyKind threading', () => {
  it('a click spec resolves kind: against the event bodyKind', () => {
    const spec = { kind: 'click' as const, target: 'kind:text' as const };
    const onText = {
      kind: 'click' as const, ...noMods,
      bodyTarget: 'unselected-body' as const, bodyKind: 'text',
    };
    const onRect = { ...onText, bodyKind: 'rect' };
    expect(matchSpec(onText, spec, false)).toBe(true);
    expect(matchSpec(onRect, spec, false)).toBe(false);
  });

  it('a drag spec resolves affordance: against the event affordance', () => {
    const spec = { kind: 'drag' as const, target: 'affordance:rotate-handle' as const };
    const onRing = {
      kind: 'pointerdown' as const, ...noMods,
      affordance: { kind: 'rotate-handle' },
    };
    const onCorner = { ...onRing, affordance: { kind: 'handle:top-left' } };
    expect(matchSpec(onRing, spec, false)).toBe(true);
    expect(matchSpec(onCorner, spec, false)).toBe(false);
  });

  it('a doubleClick spec resolves kind: against the event bodyKind', () => {
    const spec = { kind: 'doubleClick' as const, target: 'kind:text:selected' as const };
    const e = {
      kind: 'doubleclick' as const, target: undefined, ...noMods,
      bodyTarget: 'selected-body' as const, bodyKind: 'text',
    };
    expect(matchSpec(e, spec, false)).toBe(true);
    expect(matchSpec({ ...e, bodyTarget: 'unselected-body' as const }, spec, false)).toBe(false);
  });

  it('a contextMenu spec resolves kind: against the event bodyKind', () => {
    const spec = { kind: 'contextMenu' as const, target: 'kind:rect' as const };
    const e = {
      kind: 'contextmenu' as const, target: undefined, ...noMods,
      bodyTarget: 'unselected-body' as const, bodyKind: 'rect',
    };
    expect(matchSpec(e, spec, false)).toBe(true);
    expect(matchSpec({ ...e, bodyKind: 'ellipse' }, spec, false)).toBe(false);
  });

  it('a pointerDown spec resolves affordance: against the event affordance', () => {
    const spec = { kind: 'pointerDown' as const, target: 'affordance:layer:weasel-hud' as const };
    const e = {
      kind: 'pointerdown' as const, stage: 'press' as const, ...noMods,
      affordance: { kind: 'layer:weasel-hud' },
    };
    expect(matchSpec(e, spec, false)).toBe(true);
    expect(matchSpec({ ...e, affordance: undefined }, spec, false)).toBe(false);
  });
});

describe('mimeMatchesGlob / matchIngestTypes — edge cases', () => {
  it('bare * matches anything', () => {
    expect(mimeMatchesGlob('image/png', '*')).toBe(true);
    expect(mimeMatchesGlob('text/plain', '*')).toBe(true);
  });

  it('*/* matches anything', () => {
    expect(mimeMatchesGlob('application/pdf', '*/*')).toBe(true);
  });

  it('image/* prefix-matches image subtypes', () => {
    expect(mimeMatchesGlob('image/png', 'image/*')).toBe(true);
    expect(mimeMatchesGlob('image/jpeg', 'image/*')).toBe(true);
    expect(mimeMatchesGlob('text/plain', 'image/*')).toBe(false);
  });

  it('case-insensitive: IMAGE/PNG item matches image/* glob', () => {
    expect(mimeMatchesGlob('IMAGE/PNG', 'image/*')).toBe(true);
    expect(mimeMatchesGlob('image/png', 'IMAGE/*')).toBe(true);
  });

  it('matchIngestTypes: empty types [] matches anything (same as omitted)', () => {
    expect(matchIngestTypes([{ mime: 'image/png' }], [])).toBe(true);
    expect(matchIngestTypes([{ mime: 'text/plain' }], [])).toBe(true);
    expect(matchIngestTypes([], [])).toBe(true);
  });

  it('matchIngestTypes: undefined types matches anything', () => {
    expect(matchIngestTypes([{ mime: 'image/png' }], undefined)).toBe(true);
  });

  it('matchIngestTypes: empty items [] fails a typed spec', () => {
    expect(matchIngestTypes([], ['image/*'])).toBe(false);
  });

  it('matchIngestTypes: empty items [] matches untyped spec', () => {
    expect(matchIngestTypes([], undefined)).toBe(true);
    expect(matchIngestTypes([], [])).toBe(true);
  });
});
