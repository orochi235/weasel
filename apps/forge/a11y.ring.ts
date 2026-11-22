/**
 * What the sweep needs from `vitest/browser`, which only a browser test file may import: each shard's
 * file passes its `page` and `userEvent` in.
 */
export interface Browser {
  page: { screenshot(options: { element: Element; save: false }): Promise<string> };
  userEvent: { keyboard(text: string): Promise<unknown> };
}

/**
 * Waits out each of `animations` that will finish on its own: running, finite, and on the document's clock. A paused
 * or idle one, or one driven by scrolling, would never settle the wait.
 */
export const finishing = (animations: readonly Animation[]) =>
  Promise.all(
    animations
      .filter((a) => a.playState === 'running' && a.timeline === document.timeline)
      .filter((a) => a.effect?.getComputedTiming().endTime !== Infinity)
      .map((a) => a.finished.catch(() => {})),
  );

const LOOK = [
  'outline-style', 'outline-width', 'outline-color', 'box-shadow', 'background-color', 'color', 'stroke', 'stroke-width', 'fill',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
];

/** How `el`, its parent and its first child are drawn: a ring may be painted on any of the three. */
const lookOf = (el: Element) =>
  [el, el.parentElement, el.firstElementChild]
    .map((part) => (part ? LOOK.map((p) => getComputedStyle(part).getPropertyValue(p)).join(' ') : ''))
    .join(' | ');

const shown = (el: Element) => {
  const name = el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 30) ?? '';
  return `<${el.tagName.toLowerCase()}${el.getAttribute('role') ? ` role=${el.getAttribute('role')}` : ''}> "${name}"`;
};

/** A picture of what is drawn over `el`'s box and a few pixels around it, where a ring would be. */
async function shotOf(el: Element, browser: Browser): Promise<string> {
  const box = el.getBoundingClientRect();
  const frame = document.createElement('div');
  Object.assign(frame.style, {
    position: 'fixed', pointerEvents: 'none', left: `${box.left - 4}px`, top: `${box.top - 4}px`,
    width: `${box.width + 8}px`, height: `${box.height + 8}px`,
  });
  document.body.append(frame);
  try {
    return await browser.page.screenshot({ element: frame, save: false });
  } finally {
    frame.remove();
  }
}

/**
 * Tabs through `host` from just before it, as a keyboard does, and returns each element Tab reached that is drawn
 * the same focused as not: the same styles on it, its parent and its first child, and failing that the same pixels.
 */
export async function unringed(host: HTMLElement, browser: Browser, max = 40): Promise<string[]> {
  // An autofocused field is read unfocused too.
  (document.activeElement as HTMLElement | null)?.blur();
  const before = new Map<Element, string>();
  // Any element can be a Tab stop (a scroll container, an iframe, a control with no tabindex), so every one is read.
  for (const el of host.querySelectorAll('*')) before.set(el, lookOf(el));
  const start = document.createElement('button');
  start.textContent = 'start';
  host.before(start);
  // A caret blinks: a field would differ between two pictures with no ring at all.
  const still = document.createElement('style');
  still.textContent = '* { caret-color: transparent !important; }';
  document.head.append(still);
  const out: string[] = [];
  const reached = new Set<Element>();
  try {
    start.focus();
    for (let i = 0; i < max; i++) {
      await browser.userEvent.keyboard('{Tab}');
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body || el === start || reached.has(el)) break;
      reached.add(el);
      // A stop in a portal sits between the host's own; the host's stops after it are still judged.
      if (!host.contains(el)) continue;
      // A ring that fades in is read once it has.
      await finishing([el, el.parentElement, el.firstElementChild].flatMap((part) => part?.getAnimations() ?? []));
      const was = before.get(el);
      // A stop that was not there to read before is judged by its pixels alone.
      if (was !== undefined && was !== lookOf(el)) continue;
      const focused = await shotOf(el, browser);
      start.focus();
      // A modal that keeps focus leaves nothing to compare against.
      const left = document.activeElement === start;
      const unfocused = left ? await shotOf(el, browser) : '';
      el.focus();
      if (left && focused === unfocused) out.push(shown(el));
    }
  } finally {
    (document.activeElement as HTMLElement | null)?.blur();
    start.remove();
    still.remove();
  }
  return out;
}
