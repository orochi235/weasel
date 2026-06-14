import { expectTypeOf, describe, it } from 'vitest';
import type { ModSpec, GestureSpec, KeySpec, KeyHeldSpec, WheelSpec, ClickSpec, DragSpec, MultiTouchSpec } from './spec';

describe('ModSpec', () => {
  it('every modifier accepts boolean | "optional"', () => {
    expectTypeOf<ModSpec>().toEqualTypeOf<
      Partial<{
        alt:   boolean | 'optional';
        ctrl:  boolean | 'optional';
        meta:  boolean | 'optional';
        mod:   boolean | 'optional';
        shift: boolean | 'optional';
      }>
    >();
  });
});

describe('GestureSpec', () => {
  it('KeySpec requires key', () => {
    const ok: KeySpec = { kind: 'key', key: 'a' };
    const okWithMods: KeySpec = { kind: 'key', key: 'a', mods: { meta: true } };
    expectTypeOf(ok).toMatchTypeOf<KeySpec>();
    expectTypeOf(okWithMods).toMatchTypeOf<KeySpec>();
  });

  it('KeyHeldSpec is distinct from KeySpec by kind', () => {
    const held: KeyHeldSpec = { kind: 'key-held', key: ' ' };
    expectTypeOf(held).toMatchTypeOf<KeyHeldSpec>();
  });

  it('WheelSpec needs no fields beyond kind + optional mods', () => {
    const ok: WheelSpec = { kind: 'wheel' };
    const withMods: WheelSpec = { kind: 'wheel', mods: { ctrl: true } };
    expectTypeOf(ok).toMatchTypeOf<WheelSpec>();
    expectTypeOf(withMods).toMatchTypeOf<WheelSpec>();
  });

  it('ClickSpec and DragSpec accept optional target', () => {
    const c: ClickSpec = { kind: 'click' };
    const cWithTarget: ClickSpec = { kind: 'click', target: 'selected-body' };
    const d: DragSpec = { kind: 'drag', target: 'kind:rect' };
    expectTypeOf(c).toMatchTypeOf<ClickSpec>();
    expectTypeOf(cWithTarget).toMatchTypeOf<ClickSpec>();
    expectTypeOf(d).toMatchTypeOf<DragSpec>();
  });

  it('MultiTouchSpec requires fingers count', () => {
    const m: MultiTouchSpec = { kind: 'multiTouch', fingers: 2 };
    expectTypeOf(m).toMatchTypeOf<MultiTouchSpec>();
  });

  it('GestureSpec is the union of all kinds', () => {
    const specs: GestureSpec[] = [
      { kind: 'key', key: 'a' },
      { kind: 'key-held', key: ' ' },
      { kind: 'wheel' },
      { kind: 'click' },
      { kind: 'drag' },
      { kind: 'multiTouch', fingers: 2 },
    ];
    expectTypeOf(specs).toMatchTypeOf<GestureSpec[]>();
  });
});

describe('GestureSpec Phase 2 extensions', () => {
  it('KeySpec.key accepts string array (multi-key bindings)', () => {
    const multi: KeySpec = { kind: 'key', key: ['Delete', 'Backspace'] };
    expectTypeOf(multi).toMatchTypeOf<KeySpec>();
  });

  it('ModSpec accepts mod shorthand (meta-or-ctrl)', () => {
    const mods: ModSpec = { mod: true };
    expectTypeOf(mods).toMatchTypeOf<ModSpec>();
  });

  it('ModSpec accepts optional-shift policy', () => {
    const mods: ModSpec = { shift: 'optional' };
    expectTypeOf(mods).toMatchTypeOf<ModSpec>();
  });

  it('ModSpec accepts "optional" on every modifier', () => {
    const allOptional: ModSpec = {
      mod: 'optional', shift: 'optional', alt: 'optional', ctrl: 'optional', meta: 'optional',
    };
    expectTypeOf(allOptional).toMatchTypeOf<ModSpec>();
  });

  it('KeySpec composes the new ModSpec features', () => {
    const optShift: KeySpec = { kind: 'key', key: 'ArrowUp', mods: { shift: 'optional' } };
    const modKey: KeySpec = { kind: 'key', key: 'a', mods: { mod: true } };
    expectTypeOf(optShift).toMatchTypeOf<KeySpec>();
    expectTypeOf(modKey).toMatchTypeOf<KeySpec>();
  });
});
