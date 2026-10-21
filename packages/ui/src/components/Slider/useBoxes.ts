import { useLayoutEffect, useState } from 'react';
import { useLatest } from '@weasel-js/core';

/** An element's laid-out size in CSS px. */
export interface Box {
  width: number;
  height: number;
}

const NONE: Box = { width: 0, height: 0 };
const same = (a: readonly Box[], b: readonly Box[]): boolean =>
  a.length === b.length && a.every((box, i) => box.width === b[i]!.width && box.height === b[i]!.height);

/**
 * The size of each element `elements` names, measured once they are laid out
 * and again whenever one resizes. `count` says when the set itself changed.
 * Empty until the first layout, which lands before the first paint.
 * `untransformed` reads an HTMLElement's layout size, which a CSS transform leaves alone.
 */
export function useBoxes(
  elements: () => readonly (Element | null)[],
  count: number,
  opts?: { untransformed?: boolean },
): readonly Box[] {
  const [boxes, setBoxes] = useState<readonly Box[]>([]);
  const read = useLatest(elements);
  const untransformed = opts?.untransformed ?? false;
  useLayoutEffect(() => {
    const measure = (): void => {
      const next = read.current().map((el) => {
        if (!el) return NONE;
        if (untransformed && el instanceof HTMLElement) return { width: el.offsetWidth, height: el.offsetHeight };
        const r = el.getBoundingClientRect();
        return { width: r.width, height: r.height };
      });
      setBoxes((prev) => (same(prev, next) ? prev : next));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    for (const el of read.current()) if (el) ro.observe(el);
    return () => ro.disconnect();
  }, [count, read, untransformed]);
  return boxes;
}
