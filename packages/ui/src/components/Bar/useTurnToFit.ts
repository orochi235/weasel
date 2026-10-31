import { useCallback, useLayoutEffect, useState } from 'react';

/**
 * Whether a field down a side bar is too wide for it, and so turns to read
 * along the bar: its upright width past the bar's `max-inline-size`.
 * `barClass` finds the bar; outside one, or with no cap, nothing turns. The
 * field's turned styles must all key on its `data-turned` attribute.
 */
export function useTurnToFit(on: boolean, barClass: string): { ref: (el: HTMLElement | null) => void; turned: boolean } {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [wide, setWide] = useState(false);
  const ref = useCallback((node: HTMLElement | null) => setEl(node), []);

  useLayoutEffect(() => {
    if (!on || !el) return undefined;
    const measure = () => {
      const bar = el.closest(`.${barClass}`);
      const cap = bar ? parseFloat(getComputedStyle(bar).maxInlineSize) : NaN;
      // Every turned rule keys on the attribute, so dropping it for one synchronous read gives the upright width,
      // which is what decides; a turned field can be shorter than the cap and still too wide upright.
      const had = el.hasAttribute('data-turned');
      if (had) el.removeAttribute('data-turned');
      const width = el.getBoundingClientRect().width;
      if (had) el.setAttribute('data-turned', '');
      setWide(Number.isFinite(cap) && width > cap + 0.5);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [on, el, barClass]);

  return { ref, turned: on && wide };
}
