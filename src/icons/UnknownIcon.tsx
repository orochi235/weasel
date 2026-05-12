import { ICON_SVG_BASE } from './_base';
import type { IconProps } from './types';

/** Placeholder for tools without `presentation.icon`. A circle with "?"
 *  inside — readable, debuggable, not hidden. */
export default function UnknownIcon({ className, size = 20 }: IconProps) {
  return (
    <svg
      {...ICON_SVG_BASE}
      className={className}
      width={size}
      height={size}
    >
      <circle cx="10" cy="10" r="7.5" />
      <path
        d="M 7.5 8 Q 7.5 5.5 10 5.5 Q 12.5 5.5 12.5 8 Q 12.5 9.5 10 11 L 10 12.5"
        strokeLinecap="round"
      />
      <circle cx="10" cy="14.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
