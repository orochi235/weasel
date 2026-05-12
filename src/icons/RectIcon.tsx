import { ICON_SVG_BASE } from './_base';
import type { IconProps } from './types';

/** Outlined rectangle with a small crosshair at the upper-left corner,
 *  signaling "this is a drawing tool, not just a shape." Used for the
 *  rectangle insertion tool (`useInsertTool` today, future `useRectTool`). */
export default function RectIcon({ className, size = 20 }: IconProps) {
  return (
    <svg
      {...ICON_SVG_BASE}
      className={className}
      width={size}
      height={size}
    >
      <rect x="5" y="6" width="11" height="9" />
      <line x1="3" y1="4" x2="7" y2="4" strokeLinecap="round" />
      <line x1="5" y1="2" x2="5" y2="6" strokeLinecap="round" />
    </svg>
  );
}
