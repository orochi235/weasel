import { ICON_SVG_BASE } from './_base';
import type { IconProps } from './types';

/** Open hand — rounded palm with four upward fingers (variable length)
 *  and a thumb stub. Used for `useHandTool` (viewport pan). */
export default function HandIcon({ className, size = 20 }: IconProps) {
  return (
    <svg
      {...ICON_SVG_BASE}
      className={className}
      width={size}
      height={size}
    >
      {/* Palm */}
      <rect x="5" y="10" width="10" height="7.5" rx="2" />
      {/* Four fingers, varying length so the silhouette reads "hand" */}
      <line x1="6.5" y1="10" x2="6.5" y2="4.5" strokeLinecap="round" />
      <line x1="9" y1="10" x2="9" y2="3" strokeLinecap="round" />
      <line x1="11.5" y1="10" x2="11.5" y2="3.5" strokeLinecap="round" />
      <line x1="14" y1="10" x2="14" y2="5.5" strokeLinecap="round" />
      {/* Thumb */}
      <line x1="5" y1="12.5" x2="2.5" y2="14.5" strokeLinecap="round" />
    </svg>
  );
}
