import { useId, useMemo, type SVGProps } from 'react';
import { useIconGlyph } from '@weasel-js/core';
import type { IconGlyph, IconRef } from '@weasel-js/icons';
import { ICON_SLOTS, inset } from './layers';
import { IS_DEV, PLACEHOLDER_BODY, warnMissing } from './placeholder';

/** Shared prop shape for the icon set. Color comes from the surrounding
 *  `color` CSS property — every glyph strokes in `currentColor`. */
export interface IconProps {
  className?: string;
  /** Rendered pixel size, applied to both width and height. Defaults to 20. */
  size?: number;
  /** Accessible name. Omit inside a button that already labels itself; the
   *  glyph is then `aria-hidden`. */
  label?: string;
  /** Shade the region the glyph encloses, in the same `currentColor` at
   *  `fillOpacity`. Ignored by a glyph with no enclosed region — a spiral, or a
   *  function with poles — so a caller can set it across a set without checking. */
  filled?: boolean;
  /** Tint strength for `filled`. */
  fillOpacity?: number;
  /** A second, small glyph set in the lower right corner, with this one cleared from around it: a plus on what a
   *  press adds, a minus on what it takes away. */
  mark?: IconRef;
}

/** True when `filled` will shade this glyph. */
export const isFillable = (glyph: IconGlyph | undefined): boolean => glyph?.fill !== undefined;

const SVG_BASE: SVGProps<SVGSVGElement> = {
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

/** Renders the glyph the icon registry in scope holds for `name`. A name it lacks draws `UnknownIcon`'s
 *  placeholder in dev, warning once, and nothing in production. */
export function Icon({
  name,
  className,
  size = 20,
  label,
  filled = false,
  fillOpacity = 0.16,
  mark,
}: IconProps & { name: IconRef }) {
  const glyph = useIconGlyph(name);
  const markGlyph = useIconGlyph(mark);
  const maskId = useId();
  if (!glyph) warnMissing(name);
  if (mark && !markGlyph) warnMissing(mark);
  const shade = filled && glyph?.fill ? glyph.fill : '';
  const body = glyph ? shade + glyph.body : PLACEHOLDER_BODY;
  const html = markGlyph ? inset(body, markGlyph.body, ICON_SLOTS.mark, maskId) : body;
  // React 19 rewrites innerHTML whenever this object's identity changes, and a
  // rewrite during a press removes the node pointerdown hit, so no click follows.
  const markup = useMemo(() => ({ __html: html }), [html]);
  if (!glyph && !IS_DEV) return null;
  return (
    <svg
      {...SVG_BASE}
      className={className}
      width={size}
      height={size}
      // The shade is drawn first so the stroke sits on top of it, and the tint
      // rides on the root: the stroked paths inherit `fill="none"`, so a fill
      // opacity here reaches only the shade.
      fillOpacity={shade ? fillOpacity : undefined}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      // Glyph bodies come from the registered tables, which gen:icons writes
      // from each package's icons/ definitions.
      dangerouslySetInnerHTML={markup}
    />
  );
}
