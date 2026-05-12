import { ICON_SVG_BASE } from './_base';
import type { IconProps } from './types';

/** Eyedropper — diagonal stem running from upper-right (bulb) to
 *  lower-left (tip), with a small squared bulb cap at the top. Used
 *  for the eyedropper / color-picker tool. */
export default function EyedropperIcon({ className, size = 20 }: IconProps) {
  return (
    <svg
      {...ICON_SVG_BASE}
      className={className}
      width={size}
      height={size}
    >
      {/* Bulb cap (upper-right) */}
      <line x1="12.5" y1="3.5" x2="16.5" y2="7.5" strokeLinecap="round" />
      {/* Bulb body — rounded rectangle along the diagonal */}
      <path
        d="M 11 7 L 13 5 a 2 2 0 0 1 2.8 0 l 1.2 1.2 a 2 2 0 0 1 0 2.8 L 15 11 Z"
        strokeLinejoin="round"
      />
      {/* Stem from bulb down to tip */}
      <line x1="13" y1="9" x2="5" y2="17" strokeLinecap="round" />
      <line x1="11" y1="7" x2="3" y2="15" strokeLinecap="round" />
      {/* Tip closure */}
      <line x1="3" y1="15" x2="5" y2="17" strokeLinecap="round" />
    </svg>
  );
}
