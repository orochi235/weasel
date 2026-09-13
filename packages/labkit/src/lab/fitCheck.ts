import { useEffect } from 'react';

/** An element's edges, in the same coordinate space as the bound it is tested against. */
export interface Edges {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

export interface Overshoot<T> {
  item: T;
  /** How far past the bound the item reaches, in px, on whichever axis is worse. */
  by: number;
  axis: 'x' | 'y';
}

/** The item reaching furthest past the bottom or right of `bound`. On a tie the
 *  first item wins, so given document order it names the outermost box. */
export function findOvershoot<T>(
  bound: Edges,
  items: Iterable<{ item: T; edges: Edges }>,
  tolerance = 1,
): Overshoot<T> | null {
  let worst: Overshoot<T> | null = null;
  for (const { item, edges } of items) {
    const y = edges.bottom - bound.bottom;
    const x = edges.right - bound.right;
    const by = Math.max(x, y);
    if (by <= tolerance) continue;
    if (!worst || by > worst.by) worst = { item, by, axis: y >= x ? 'y' : 'x' };
  }
  return worst;
}

function tagAndClasses(el: Element): string {
  return el.tagName.toLowerCase() + [...el.classList].map((c) => `.${c}`).join('');
}

/** `div.lk-shell-body` — the tag and classes, which is what a reader greps for.
 *  A classless element is placed by its nearest classed ancestor. */
export function describeElement(el: Element): string {
  if (el.classList.length > 0) return tagAndClasses(el);
  let up = el.parentElement;
  while (up && up.classList.length === 0) up = up.parentElement;
  return up ? `${tagAndClasses(el)} in ${tagAndClasses(up)}` : tagAndClasses(el);
}

function edgesOf(el: Element): Edges {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, bottom: r.bottom, right: r.right };
}

function* candidates(root: Element): Iterable<{ item: Element; edges: Edges }> {
  yield { item: root, edges: edgesOf(root) };
  for (const el of root.querySelectorAll('*')) yield { item: el, edges: edgesOf(el) };
}

function overflows(el: Element): boolean {
  return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
}

/** Why a mounted lab scrolls, or null when it fits. The document only counts
 *  when the lab is what reaches past the viewport, so a lab embedded in a long
 *  page does not report the page's own scroll. */
export function explainLabScroll(lab: Element, shellBody: Element): string | null {
  if (overflows(shellBody)) {
    const r = shellBody.getBoundingClientRect();
    const bound = {
      top: r.top,
      left: r.left,
      bottom: r.top + shellBody.clientHeight,
      right: r.left + shellBody.clientWidth,
    };
    const hit = findOvershoot(bound, candidates(shellBody));
    return hit
      ? `.lk-shell-body scrolls: ${describeElement(hit.item)} reaches ${Math.round(hit.by)}px past it (${hit.axis})`
      : '.lk-shell-body scrolls';
  }

  const doc = document.scrollingElement ?? document.documentElement;
  if (!overflows(doc)) return null;
  const r = lab.getBoundingClientRect();
  const bound = {
    top: r.top,
    left: r.left,
    bottom: r.top + Math.min(r.height, doc.clientHeight),
    right: r.left + Math.min(r.width, doc.clientWidth),
  };
  const hit = findOvershoot(bound, candidates(lab));
  return hit
    ? `the page scrolls: ${describeElement(hit.item)} reaches ${Math.round(hit.by)}px past the lab's box (${hit.axis})`
    : null;
}

const SETTLE_MS = 300;

/** Dev only: warns once, naming the culprit, when a mounted lab scrolls. */
export function useLabFitWarning(labBody: Element | null): void {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (!labBody || typeof ResizeObserver === 'undefined') return;
    const lab = labBody.closest('.lk-lab');
    const shellBody = labBody.closest('.lk-shell-body');
    if (!lab || !shellBody) return;

    // A shrinking window overflows for a frame or two before the workspace
    // re-lays out, so only overflow that outlasts the resize is reported.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const why = explainLabScroll(lab, shellBody);
        if (!why) return;
        observer.disconnect();
        console.warn(`[labkit] <Lab> should fit its container without scrolling, but ${why}.`);
      }, SETTLE_MS);
    });
    for (const el of [document.documentElement, lab, shellBody, labBody]) observer.observe(el);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [labBody]);
}
