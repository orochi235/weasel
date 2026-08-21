/**
 * @experimental
 * Default boolean-op (Pathfinder) icons shipped with `defaultBooleanActions`.
 * Lifted verbatim from `apps/draw`'s `<PathfinderPanel>` so
 * consumers get a working icon set without having to author or import their
 * own. 20x20 viewBox, `currentColor` so theming is via CSS.
 */
const SVG_BASE = {
  viewBox: '0 0 20 20',
  width: 20,
  height: 20,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  'aria-hidden': true,
};

/** Icon for the union operation: two overlapping circles merged into one filled shape. */
export function UnionIcon() {
  return (
    <svg {...SVG_BASE}>
      <circle cx="7" cy="10" r="5" fill="currentColor" stroke="none" />
      <circle cx="13" cy="10" r="5" fill="currentColor" stroke="none" />
      <circle cx="7" cy="10" r="5" />
      <circle cx="13" cy="10" r="5" />
    </svg>
  );
}

/** Icon for the intersect operation: only the overlap of two circles filled. */
export function IntersectIcon() {
  return (
    <svg {...SVG_BASE}>
      <circle cx="7" cy="10" r="5" />
      <circle cx="13" cy="10" r="5" />
      <path
        d="M 10 6 A 5 5 0 0 1 10 14 A 5 5 0 0 1 10 6 Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

/** Icon for the subtract operation: the front circle removed from the back one. */
export function SubtractIcon() {
  return (
    <svg {...SVG_BASE}>
      <circle cx="7" cy="10" r="5" />
      <circle cx="13" cy="10" r="5" />
      <path
        d="M 10 6 A 5 5 0 1 0 10 14 A 5 5 0 0 0 10 6 Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

/** Icon for the exclude operation: both circles filled except their overlap. */
export function ExcludeIcon() {
  return (
    <svg {...SVG_BASE}>
      <circle cx="7" cy="10" r="5" />
      <circle cx="13" cy="10" r="5" />
      <path
        d="M 10 6 A 5 5 0 1 0 10 14 A 5 5 0 0 0 10 6 Z M 10 6 A 5 5 0 1 1 10 14 A 5 5 0 0 1 10 6 Z"
        fill="currentColor"
        stroke="none"
        fillRule="evenodd"
      />
    </svg>
  );
}

/** Icon for the divide operation: two circles split into their separate regions. */
export function DivideIcon() {
  return (
    <svg {...SVG_BASE}>
      <circle cx="7" cy="10" r="5" />
      <circle cx="13" cy="10" r="5" />
      <line x1="10" y1="6" x2="10" y2="14" />
    </svg>
  );
}

/** Icon for the crop operation: the back shape clipped to the front one. */
export function CropIcon() {
  // Back circle clipped to a topmost rect mask — only the portion of the
  // circle inside the rect is filled; the rect is outlined on top.
  return (
    <svg {...SVG_BASE}>
      <defs>
        <clipPath id="weasel-default-crop-mask">
          <rect x="9" y="5" width="8" height="10" />
        </clipPath>
      </defs>
      <circle cx="9" cy="10" r="5" />
      <circle
        cx="9"
        cy="10"
        r="5"
        fill="currentColor"
        stroke="none"
        clipPath="url(#weasel-default-crop-mask)"
      />
      <rect x="9" y="5" width="8" height="10" />
    </svg>
  );
}
