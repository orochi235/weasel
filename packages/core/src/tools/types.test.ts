import { describe, it, expect, expectTypeOf } from 'vitest';
import type { Tool } from './types';
import type { GestureBinding } from '../interactions/actions/binding';
import type { CapabilityTag } from '@weasel-js/modes';
import type { Contribution } from '../contributions/types';

describe('Tool.bindings (additive)', () => {
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

describe('Tool.capabilities', () => {
  it('accepts CapabilityTag[] and is optional', () => {
    const tagged: Tool = { id: 'a', eligibility: { focus: true, capabilities: ['creates-selection'] as CapabilityTag[] } };
    const untagged: Tool = { id: 'b', eligibility: { focus: true } };
    expect(tagged.eligibility.capabilities).toEqual(['creates-selection']);
    expect(untagged.eligibility.capabilities).toBeUndefined();
  });
});

describe('Tool is a Contribution', () => {
  it('accepts a focus-declaring tool wherever a contribution is wanted', () => {
    const t: Tool<null> = {
      id: 'rect',
      eligibility: { focus: true, capabilities: ['creates-shapes'] },
      bindings: [],
    };
    const c: Contribution = t;
    expect(c.id).toBe('rect');
  });

  it('accepts a bindings-only entry as a contribution without casting', () => {
    // `createHudTool` used `as unknown as Tool<null>` to get here.
    const c: Contribution = { id: 'weasel-hud', eligibility: { claimed: true }, bindings: [] };
    expect(c.eligibility.claimed).toBe(true);
  });
});
