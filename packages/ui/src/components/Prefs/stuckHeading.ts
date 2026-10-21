/** The section's custom property holding its sticky heading's height, which rows under it read as their `scroll-margin-top`. */
const HEIGHT = '--pref-stuck-height';

/**
 * A ref for a section's sticky heading: keeps the heading's height on the section, so a row scrolled to stops
 * below the heading however many lines its name wraps to, or however tall the control in it stands.
 */
export function stuckHeadingRef(heading: HTMLElement | null): (() => void) | undefined {
  const section = heading?.parentElement;
  if (!heading || !section || typeof ResizeObserver === 'undefined') return undefined;
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
