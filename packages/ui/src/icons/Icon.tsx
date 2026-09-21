import type { SVGProps } from 'react';
import { ICON_FILLS, ICON_PATHS, type FillableIconName, type IconName } from './paths';

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
}

/** True when `filled` will shade this glyph. */
export const isFillable = (name: IconName): name is FillableIconName => name in ICON_FILLS;

const SVG_BASE: SVGProps<SVGSVGElement> = {
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

// React 19 rewrites innerHTML whenever this object's identity changes, and a
// rewrite during a press removes the node pointerdown hit, so no click follows.
const markup = new Map<string, { __html: string }>();
const markupFor = (html: string) => {
  let m = markup.get(html);
  if (!m) markup.set(html, (m = { __html: html }));
  return m;
};

/** Renders one glyph by name. The named components below are the usual way
 *  in; reach for this when the glyph is chosen at runtime. */
export function Icon({
  name,
  className,
  size = 20,
  label,
  filled = false,
  fillOpacity = 0.16,
}: IconProps & { name: IconName }) {
  const shade = filled && isFillable(name) ? ICON_FILLS[name] : '';
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
      // Glyph bodies are generated from scripts/icons/ and contain no
      // interpolated input.
      dangerouslySetInnerHTML={markupFor(shade + ICON_PATHS[name])}
    />
  );
}
