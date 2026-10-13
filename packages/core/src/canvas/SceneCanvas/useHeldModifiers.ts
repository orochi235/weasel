/** The modifier keys held, for a surface's rule context. */
import { useMemo } from 'react';
import type { ModifierState } from '../../core/modifierState';
import type { RedrawSource } from '../../core/layers/render';
import { useKeyState } from '../../input/useKeyState';

export interface HeldModifiers extends RedrawSource {
  /** Read when a rule is evaluated. The same object until a modifier changes. */
  get(): ModifierState;
}

/** The modifiers held anywhere in the window, a text field included: a rule
 *  is asked about the keyboard, not about where focus is. `subscribe` reports
 *  a modifier going down or up and no other key. */
export function useHeldModifiers(): HeldModifiers {
  const keys = useKeyState({ skipInEditable: false });
  return useMemo(() => ({
    get: keys.modifiers,
    subscribe(listener) {
      let held = keys.modifiers();
      return keys.subscribe(() => {
        const now = keys.modifiers();
        if (now === held) return;
        held = now;
        listener();
      });
    },
  }), [keys]);
}
