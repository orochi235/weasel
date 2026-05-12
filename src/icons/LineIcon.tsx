import { ICON_SVG_BASE } from './_base';
import type { IconProps } from './types';

/** Diagonal line. Used for the line insertion tool. */
export default function LineIcon({ className, size = 20 }: IconProps) {
  return (
    <svg
      {...ICON_SVG_BASE}
      className={className}
      width={size}
      height={size}
    >
      <line x1="4" y1="16" x2="16" y2="4" strokeLinecap="round" />
    </svg>
  );
}
