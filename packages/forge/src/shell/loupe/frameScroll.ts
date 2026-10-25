import { scrollerOf } from './trialAt';

/** Where a story's scroller stands, in CSS px. */
export interface ScrollPosition {
  left: number;
  top: number;
}

const ORIGIN: ScrollPosition = { left: 0, top: 0 };

/** Where each isolated trial's frame document last said it stood, by trial id: a kept frame moves to a new host. */
const frames = new Map<string, ScrollPosition>();

const trialOf = (host: HTMLElement) => host.dataset.fgHost ?? '';

/**
 * Records where the frame in `host` stands, and fires `scroll` on the host: its frame scrolls in a document of its
 * own, whose events never reach this one, so the host stands in for the scroller an in-document story has.
 */
export function reportFrameScroll(host: HTMLElement, scroll: ScrollPosition): void {
  frames.set(trialOf(host), { left: scroll.left, top: scroll.top });
  host.dispatchEvent(new Event('scroll'));
}

/** Where the story in `host` stands: its in-document scroller, or the frame document the host holds. */
export function scrollOf(host: HTMLElement): ScrollPosition {
  const scroller = scrollerOf(host);
  if (scroller) return { left: scroller.scrollLeft, top: scroller.scrollTop };
  return frames.get(trialOf(host)) ?? ORIGIN;
}
