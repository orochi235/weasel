import { tokenCategory, type TokenCategory, type TokenEntry } from '@weasel-js/ui/components/TokenPanel';
import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';

const listeners = new Set<(name: string) => void>();
/**
 * The token asked for until a panel has marked it, or has looked and lists it nowhere. The panel can mount only
 * after the reveal that turned it on, and the lab can mount it more than once on the way, so a reveal is spent by
 * the mark, not by being heard.
 */
let pending: string | null = null;

/** Asks the CSS vars panel to open at the custom property `name`. */
export function revealVar(name: string): void {
  pending = name;
  for (const fn of [...listeners]) fn(name);
}

/** Calls `fn` with each token asked for, and at once with one asked for that no panel has marked yet. */
export function subscribeReveal(fn: (name: string) => void): () => void {
  listeners.add(fn);
  if (pending !== null) fn(pending);
  return () => {
    listeners.delete(fn);
  };
}

export type RevealTab = 'theme' | 'story';

/** How the panel brings a token into its list: the tab that lists it, and the section it is filed under. */
export type ShowToken = (name: string, tab: RevealTab, category: TokenCategory) => void;

const MARK = 'data-revealed';

/**
 * Answers reveals for a CSS vars panel: brings the token into view through `show`, then marks its row — or its
 * swatch or slider thumb, which carry its name the same way — in `list` and scrolls to it. A token neither tab
 * lists is dropped once the story's frame has reported its variables, and shown when they arrive if it is among them.
 */
export function useRevealToken(
  list: RefObject<HTMLElement | null>,
  tokens: Readonly<Record<RevealTab, readonly TokenEntry[]>>,
  show: ShowToken,
  storyReported: boolean,
): void {
  // The token to mark, until it is marked; a render is asked for, and the mark lands once its row is drawn.
  const asked = useRef<string | null>(null);
  const [, rerender] = useState(0);
  useEffect(
    () =>
      subscribeReveal((name) => {
        const tab = (['theme', 'story'] as const).find((t) => tokens[t].some((token) => token.name === name));
        const token = tab && tokens[tab].find((t) => t.name === name);
        if (!tab || !token) {
          if (storyReported && pending === name) pending = null;
          return;
        }
        show(name, tab, tokenCategory(token));
        asked.current = name;
        rerender((n) => n + 1);
      }),
    [tokens, show, storyReported],
  );
  useLayoutEffect(() => {
    const root = list.current;
    const revealed = asked.current;
    if (!root || revealed === null) return;
    const target = root.querySelector(`[aria-label="${revealed.replace(/["\\]/g, '\\$&')}"]`);
    for (const el of Array.from(root.querySelectorAll(`[${MARK}]`))) if (el !== target) el.removeAttribute(MARK);
    if (!target) return;
    target.setAttribute(MARK, '');
    target.scrollIntoView?.({ block: 'nearest' });
    if (pending === revealed) pending = null;
    asked.current = null;
  });
}
