import { ICON_SVG_BASE } from './_base';
import type { IconProps } from './types';

/** Ruler — a long bar with ticks hanging from its upper edge, the middle one
 *  longer. Used for `useMeasureTool`. */
export default function MeasureIcon({ className, size = 20 }: IconProps) {
  return (
    <svg
      {...ICON_SVG_BASE}
      className={className}
      width={size}
      height={size}
    >
      <rect x="2.75" y="6.75" width="14.5" height="6.5" rx="1" />
      <path d="M 6.5 7 V 9.5 M 10 7 V 11 M 13.5 7 V 9.5" strokeLinecap="round" />
    </svg>
  );
}
