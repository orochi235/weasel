import { type RefObject, useEffect, useState } from 'react';
import { createKeyState, type KeyState, type KeyStateAttachOptions } from './keyState';

export interface UseKeyStateOptions extends KeyStateAttachOptions {
  /** Scope the poll to keys typed while focus is inside this element — a
   *  canvas host, say. Omit it to poll the whole window. */
  target?: RefObject<HTMLElement | null>;
}

/** A {@link KeyState} attached for the component's lifetime. Its identity is
 *  stable; read it from a frame loop rather than rendering from it. */
export function useKeyState(options: UseKeyStateOptions = {}): KeyState {
  const [keys] = useState(createKeyState);
  const { target, skipInEditable, preventDefault } = options;
  const owned = preventDefault?.join('\n');

  useEffect(() => {
    const el = target ? target.current : window;
    if (!el) return;
    return keys.attach(el, {
      ...(skipInEditable !== undefined ? { skipInEditable } : {}),
      ...(owned ? { preventDefault: owned.split('\n') } : {}),
    });
  }, [keys, target, skipInEditable, owned]);

  return keys;
}
