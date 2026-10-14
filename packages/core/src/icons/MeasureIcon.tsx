import { ICON_SVG_BASE } from './_base';
import type { IconProps } from './types';

/** Ruler — a long bar with hairline ticks hanging from its upper edge, the
 *  middle one longer. Used for `useMeasureTool`. The same drawing as the
 *  `measure` glyph in `@weasel-js/ui`'s set, which core cannot import. */
export default function MeasureIcon({ className, size = 20 }: IconProps) {
  return (
    <svg
      {...ICON_SVG_BASE}
      className={className}
      width={size}
      height={size}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2.6" y="7.4" width="14.8" height="5.2" rx="1.2" />
      <path d="M6 7.4v2.2M9.4 7.4v3M12.8 7.4v2.2" strokeWidth={1} />
    </svg>
  );
}
