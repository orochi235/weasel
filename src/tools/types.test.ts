import { describe, it, expect, expectTypeOf } from 'vitest';
import type { Tool } from './types';
import type { GestureBinding } from '../interactions/actions/binding';

describe('Tool.bindings (Phase 1 additive)', () => {
  it('bindings field is optional and typed when present', () => {
    const t: Pick<Tool<null>, 'id' | 'bindings'> = {
      id: 'demo',
      bindings: [
        { spec: { kind: 'key', key: 'a' }, actionId: 'select-all' },
      ],
    };
    expect(t.bindings?.length).toBe(1);
  });

  it('bindings accepts an array of GestureBinding', () => {
    const bindings: GestureBinding[] = [
      { spec: { kind: 'drag', target: 'selected-body' }, actionId: 'move' },
      { spec: { kind: 'drag', target: 'affordance:handle:bottom-right' }, actionId: 'resize' },
    ];
    expectTypeOf(bindings).toMatchTypeOf<GestureBinding[]>();
  });
});
