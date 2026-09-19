import { useCallback } from 'react';
import { useKeyState } from '@weasel-js/core';
import type { Input } from './physics';

const LEFT = ['ArrowLeft', 'KeyA'];
const RIGHT = ['ArrowRight', 'KeyD'];
const JUMP = ['Space', 'KeyW', 'ArrowUp'];
const OWNED = [...LEFT, ...RIGHT, ...JUMP];

/** Reads one simulation step's input. Call it once per step: the jump press is
 *  taken by the step that reads it. */
export function usePlatformerInput(): () => Input {
  const keys = useKeyState({ preventDefault: OWNED });
  return useCallback(
    () => ({
      left: keys.isDown(LEFT),
      right: keys.isDown(RIGHT),
      jumpHeld: keys.isDown(JUMP),
      jumpPressed: keys.take(JUMP),
    }),
    [keys],
  );
}
