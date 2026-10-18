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
    expectTypeOf<{ kind: 'key'; key: string }>().toMatchTypeOf<KeySpec>();
    expectTypeOf<{ kind: 'key' }>().not.toMatchTypeOf<KeySpec>();
  });

  it('KeySpec.key accepts a string array', () => {
    expectTypeOf<{ kind: 'key'; key: string[] }>().toMatchTypeOf<KeySpec>();
  });

  it('KeySpec takes its mods as a ModSpec', () => {
    expectTypeOf<KeySpec['mods']>().toEqualTypeOf<ModSpec | undefined>();
  });

  it('KeyHeldSpec is distinct from KeySpec by kind', () => {
    expectTypeOf<KeyHeldSpec>().not.toMatchTypeOf<KeySpec>();
    expectTypeOf<KeySpec>().not.toMatchTypeOf<KeyHeldSpec>();
  });

  it('WheelSpec needs no fields beyond kind + optional mods', () => {
    expectTypeOf<{ kind: 'wheel' }>().toMatchTypeOf<WheelSpec>();
    expectTypeOf<{ kind: 'wheel'; mods: { ctrl: true } }>().toMatchTypeOf<WheelSpec>();
  });

  it('ClickSpec and DragSpec accept optional target', () => {
    expectTypeOf<{ kind: 'click' }>().toMatchTypeOf<ClickSpec>();
    expectTypeOf<{ kind: 'click'; target: 'selected-body' }>().toMatchTypeOf<ClickSpec>();
    expectTypeOf<{ kind: 'drag' }>().toMatchTypeOf<DragSpec>();
    expectTypeOf<{ kind: 'drag'; target: 'kind:rect' }>().toMatchTypeOf<DragSpec>();
  });

  it('MultiTouchSpec requires fingers count', () => {
    expectTypeOf<{ kind: 'multiTouch'; fingers: number }>().toMatchTypeOf<MultiTouchSpec>();
    expectTypeOf<{ kind: 'multiTouch' }>().not.toMatchTypeOf<MultiTouchSpec>();
  });

  it('GestureSpec is the union of all kinds', () => {
    expectTypeOf<GestureSpec['kind']>().toEqualTypeOf<
      | 'key' | 'key-held' | 'wheel' | 'pinch' | 'click' | 'doubleClick' | 'contextMenu' | 'drag'
      | 'pointerDown' | 'hover' | 'longPress' | 'multiTouch' | 'multiTouchTap' | 'drop' | 'carry' | 'paste'
    >();
  });
});
