import { describe, expect, it } from 'vitest';
import type { GestureBinding } from '../interactions/actions/binding';
import { heldModifierOf, withHeldModifier } from './heldModifier';

const bind = (spec: GestureBinding['spec']): GestureBinding => ({ spec, actionId: 'a' });

describe('heldModifierOf', () => {
  it('names the modifier a trigger holds, in either spelling, and nothing for another key', () => {
    expect(heldModifierOf('alt')).toBe('alt');
    expect(heldModifierOf('Control')).toBe('ctrl');
    expect(heldModifierOf('space')).toBeNull();
    expect(heldModifierOf(undefined)).toBeNull();
  });
});

describe('withHeldModifier', () => {
  it('lets a binding that does not name the modifier take it down, and keeps the rest of its mods', () => {
    expect(withHeldModifier(bind({ kind: 'click' }), 'shift').spec.mods).toEqual({ shift: 'optional' });
    expect(withHeldModifier(bind({ kind: 'drag', mods: { alt: true } }), 'shift').spec.mods)
      .toEqual({ alt: true, shift: 'optional' });
  });

  it('keeps what a binding says about the modifier when it names it', () => {
    for (const named of [false, true, 'optional'] as const) {
      const b = bind({ kind: 'click', mods: { alt: named } });
      expect(withHeldModifier(b, 'alt')).toBe(b);
    }
  });

  it('keeps a binding whose `mod` stands for a held Ctrl or Meta', () => {
    const b = bind({ kind: 'key', key: 'z', mods: { mod: true } });
    expect(withHeldModifier(b, 'meta')).toBe(b);
    expect(withHeldModifier(b, 'ctrl')).toBe(b);
    expect(withHeldModifier(b, 'shift').spec.mods).toEqual({ mod: true, shift: 'optional' });
  });

  it('gives the same binding back for the same binding and modifier', () => {
    const b = bind({ kind: 'click' });
    expect(withHeldModifier(b, 'alt')).toBe(withHeldModifier(b, 'alt'));
  });
});
