import { ICON_SVG_BASE } from './_base';
import type { IconProps } from './types';

/** Outlined hexagon. Used for the polygon insertion tool. */
export default function PolygonIcon({ className, size = 20 }: IconProps) {
  return (
    <svg
      {...ICON_SVG_BASE}
      className={className}
      width={size}
      height={size}
    >
      <polygon
        points="10,3 16.5,6.5 16.5,13.5 10,17 3.5,13.5 3.5,6.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
