/** Options for {@link swallowClick} and {@link swallowNextClick}. */
export interface SwallowClickOptions {
  /** Keep the click's default action (a link's navigation, a label's toggle), and only stop it reaching
   *  listeners: for the click a press already reported. Default `false`, which cancels it too. */
  keepDefault?: boolean;
}

/**
 * Swallow the next click on `target`, or inside it, until the returned function is called: the click a drag's
 * release raises, which would otherwise land on whatever the press began on. Listens in the capture phase, once.
 */
export function swallowClick(target: EventTarget, opts: SwallowClickOptions = {}): () => void {
  const swallow = (e: Event): void => {
    e.stopPropagation();
    if (!opts.keepDefault) e.preventDefault();
  };
  target.addEventListener('click', swallow, { capture: true, once: true });
  return () => target.removeEventListener('click', swallow, { capture: true });
}

/**
 * Swallow a click on `target` dispatched in this task: the one the release being handled now raises, if it raises
 * one. A release that raises none lets go before the next task, so it never eats a later, real click.
 */
export function swallowNextClick(target: EventTarget, opts?: SwallowClickOptions): void {
  setTimeout(swallowClick(target, opts), 0);
}
