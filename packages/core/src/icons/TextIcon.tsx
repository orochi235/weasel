import { ICON_SVG_BASE } from './_base';
import type { IconProps } from './types';

/** Serif "T" — top bar + stem + small bottom serif. Used for
 *  `useTextTool`. Visually consistent with the layer-list text icon. */
export default function TextIcon({ className, size = 20 }: IconProps) {
  return (
    <svg
      {...ICON_SVG_BASE}
      className={className}
      width={size}
      height={size}
    >
      <path
        d="M 4 5 L 16 5 M 10 5 L 10 16 M 7 16 L 13 16"
        strokeLinecap="round"
      />
    </svg>
  );
}
