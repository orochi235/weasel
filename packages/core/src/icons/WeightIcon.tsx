import { ICON_SVG_BASE } from './_base';
import type { IconProps } from './types';

/** Influence falling off from a center — a filled core, a ring, and a dashed
 *  outer ring. Used for `useWeightTool`. */
export default function WeightIcon({ className, size = 20 }: IconProps) {
  return (
    <svg {...ICON_SVG_BASE} className={className} width={size} height={size}>
      <circle cx="10" cy="10" r="7" strokeWidth={1} strokeDasharray="1.6 1.6" />
      <circle cx="10" cy="10" r="4.25" strokeWidth={1.25} />
      <circle cx="10" cy="10" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}
