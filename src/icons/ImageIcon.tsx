import { ICON_SVG_BASE } from './_base';
import type { IconProps } from './types';

/** Framed picture with a sun and mountain — the conventional "image" glyph.
 *  Used for the image insertion tool (`useImageTool`). */
export default function ImageIcon({ className, size = 20 }: IconProps) {
  return (
    <svg
      {...ICON_SVG_BASE}
      className={className}
      width={size}
      height={size}
    >
      <rect x="3" y="4" width="14" height="12" rx="1" />
      <circle cx="7" cy="8" r="1.4" />
      <path d="M4 14l4-4 3 3 3-4 2 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
