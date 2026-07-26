import { describe, it, expectTypeOf } from 'vitest';
import type { GestureBinding } from './binding';

describe('GestureBinding', () => {
  it('requires spec and actionId; opts optional', () => {
    const minimal: GestureBinding = {
      spec: { kind: 'key', key: 'a' },
      actionId: 'select-all',
    };
    const withOpts: GestureBinding = {
      spec: { kind: 'drag', target: 'selected-body' },
      actionId: 'move',
      opts: { behaviors: [] },
    };
    expectTypeOf(minimal).toMatchTypeOf<GestureBinding>();
    expectTypeOf(withOpts).toMatchTypeOf<GestureBinding>();
  });

  it('accepts every GestureSpec variant via the spec field', () => {
    const bindings: GestureBinding[] = [
      { spec: { kind: 'key', key: 'a' }, actionId: 'x' },
      { spec: { kind: 'key-held', key: ' ' }, actionId: 'x' },
      { spec: { kind: 'wheel' }, actionId: 'x' },
      { spec: { kind: 'click', target: 'empty' }, actionId: 'x' },
      { spec: { kind: 'drag', target: 'selected-body' }, actionId: 'x' },
      { spec: { kind: 'multiTouch', fingers: 2 }, actionId: 'x' },
    ];
    expectTypeOf(bindings).toMatchTypeOf<GestureBinding[]>();
  });
});
