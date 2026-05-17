import { expectTypeOf, describe, it } from 'vitest';
import type { ModSpec, GestureSpec, KeySpec, KeyHeldSpec, WheelSpec, ClickSpec, DragSpec, MultiTouchSpec } from './spec';

describe('ModSpec', () => {
  it('all fields optional booleans', () => {
    expectTypeOf<ModSpec>().toEqualTypeOf<
      Partial<{ alt: boolean; ctrl: boolean; meta: boolean; shift: boolean }>
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
