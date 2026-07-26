import { ICON_SVG_BASE } from './_base';
import type { IconProps } from './types';

/** Outlined ellipse. Used for the ellipse insertion tool. */
export default function EllipseIcon({ className, size = 20 }: IconProps) {
  return (
    <svg
      {...ICON_SVG_BASE}
      className={className}
      width={size}
      height={size}
    >
      <ellipse cx="10" cy="10" rx="7" ry="5" />
    </svg>
  );
}
