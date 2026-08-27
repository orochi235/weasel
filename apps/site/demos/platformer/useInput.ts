import { useEffect, useMemo, useRef } from 'react';
import { resolveParams, useAction } from '@weasel-js/core';
import type { Action } from '@weasel-js/core';

export interface HeldInput {
  left: boolean;
  right: boolean;
  jumpHeld: boolean;
  /** Set for exactly one simulation step after a fresh jump press; the game loop
   *  consumes it by calling `consumeJumpPress`. */
  jumpPressed: boolean;
}

type Slot = 'left' | 'right' | 'jump';

const EMPTY: HeldInput = { left: false, right: false, jumpHeld: false, jumpPressed: false };

/**
 * `key-held` is an edge API: the down opens an ongoing invocation and the up
 * closes it. The demo turns those edges back into the queryable set a character
 * controller needs, because the kit has none.
 */
export function usePlatformerInput(): { current: HeldInput } {
  const held = useRef<HeldInput>({ ...EMPTY });

  const action = useMemo<Action>(
    () => ({
      id: 'platformer.hold',
      label: 'Platformer movement',
      scope: 'hotkey',
      defaultBinding: [
        { spec: { kind: 'key-held', key: ['ArrowLeft', 'a'] }, opts: { params: { slot: 'left' } } },
        { spec: { kind: 'key-held', key: ['ArrowRight', 'd'] }, opts: { params: { slot: 'right' } } },
        { spec: { kind: 'key-held', key: [' ', 'w', 'ArrowUp'] }, opts: { params: { slot: 'jump' } } },
      ],
      invoker: {
        timing: 'ongoing',
        start: (_ctx, opts) => {
          const slot = resolveParams(opts?.params)?.slot as Slot | undefined;
          if (slot === 'jump') {
            if (!held.current.jumpHeld) held.current.jumpPressed = true;
            held.current.jumpHeld = true;
          } else if (slot) {
            held.current[slot] = true;
          }
          return {
            onEnd: () => {
              if (slot === 'jump') held.current.jumpHeld = false;
              else if (slot) held.current[slot] = false;
            },
          };
        },
      },
    }),
    [],
  );

  useAction(action);

  // The dispatcher releases the held keys on blur. `jumpPressed` is a one-shot
  // edge this demo owns, so nothing else clears it if the loop never ran.
  useEffect(() => {
    const clear = () => {
      held.current.jumpPressed = false;
    };
    window.addEventListener('blur', clear);
    return () => window.removeEventListener('blur', clear);
  }, []);

  return held;
}

/** Read the one-step jump edge and clear it. */
export function consumeJumpPress(input: { current: HeldInput }): boolean {
  const pressed = input.current.jumpPressed;
  input.current.jumpPressed = false;
  return pressed;
}
