import type { SyntheticEvent } from 'react';

/** `data-*` attributes, which a kit primitive passes through to its element. */
export type DataAttributes = { [data: `data-${string}`]: string | undefined };

/**
 * A handler running the caller's `caller` and then the component's `own`, unless `caller` called
 * `preventDefault()`. How a kit primitive composes a handler it forwards with one it needs itself.
 */
export function composeHandler<E extends SyntheticEvent>(
  caller: ((e: E) => void) | undefined,
  own: ((e: E) => void) | undefined,
): ((e: E) => void) | undefined {
  if (!caller) return own;
  if (!own) return caller;
  return (e) => {
    caller(e);
    if (!e.defaultPrevented) own(e);
  };
}
