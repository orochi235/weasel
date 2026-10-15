import { ICON_SVG_BASE } from './_base';
import type { IconProps } from './types';

/** Knife — an outlined handle on the diagonal with a filled blade whose
 *  spine continues the handle's upper edge to the tip at lower-left. Used
 *  for `useSliceTool`. */
export default function SliceIcon({ className, size = 20 }: IconProps) {
  return (
    <svg
      {...ICON_SVG_BASE}
      className={className}
      width={size}
      height={size}
    >
      {/* Handle, open where the blade seats */}
      <path d="M 8.5 10.5 L 14.5 4.5 L 16.5 6.5 L 10.5 12.5" strokeLinejoin="round" strokeLinecap="round" />
      {/* Blade */}
      <path d="M 8.5 10.5 L 3.5 15.5 L 10.5 12.5 Z" fill="currentColor" strokeLinejoin="round" />
    </svg>
  );
}
