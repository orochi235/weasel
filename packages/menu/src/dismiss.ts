/** The listener side of a `Window`: what {@link attachMenuDismiss} attaches to. `E` is the event it hands a press or a wheel. */
export interface MenuDismissTarget<E> {
  addEventListener(type: string, listener: (e: E) => void, options?: boolean | { capture?: boolean; passive?: boolean }): void;
  removeEventListener(type: string, listener: (e: E) => void, options?: boolean | { capture?: boolean }): void;
}

/** What closes an open menu, and how {@link attachMenuDismiss} tells. */
export interface MenuDismissOptions<E> {
  /** Whether a press or wheel event lands outside every panel of the menu. */
  outside(e: E): boolean;
  close(): void;
  /** Close on a press outside. Default true; a host whose own focus already closes the menu on one turns it off. */
  press?: boolean;
  /** Whether a window blur leaves the menu open, read at the blur. */
  keepOnBlur?(): boolean;
}

/**
 * Close a menu on a press or wheel outside it, on `target` losing focus, and on a resize: the triggers every weasel
 * menu shares. Press and wheel listen in the capture phase. Returns a detach.
 */
export function attachMenuDismiss<E>(target: MenuDismissTarget<E>, opts: MenuDismissOptions<E>): () => void {
  const { outside, close, press = true, keepOnBlur } = opts;
  const away = (e: E) => { if (outside(e)) close(); };
  const blur = () => { if (!keepOnBlur?.()) close(); };
  const resize = () => close();
  if (press) target.addEventListener('pointerdown', away, true);
  target.addEventListener('wheel', away, { capture: true, passive: true });
  target.addEventListener('blur', blur);
  target.addEventListener('resize', resize);
  return () => {
    if (press) target.removeEventListener('pointerdown', away, true);
    target.removeEventListener('wheel', away, true);
    target.removeEventListener('blur', blur);
    target.removeEventListener('resize', resize);
  };
}
