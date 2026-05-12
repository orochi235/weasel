import { ICON_SVG_BASE } from './_base';
import type { IconProps } from './types';

/** Classic cursor-arrow shape — filled silhouette pointing top-left to
 *  bottom-right with the diagonal "tail" along the lower edge. Used for
 *  `useSelectTool`. */
export default function SelectIcon({ className, size = 20 }: IconProps) {
  return (
    <svg
      {...ICON_SVG_BASE}
      className={className}
      width={size}
      height={size}
    >
      <path
        d="M 4 3 L 4 14.5 L 7.2 11.4 L 9.5 16 L 11.4 15.1 L 9.1 10.5 L 13.5 10.5 Z"
        fill="currentColor"
        strokeLinejoin="round"
      />
    </svg>
  );
}
