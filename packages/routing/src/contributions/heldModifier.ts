import type { GestureSpec, ModSpec } from '@weasel-js/gestures';
import { createPart, getOwn } from '@weasel-js/registry';
import type { GestureBinding } from '../interactions/actions/binding';
import type { HotkeyTrigger } from './types';
import { offhandKeyFor } from '../interactions/actions/toolOffhand';

type Modifier = 'alt' | 'ctrl' | 'meta' | 'shift';

const MODIFIER_OF: Readonly<Record<string, Modifier>> = { Alt: 'alt', Control: 'ctrl', Meta: 'meta', Shift: 'shift' };

/** The modifier an offhand `trigger` holds down, or `null` for any other key. */
export function heldModifierOf(trigger: HotkeyTrigger | undefined): Modifier | null {
  return trigger === undefined ? null : getOwn(MODIFIER_OF, offhandKeyFor(trigger)) ?? null;
}

const loosened = createPart((_binding: GestureBinding): Partial<Record<Modifier, GestureBinding>> => ({}));

/**
 * `binding` as an entry held on `modifier` sees it: a binding that does not
 * name the modifier takes it down, since it is down through every gesture the
 * hold is for. One that names it keeps what it says, so `false` still refuses
 * it; so does one whose `mod` stands for it, on the platform where it does,
 * and `mod: false` refuses it on both.
 * The same binding in gives the same binding out.
 */
export function withHeldModifier(binding: GestureBinding, modifier: Modifier): GestureBinding {
  const mods: Partial<ModSpec> | undefined = binding.spec.mods;
  if (mods?.[modifier] !== undefined) return binding;
  if ((modifier === 'ctrl' || modifier === 'meta') && mods?.mod === false) return binding;
  return loosened(binding)[modifier] ??= {
    ...binding,
    spec: { ...binding.spec, mods: { ...mods, [modifier]: 'optional' } } as GestureSpec,
  };
}
