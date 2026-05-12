import { ICON_SVG_BASE } from './_base';
import type { IconProps } from './types';

/** Slanted pencil pointing toward the upper-right corner. Used for the
 *  freehand pencil insertion tool. */
export default function PencilIcon({ className, size = 20 }: IconProps) {
  return (
    <svg
      {...ICON_SVG_BASE}
      className={className}
      width={size}
      height={size}
    >
      <path
        d="M 3 17 L 5.5 14.5 L 14 6 L 17 9 L 8.5 17.5 L 6 17 Z"
        strokeLinejoin="round"
      />
      <line x1="12" y1="4" x2="17" y2="9" strokeLinecap="round" />
    </svg>
  );
}
