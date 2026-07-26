import { ICON_SVG_BASE } from './_base';
import type { IconProps } from './types';

/** Outlined five-point star. Used for the star insertion tool. */
export default function StarIcon({ className, size = 20 }: IconProps) {
  return (
    <svg
      {...ICON_SVG_BASE}
      className={className}
      width={size}
      height={size}
    >
      <polygon
        points="10,2.5 12.1,7.9 17.8,8.3 13.4,12 14.8,17.5 10,14.4 5.2,17.5 6.6,12 2.2,8.3 7.9,7.9"
        strokeLinejoin="round"
      />
    </svg>
  );
}
