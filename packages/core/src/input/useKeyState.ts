import { type RefObject, useState } from 'react';
import { useAttach } from './useAttach';
import { createKeyState, type KeyState, type KeyStateAttachOptions } from './keyState';

/** Options for {@link useKeyState}. */
export interface UseKeyStateOptions extends KeyStateAttachOptions {
  /** Scope the poll to keys typed while focus is inside this element — a
   *  canvas host, say. Omit it to poll the whole window. Read after each
   *  commit, so an element that mounts later is attached when it does. */
  target?: RefObject<HTMLElement | null>;
}

/** A {@link KeyState} attached for the component's lifetime. Its identity is
 *  stable; read it from a frame loop rather than rendering from it. */
export function useKeyState(options: UseKeyStateOptions = {}): KeyState {
  const [keys] = useState(createKeyState);
  const { target, skipInEditable, preventDefault } = options;
  const owned = preventDefault?.join('\n');

  useAttach<Window | HTMLElement>(
    () => (target ? target.current : window),
    (el) => keys.attach(el, {
      ...(skipInEditable !== undefined ? { skipInEditable } : {}),
      ...(owned ? { preventDefault: owned.split('\n') } : {}),
    }),
    [keys, skipInEditable, owned],
  );

  return keys;
}
