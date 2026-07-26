/** Internal: shared `<svg>` attributes for built-in tool icons. Not
 *  re-exported from the barrel — consumers pass `IconProps` through the
 *  concrete icon component.
 */
import type { SVGProps } from 'react';

export const ICON_SVG_BASE: SVGProps<SVGSVGElement> = {
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  'aria-hidden': true,
};
