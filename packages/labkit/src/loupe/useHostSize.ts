import { type RefObject, useEffect, useState } from 'react';
import type { ViewportSize } from '../canvas/worldSpec';

const ZERO: ViewportSize = { width: 0, height: 0 };

/** An element's CSS-pixel box, kept current. `{0, 0}` until it is measured, and
 *  wherever `ResizeObserver` is absent. */
export function useHostSize(ref: RefObject<HTMLElement | null>): ViewportSize {
  const [size, setSize] = useState<ViewportSize>(ZERO);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = (): void => {
      const rect = el.getBoundingClientRect();
      setSize((prev) =>
        prev.width === rect.width && prev.height === rect.height
          ? prev
          : { width: rect.width, height: rect.height },
      );
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return size;
}
