import { ICON_SVG_BASE } from './_base';
import type { IconProps } from './types';

/** Freeform marquee — outlined irregular loop with a short tail
 *  suggesting "the lasso closed where you released the pointer." Used
 *  for `useLassoTool`. */
export default function LassoIcon({ className, size = 20 }: IconProps) {
  return (
    <svg
      {...ICON_SVG_BASE}
      className={className}
      width={size}
      height={size}
    >
      <path
        d="M 6 13 Q 2.5 8.5 5 5 Q 9 2 13.5 4.5 Q 17.5 7.5 15.5 11.5 Q 13 14 9.5 13.5 Q 7.5 13.2 6 13 Z"
        strokeLinejoin="round"
      />
      <path d="M 6 13 L 4 17" strokeLinecap="round" />
    </svg>
  );
}
