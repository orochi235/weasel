import { useLayoutEffect, useRef, useState } from 'react';
import { sameList, watchResize } from '@weasel-js/react';

/** An element's laid-out size in CSS px. */
export interface BoxSize {
  width: number;
  height: number;
}

const NONE: BoxSize = { width: 0, height: 0 };

/** An element's laid-out size, which a CSS transform on it or an ancestor leaves alone. */
export const layoutBox = (el: HTMLElement): BoxSize => ({ width: el.offsetWidth, height: el.offsetHeight });
const same = (a: readonly BoxSize[], b: readonly BoxSize[]): boolean =>
  sameList(a, b, (x, y) => x.width === y.width && x.height === y.height);

/**
 * The size of each element `elements` names, measured once they are laid out
 * and again whenever one resizes or the elements it names change.
 * Empty until the first layout, which lands before the first paint.
 * `untransformed` reads an HTMLElement's layout size, which a CSS transform leaves alone.
 */
export function useBoxes(
  elements: () => readonly (Element | null)[],
  opts?: { untransformed?: boolean },
): readonly BoxSize[] {
  const [boxes, setBoxes] = useState<readonly BoxSize[]>([]);
  const untransformed = opts?.untransformed ?? false;
  const watched = useRef<{ els: readonly (Element | null)[]; untransformed: boolean; stop: () => void } | null>(null);
  // Every commit: a remount can swap an element without changing how many there are.
  useLayoutEffect(() => {
    const els = elements();
    const was = watched.current;
    if (was && was.untransformed === untransformed && sameList(was.els, els)) return;
    was?.stop();
    const measure = (): void => {
      const next = els.map((el) => {
        if (!el) return NONE;
        if (untransformed && el instanceof HTMLElement) return layoutBox(el);
        const r = el.getBoundingClientRect();
        return { width: r.width, height: r.height };
      });
      setBoxes((prev) => (same(prev, next) ? prev : next));
    };
    measure();
    // eslint-disable-next-line weasel/effect-cleanup -- reconciled each commit; the effect below stops it on unmount
    watched.current = { els, untransformed, stop: watchResize(els, measure) };
  });
  useLayoutEffect(() => () => {
    watched.current?.stop();
    watched.current = null;
  }, []);
  return boxes;
}
