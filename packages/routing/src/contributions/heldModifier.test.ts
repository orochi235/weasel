import { describe, expect, it } from 'vitest';
import { matchSpec } from '@weasel-js/gestures';
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

  it('takes a held Ctrl or Meta down beside `mod` where `mod` stands for the other key, and keeps its own', () => {
    const b = bind({ kind: 'key', key: 'z', mods: { mod: true } });
    const z = (mods: Partial<Record<'ctrlKey' | 'metaKey', boolean>>) =>
      ({ kind: 'key', key: 'z', altKey: false, shiftKey: false, ctrlKey: false, metaKey: false, ...mods }) as const;
    const ctrl = withHeldModifier(b, 'ctrl').spec;
    const meta = withHeldModifier(b, 'meta').spec;
    // Cmd+Z on a Mac with the Ctrl hold down, Ctrl+Z elsewhere with the Meta hold down.
    expect(matchSpec(z({ metaKey: true, ctrlKey: true }), ctrl, true)).toBe(true);
    expect(matchSpec(z({ ctrlKey: true, metaKey: true }), meta, false)).toBe(true);
    // The key `mod` stands for is still required.
    expect(matchSpec(z({ ctrlKey: true }), ctrl, true)).toBe(false);
    expect(matchSpec(z({ ctrlKey: true }), meta, true)).toBe(false);
    expect(matchSpec(z({ metaKey: true }), ctrl, false)).toBe(false);
    expect(withHeldModifier(b, 'shift').spec.mods).toEqual({ mod: true, shift: 'optional' });
  });

  it('keeps a binding whose `mod: false` refuses a held Ctrl or Meta', () => {
    const b = bind({ kind: 'key', key: 'z', mods: { mod: false } });
    expect(withHeldModifier(b, 'meta')).toBe(b);
    expect(withHeldModifier(b, 'ctrl')).toBe(b);
  });

  it('gives the same binding back for the same binding and modifier', () => {
    const b = bind({ kind: 'click' });
    expect(withHeldModifier(b, 'alt')).toBe(withHeldModifier(b, 'alt'));
  });
});
