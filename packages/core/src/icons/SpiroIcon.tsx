import { ICON_SVG_BASE } from './_base';
import type { IconProps } from './types';

/** An S-curve through three on-curve points, each a filled dot, the middle
 *  one where the curve turns level. Used for `useSpiroTool`. */
export default function SpiroIcon({ className, size = 20 }: IconProps) {
  return (
    <svg
      {...ICON_SVG_BASE}
      className={className}
      width={size}
      height={size}
    >
      <path d="M 3.5 15 C 6.5 15 7 10 10 10 C 13 10 13.5 5 16.5 5" strokeLinecap="round" />
      <circle cx="3.5" cy="15" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="10" cy="10" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="5" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
