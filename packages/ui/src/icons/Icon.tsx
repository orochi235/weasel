import type { SVGProps } from 'react';
import { ICON_PATHS, type IconName } from './paths';

/** Shared prop shape for the icon set. Color comes from the surrounding
 *  `color` CSS property — every glyph strokes in `currentColor`. */
export interface IconProps {
  className?: string;
  /** Rendered pixel size, applied to both width and height. Defaults to 20. */
  size?: number;
  /** Accessible name. Omit inside a button that already labels itself; the
   *  glyph is then `aria-hidden`. */
  label?: string;
}

const SVG_BASE: SVGProps<SVGSVGElement> = {
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

/** Renders one glyph by name. The named components below are the usual way
 *  in; reach for this when the glyph is chosen at runtime. */
export function Icon({ name, className, size = 20, label }: IconProps & { name: IconName }) {
  return (
    <svg
      {...SVG_BASE}
      className={className}
      width={size}
      height={size}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      // Glyph bodies are generated from scripts/icons/ and contain no
      // interpolated input.
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }}
    />
  );
}
