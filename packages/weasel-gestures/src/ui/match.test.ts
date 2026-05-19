import { describe, it, expect } from 'vitest';
import {
  matchModifiers,
  matchKey,
  matchSpec,
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

  it('ClickSpec target predicate gates when present', () => {
    const e: InputEvent = { kind: 'click', target: { foo: 1 }, ...noMods };
    expect(matchSpec(e, { kind: 'click', target: { kindOf: (t: any) => t.foo === 1 } }, false)).toBe(true);
    expect(matchSpec(e, { kind: 'click', target: { kindOf: (t: any) => t.foo === 2 } }, false)).toBe(false);
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
