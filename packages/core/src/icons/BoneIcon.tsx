import { ICON_SVG_BASE } from './_base';
import type { IconProps } from './types';

/** A rig bone — a long diamond from a round head joint to a smaller tail
 *  joint. Used for `useBoneTool`. */
export default function BoneIcon({ className, size = 20 }: IconProps) {
  return (
    <svg {...ICON_SVG_BASE} className={className} width={size} height={size} strokeLinejoin="round">
      <path d="M 5.6 14.4 L 8.9 14.7 L 15.2 4.8 L 5.3 11.1 Z" />
      <circle cx="4.6" cy="15.4" r="2" strokeWidth={1.25} />
      <circle cx="15.6" cy="4.4" r="1.4" strokeWidth={1.25} />
    </svg>
  );
}
