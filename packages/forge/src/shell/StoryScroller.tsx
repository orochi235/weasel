import { useTrialTitle } from '@weasel-js/labkit';
import { type ReactNode, useState } from 'react';
import { useOverflowing } from './useOverflowing';

/**
 * The story's own box. While its story overflows it is a tab stop, so a keyboard can scroll it, and a region named
 * for the trial, as WCAG asks of a focusable scroller.
 */
export function StoryScroller({ children }: { children: ReactNode }) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const overflowing = useOverflowing(el);
  const title = useTrialTitle();
  return (
    <div
      ref={setEl}
      className="fg-story__scroll"
      {...(overflowing ? { tabIndex: 0, role: 'region', 'aria-label': title ?? 'Story' } : {})}
    >
      {children}
    </div>
  );
}
