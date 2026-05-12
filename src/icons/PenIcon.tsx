import { ICON_SVG_BASE } from './_base';
import type { IconProps } from './types';

/** Pen nib — angled filled body with a pointed tip and a small ink dot
 *  at the very tip, plus a short "control" handle extending out the
 *  back. Used for `useUserPenTool`. */
export default function PenIcon({ className, size = 20 }: IconProps) {
  return (
    <svg
      {...ICON_SVG_BASE}
      className={className}
      width={size}
      height={size}
    >
      {/* Nib body */}
      <path
        d="M 4 4 L 8.5 4 L 16 11.5 L 13 14.5 L 4 5.5 Z"
        fill="currentColor"
        strokeLinejoin="round"
      />
      {/* Tip notch */}
      <line x1="13" y1="14.5" x2="14.2" y2="15.7" strokeLinecap="round" />
      {/* Ink dot */}
      <circle cx="15.5" cy="16.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}
