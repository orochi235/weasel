import { type RefObject, useEffect } from 'react';

const VAR = '--fg-cell-fit';

/**
 * Grows a fullscreen cell's stage past the trial's height when its story needs more. The stage is the trial's height
 * by default (`index.css`), as the story would get alone; this measures what the story's content needs at that height
 * and sets it as the stage's floor, so a document-like story is shown whole while one that fills its box keeps its own
 * scrolling panes. Measuring at the trial's height every time, never at the grown one, is what keeps a story sized by
 * its box from growing it without end.
 */
export function useFullscreenFit(stage: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    const el = stage.current;
    if (!active || !el || typeof ResizeObserver === 'undefined') return;
    const fit = () => {
      el.style.removeProperty(VAR);
      // The border box that shows the content whole: its scroll height plus any horizontal scrollbar.
      const needed = el.scrollHeight + el.offsetHeight - el.clientHeight;
      if (needed > el.offsetHeight) el.style.setProperty(VAR, `${needed}px`);
    };
    // Fitted after the observer's callbacks, not in one: a resize there leaves the cell's own observer undelivered.
    let pending: ReturnType<typeof setTimeout> | undefined;
    const resize = new ResizeObserver(() => {
      clearTimeout(pending);
      pending = setTimeout(fit, 0);
    });
    // The story's boxes, not the stage: a story that fills it resizes with it, and `max()` in the CSS follows the
    // trial's height for one that does not.
    const watch = () => {
      resize.disconnect();
      for (const child of el.children) resize.observe(child);
    };
    const children = new MutationObserver(watch);
    children.observe(el, { childList: true });
    watch();
    return () => {
      clearTimeout(pending);
      children.disconnect();
      resize.disconnect();
      el.style.removeProperty(VAR);
    };
  }, [stage, active]);
}
