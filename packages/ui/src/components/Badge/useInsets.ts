import { useLayoutEffect, useMemo, useState, type RefObject } from 'react';
import type { ShapeInsets } from './types';
import type { BaseModule, BaseSampler } from './bases/types';
import { fitInsets, outlinePoints } from './bases/inscribedRect';
import { inwardReach } from './composeOutline';
import type { BadgeEffectSpec } from './effects';
import { cssPx } from '../../cssPx';

const NONE: ShapeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const SIDES = ['top', 'right', 'bottom', 'left'] as const;

interface InsetSource<P> {
  insets?: ShapeInsets | ((params: P) => ShapeInsets);
  fitsContent?: boolean;
  build?: BaseModule<P>['build'];
}

/** The content's layout size, and the padding its badge has apart from the insets, in CSS px. */
interface Measured { w: number; h: number; pad: ShapeInsets }

const same = (a: Measured, b: Measured) =>
  a.w === b.w && a.h === b.h && SIDES.every((side) => a.pad[side] === b.pad[side]);

/** The padding of `badge` that its `--badge-inset-*` properties did not put there. */
function ownPadding(badge: HTMLElement): ShapeInsets {
  const cs = getComputedStyle(badge);
  const side = (name: typeof SIDES[number], computed: string) =>
    Math.max(0, cssPx(computed) - cssPx(badge.style.getPropertyValue(`--badge-inset-${name}`)));
  return {
    top: side('top', cs.paddingTop),
    right: side('right', cs.paddingRight),
    bottom: side('bottom', cs.paddingBottom),
    left: side('left', cs.paddingLeft),
  };
}

function useMeasured(ref: RefObject<HTMLElement | null>, enabled: boolean): Measured | null {
  const [measured, setMeasured] = useState<Measured | null>(null);
  useLayoutEffect(() => {
    const el = enabled ? ref.current : null;
    const badge = el?.parentElement;
    if (!el || !badge) return;
    const set = (w: number, h: number) => {
      if (w <= 0 || h <= 0) return;
      const next = { w, h, pad: ownPadding(badge) };
      setMeasured((was) => (was && same(was, next) ? was : next));
    };
    const r = el.getBoundingClientRect();
    set(r.width, r.height);
    if (typeof ResizeObserver === 'undefined') return;
    // The observer's size is the layout's own, where a bounding rect is scaled by any transform.
    const ro = new ResizeObserver(([entry]) => {
      const box = entry.borderBoxSize?.[0];
      if (box) set(box.inlineSize, box.blockSize);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, enabled]);
  return enabled ? measured : null;
}

/** What moves a base's outline off the base: its effects, and its `bloat` in CSS px. */
export interface Moved { effects?: readonly BadgeEffectSpec[]; bloat: number }

const STILL: Moved = { bloat: 0 };

/**
 * `fitInsets` for `content` on the base `build` makes, `points` its outline in a 100 by 100
 * box, at the least clearance that keeps the content inside the outline `moved` composes.
 * `floor` itself when that already does.
 */
export function fitMoved(
  build: (boxW: number, boxH: number) => BaseSampler,
  points: readonly (readonly [number, number])[],
  content: { w: number; h: number },
  floor: ShapeInsets,
  moved: Moved,
): ShapeInsets {
  let insets = fitInsets(points, content, floor);
  let clear = 0;
  // The clearance only grows, so this ends: nothing asks for more than the furthest move.
  for (;;) {
    const box = { w: content.w + insets.left + insets.right, h: content.h + insets.top + insets.bottom };
    const held = { left: insets.left, top: insets.top, right: insets.left + content.w, bottom: insets.top + content.h };
    // In half pixels, so a change in the outline's length, which sets how many times an effect
    // repeats along it, seldom changes the clearance.
    const need = Math.ceil(inwardReach(build(box.w, box.h), moved.effects, moved.bloat, box, held) * 2) / 2;
    if (need <= clear) return insets;
    clear = need;
    insets = fitInsets(points, content, floor, clear);
  }
}

/**
 * The padding a shape or base adds around the badge's content. A base that `fitsContent` has
 * an outline that dips inside its box by a share of the box, so its declared `insets`
 * stand while they keep the content at `contentRef` clear of the outline, and grow when they do not.
 * `moved` is what the drawn outline adds to the base's own.
 */
export function useInsets<P>(source: InsetSource<P>, params: P, contentRef: RefObject<HTMLElement | null>, moved: Moved = STILL): ShapeInsets {
  const fits = source.fitsContent === true && source.build !== undefined;
  const measured = useMeasured(contentRef, fits);
  const key = fits ? JSON.stringify(params) : '';
  const movedKey = fits ? JSON.stringify(moved) : '';
  const points = useMemo(
    () => (fits ? outlinePoints(source.build!(params, 100, 100)) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `params` is a fresh object every render; `key` is its value.
    [fits, source, key],
  );
  const declared = (typeof source.insets === 'function' ? source.insets(params) : source.insets) ?? NONE;
  const { top, right, bottom, left } = declared;
  const fitted = useMemo(() => {
    if (!points || !measured) return null;
    // The badge's own padding counts toward clearing the outline, so it is fitted with the insets and taken back out.
    const { pad } = measured;
    const floor = { top: top + pad.top, right: right + pad.right, bottom: bottom + pad.bottom, left: left + pad.left };
    const all = fitMoved((w, h) => source.build!(params, w, h), points, measured, floor, moved);
    if (all === floor) return null;
    const less = (a: number, b: number) => Math.round((a - b) * 100) / 100;
    return { top: less(all.top, pad.top), right: less(all.right, pad.right), bottom: less(all.bottom, pad.bottom), left: less(all.left, pad.left) };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `params` and `moved` are fresh objects every render; the keys are their values.
  }, [points, measured, top, right, bottom, left, source, key, movedKey]);
  return fitted ?? declared;
}
