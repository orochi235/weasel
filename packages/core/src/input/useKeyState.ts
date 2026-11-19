import { type RefObject, useState } from 'react';
import { createKeyState, type KeyState, type KeyStateAttachOptions } from './keyState';
import { useElementEffect } from './useElementEffect';

/** Options for {@link useKeyState}. */
export interface UseKeyStateOptions extends KeyStateAttachOptions {
  /** Scope the poll to keys typed while focus is inside this element — a
   *  canvas host, say. Omit it to poll the whole window. The ref is read
   *  after every render of the calling component, so an element that mounts
   *  later or is swapped for another is picked up then. */
  target?: RefObject<HTMLElement | null>;
}

/** A {@link KeyState} attached for the component's lifetime. Its identity is
 *  stable; read it from a frame loop rather than rendering from it. */
export function useKeyState(options: UseKeyStateOptions = {}): KeyState {
  const [keys] = useState(createKeyState);
  const { target, skipInEditable, preventDefault } = options;
  const owned = preventDefault?.join('\n');

  useElementEffect<HTMLElement | Window>(
    () => (target ? target.current : window),
    (el) => keys.attach(el, {
      ...(skipInEditable !== undefined ? { skipInEditable } : {}),
      ...(owned ? { preventDefault: owned.split('\n') } : {}),
    }),
    [keys, skipInEditable, owned],
  );

  return keys;
}
