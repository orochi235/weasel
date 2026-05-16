/** Per-tool icons for the LayerList rows — keyed on `obj.tool` so every
 *  object kind that ships with Swillustrator (rect, ellipse, polygon, star,
 *  line, pen, pencil, text, imported) gets a recognizable glyph. We reuse
 *  the kit's built-in tool icons rather than authoring inline SVGs so the
 *  LayerList stays visually consistent with the ActionBar / tool palette.
 *  `PageIcon` stays local — no kit equivalent.
 *
 *  Objects minted by a boolean op carry `tool: 'imported'` (no authoring
 *  tool) plus a `producedBy` provenance tag; when present we dispatch to
 *  the matching Pathfinder icon instead of the unknown-tool glyph.
 *
 *  Parent row supplies the accessible name via existing list-row semantics;
 *  the icons are `aria-hidden`.
 */
import type { ReactNode } from 'react';
import type { BooleanOp } from '@orochi235/weasel';
import {
  RectIcon,
  EllipseIcon,
  PolygonIcon,
  StarIcon,
  LineIcon,
  PenIcon,
  PencilIcon,
  TextIcon,
  UnknownIcon,
  UnionIcon,
  IntersectIcon,
  SubtractIcon,
  ExcludeIcon,
  DivideIcon,
} from '@orochi235/weasel';
import type { ToolKind } from './poseUpdate';

const SVG_BASE = {
  viewBox: '0 0 16 16',
  width: 16,
  height: 16,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  'aria-hidden': true,
};

export function PageIcon() {
  // A document page — rectangle with a folded top-right corner.
  return (
    <svg {...SVG_BASE}>
      <path d="M 4 2.5 L 10.5 2.5 L 13 5 L 13 13.5 L 4 13.5 Z" strokeLinejoin="round" />
      <path d="M 10.5 2.5 L 10.5 5 L 13 5" strokeLinejoin="round" />
    </svg>
  );
}

/** Dispatch by tool — convenient one-liner for consumers. When `tool`
 *  is `'imported'` and `producedBy` names a boolean op, the Pathfinder
 *  icon for that op wins over the unknown-tool glyph. */
export function ToolIcon({
  tool,
  producedBy,
}: {
  tool: ToolKind;
  producedBy?: BooleanOp;
}): ReactNode {
  switch (tool) {
    case 'rect': return <RectIcon />;
    case 'ellipse': return <EllipseIcon />;
    case 'polygon': return <PolygonIcon />;
    case 'star': return <StarIcon />;
    case 'line': return <LineIcon />;
    case 'pen': return <PenIcon />;
    case 'pencil': return <PencilIcon />;
    case 'text': return <TextIcon />;
    case 'imported':
      switch (producedBy) {
        case 'union': return <UnionIcon />;
        case 'intersect': return <IntersectIcon />;
        case 'subtract': return <SubtractIcon />;
        case 'exclude': return <ExcludeIcon />;
        case 'divide': return <DivideIcon />;
        default: return <UnknownIcon />;
      }
  }
}
