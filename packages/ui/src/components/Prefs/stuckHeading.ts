/** The section's custom property holding its sticky heading's height, which rows under it read as their `scroll-margin-top`. */
const HEIGHT = '--pref-stuck-height';

/**
 * Keeps a section's sticky heading's height on the section, so a row scrolled to stops below the heading however
 * many lines its name wraps to, or however tall the control in it stands. Returns what undoes it; for `useAttachRef`.
 */
export function trackStuckHeading(heading: HTMLElement): (() => void) | undefined {
  const section = heading.parentElement;
  if (!section || typeof ResizeObserver === 'undefined') return undefined;
  const ro = new ResizeObserver(([entry]) => {
    const height = entry?.borderBoxSize?.[0]?.blockSize ?? heading.offsetHeight;
    section.style.setProperty(HEIGHT, `${height}px`);
  });
  ro.observe(heading);
  return () => {
    ro.disconnect();
    section.style.removeProperty(HEIGHT);
  };
}
