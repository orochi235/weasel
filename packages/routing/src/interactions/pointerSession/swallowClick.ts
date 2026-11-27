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
    e.stopImmediatePropagation();
    if (!opts.keepDefault) e.preventDefault();
  };
  target.addEventListener('click', swallow, { capture: true, once: true });
  return () => target.removeEventListener('click', swallow, { capture: true });
}

/** How long a release's click is waited for when no press or key comes first. A touch tap's click is its own
 *  input event after the `pointerup`, and on a page with no mobile viewport it waits out the double-tap delay. */
const RELEASE_CLICK_MS = 500;

/**
 * Swallow the click the release being handled now raises, if it raises one: on `target`, until a click comes, the
 * next press or key anywhere in its window, or {@link RELEASE_CLICK_MS}. A real click always follows a press or a key,
 * so a release that raises none never eats one.
 */
export function swallowNextClick(target: EventTarget, opts?: SwallowClickOptions): void {
  const view = viewOf(target);
  const disarm = swallowClick(target, opts);
  const lift = (): void => {
    disarm();
    clearTimeout(timer);
    view.removeEventListener('pointerdown', lift, { capture: true });
    view.removeEventListener('keydown', lift, { capture: true });
  };
  const timer = setTimeout(lift, RELEASE_CLICK_MS);
  view.addEventListener('pointerdown', lift, { capture: true });
  view.addEventListener('keydown', lift, { capture: true });
}

/** The window whose input `target` hears: a node's or a document's, or `target` itself (a window). */
function viewOf(target: EventTarget): EventTarget {
  const n = target as Partial<Node>;
  if (n.nodeType === undefined) return target;
  const doc = n.nodeType === Node.DOCUMENT_NODE ? (target as Document) : n.ownerDocument;
  return doc?.defaultView ?? target;
}
