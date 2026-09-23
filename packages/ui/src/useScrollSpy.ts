import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

/** One observed section: its id and its top edge, in the container's
 *  coordinates (its `getBoundingClientRect().top` less the container's). */
export interface SectionOffset {
  id: string;
  top: number;
}

/**
 * The section a reader is looking at: the last one whose top edge has passed
 * the container's, within `slack` of it so a heading flush with the top counts
 * as arrived. Null until one has — the settings above the first section belong
 * to the group itself, and marking a section the reader has not reached yet
 * points them at the wrong place.
 *
 * Offsets arrive in document order and are not re-sorted — a caller reading
 * them off the DOM already has them that way, and sorting would hide a
 * measurement that came back wrong.
 */
export function pickActiveSection(
  offsets: readonly SectionOffset[],
  slack = 8,
): string | null {
  let active: string | null = null;
  for (const { id, top } of offsets) {
    if (top - slack > 0) break;
    active = id;
  }
  return active;
}

/** Options for {@link useScrollSpy}. */
export interface UseScrollSpyOptions {
  /** The scrolling element holding the sections. */
  rootRef: RefObject<HTMLElement | null>;
  /** Section element ids, in document order. */
  ids: readonly string[];
  /** Pixels of tolerance at the container's top edge. */
  slack?: number;
}

/** What {@link useScrollSpy} returns. */
export interface ScrollSpy {
  /** Id of the section in view, or null before anything is measured. */
  active: string | null;
  /**
   * Scroll `id` to the container's top and hold that answer until the scroll
   * settles. Without the hold, the scroll the click causes is observed on its
   * way past every intervening section and the rail flickers through them.
   */
  scrollTo: (id: string) => void;
}

/** How long to keep a programmatic scroll's answer when `scrollend` never
 *  arrives — Safari and Firefox have not shipped it. Comfortably longer than a
 *  smooth scroll, short enough that a reader who then scrolls by hand is not
 *  left looking at a stale highlight. */
const SETTLE_MS = 700;

/**
 * Which of a scrolling container's sections is in view, for a navigation rail
 * that follows the reader. Positions are read on the container's own `scroll`
 * event — already throttled to the frame by the browser — rather than through
 * `IntersectionObserver`, so the decision stays a pure function of measured
 * offsets ({@link pickActiveSection}) and is testable apart from the DOM.
 */
export function useScrollSpy(options: UseScrollSpyOptions): ScrollSpy {
  const { rootRef, ids, slack } = options;
  const [active, setActive] = useState<string | null>(null);
  // Set while a programmatic scroll runs: what to report, instead of what the
  // moving container would say.
  const heldRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const releaseRef = useRef<(() => void) | null>(null);
  const key = ids.join('\u0000');

  const measure = useCallback((): void => {
    const root = rootRef.current;
    if (!root) return;
    if (heldRef.current !== null) {
      setActive(heldRef.current);
      return;
    }
    const rootTop = root.getBoundingClientRect().top;
    const offsets: SectionOffset[] = [];
    for (const id of ids) {
      const el = root.querySelector<HTMLElement>(`[data-spy-section="${CSS.escape(id)}"]`);
      if (el) offsets.push({ id, top: el.getBoundingClientRect().top - rootTop });
    }
    setActive(pickActiveSection(offsets, slack));
    // `ids` is compared by content through `key`: a caller deriving the array
    // each render would otherwise resubscribe on every one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootRef, key, slack]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    measure();
    root.addEventListener('scroll', measure, { passive: true });
    return () => root.removeEventListener('scroll', measure);
  }, [rootRef, measure]);

  const scrollTo = useCallback((id: string): void => {
    const root = rootRef.current;
    if (!root) return;
    const el = root.querySelector<HTMLElement>(`[data-spy-section="${CSS.escape(id)}"]`);
    heldRef.current = id;
    setActive(id);
    const release = (): void => {
      heldRef.current = null;
      root.removeEventListener('scrollend', release);
      measure();
    };
    // A scroll interrupted by the next one would otherwise leave its
    // `scrollend` listener behind to fire against a later scroll.
    releaseRef.current?.();
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    releaseRef.current = release;
    timerRef.current = setTimeout(release, SETTLE_MS);
    root.addEventListener('scrollend', release);
    if (!el) return;
    const top = el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop;
    root.scrollTo?.({ top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [rootRef, measure]);

  useEffect(() => () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    releaseRef.current?.();
  }, []);

  return { active, scrollTo };
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
