import { ICON_SVG_BASE } from './_base';
import type { IconProps } from './types';

/** `LineIcon`'s diagonal with a filled head, so the two read as one tool with
 *  and without the marker. Used for the arrow insertion tool.
 *
 *  The head is filled rather than an open V: at 16px an open V's barbs merge
 *  under antialiasing and the notch disappears, leaving a blob. Its base
 *  corners are `tip ∓ 5.6·d ± 2.1·d⊥` — computed, and the shaft stops half a
 *  unit inside the base so its round cap hides under the fill. */
export default function ArrowIcon({ className, size = 20 }: IconProps) {
  return (
    <svg
      {...ICON_SVG_BASE}
      className={className}
      width={size}
      height={size}
    >
      <path d="M3.5 16.5 12.9 7.1" strokeLinecap="round" />
      <path d="M16.5 3.5 11.06 5.98 14.03 8.95Z" fill="currentColor" strokeLinejoin="round" />
    </svg>
  );
}
