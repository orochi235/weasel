/**
 * An off-page tag: a text leaf with a background that names the far page and
 * the reference, and stations itself past the tip of its connector's stub.
 */
import {
  AUTO_POSE_DESCRIPTOR,
  translatePoseViaDescriptor,
  type AddNodeSpec,
  pageName,
  type DerivedDep,
  type PlacedPage,
  type PoseDescriptor,
  type RectPose,
  type Vec2,
} from '@weasel-js/core';
import type { MeasureRowText, RowTextStyle } from '../body';
import { labelSize } from '../edgeLabel';
import { subpathOf } from '../subpaths';
import { themeLabelStyle } from '../theme/resolve';
import type { DiagramTheme } from '../theme/types';
import { offPageTagId, offPageTagOf, type OffPageSplit } from './trait';

/** How a tag is drawn: its face, its text color, and the box behind the text. */
export interface OffPageTagLook {
  style: RowTextStyle;
  fill: string;
  background: string;
  /** World units between the box and the text. Default {@link OFF_PAGE_TAG_PADDING}. */
  padding?: number;
  /** Sizes the text. Default: a per-character estimate. */
  measure?: MeasureRowText;
}

/** A tag's default padding, in world units. */
export const OFF_PAGE_TAG_PADDING = 3;

/** World units between a stub's tip and its tag. */
const GAP = 2;

/** A tag's look under `theme`: the theme's connector-label face and color, on its page color. */
export const offPageTagLook = (theme: DiagramTheme): OffPageTagLook =>
  ({ style: themeLabelStyle(theme), fill: theme.label.fill, background: theme.page });

/** What a tag reads: the far page's name and the connector's reference. */
export const offPageTagText = (pageName: string, ref: string): string => `${pageName} · ${ref}`;

/** What the tag at `end` of a split reads: the page at the other end, by name or place, else its raw id, and the reference. */
export function offPageFarText(pages: readonly PlacedPage[], split: OffPageSplit, end: 'from' | 'to'): string {
  const far = end === 'from' ? split.to : split.from;
  const index = pages.findIndex((p) => p.id === far);
  return offPageTagText(index < 0 ? far : pageName(pages[index]!, index), split.ref);
}

/** The box a tag of `text` takes in `look`. */
export function offPageTagSize(text: string, look: OffPageTagLook): { width: number; height: number } {
  const pad = look.padding ?? OFF_PAGE_TAG_PADDING;
  const size = labelSize(text, look.style, look.measure);
  return { width: size.width + 2 * pad, height: size.height + 2 * pad };
}

/** The tag `data` for end `end` of `edgeId`, reading `text` in `look`. */
export function offPageTagData(edgeId: string, end: 'from' | 'to', text: string, look: OffPageTagLook) {
  return {
    diagram: { offPageTag: { edge: edgeId, end } },
    text,
    style: look.style,
    fill: { paint: { color: look.fill } },
    background: { paint: { color: look.background } },
    padding: look.padding ?? OFF_PAGE_TAG_PADDING,
  };
}

/** The tag node at end `end` of connector `edgeId`, on `layer`: it derives its pose from the connector's stub. */
export function offPageTagSpec<TLayer extends string>(
  edgeId: string, end: 'from' | 'to', text: string, look: OffPageTagLook & { layer: TLayer },
): AddNodeSpec<unknown, TLayer, RectPose> {
  return {
    id: offPageTagId(edgeId, end) as never,
    kind: 'mark',
    layer: look.layer,
    pose: { x: 0, y: 0, ...offPageTagSize(text, look) },
    data: offPageTagData(edgeId, end, text, look),
    dependsOn: [edgeId as never],
    derivePose: OFF_PAGE_TAG_DERIVE_POSE as never,
  } as AddNodeSpec<unknown, TLayer, RectPose>;
}

/** A split connector's two tag specs, `from` then `to`. */
export function offPageTagSpecs<TLayer extends string>(
  edgeId: string, split: OffPageSplit, pages: readonly PlacedPage[], look: OffPageTagLook & { layer: TLayer },
): AddNodeSpec<unknown, TLayer, RectPose>[] {
  return (['from', 'to'] as const).map((end) => offPageTagSpec(edgeId, end, offPageFarText(pages, split, end), look));
}

/** The tip of the stub at `end` of a split connector's path, and the way the stub runs out to it. */
function stubTip(path: Parameters<typeof subpathOf>[0], end: 'from' | 'to'): { tip: Vec2; out: Vec2 } | null {
  const stub = subpathOf(path, end === 'from' ? 0 : 1);
  if (stub === null || stub.kind !== 'polygon' || stub.coords.length < 4) return null;
  const c = stub.coords;
  const n = c.length;
  const [tip, base] = end === 'from'
    ? [{ x: c[n - 2]!, y: c[n - 1]! }, { x: c[0]!, y: c[1]! }]
    : [{ x: c[0]!, y: c[1]! }, { x: c[n - 2]!, y: c[n - 1]! }];
  const len = Math.hypot(tip.x - base.x, tip.y - base.y);
  return len === 0 ? null : { tip, out: { x: (tip.x - base.x) / len, y: (tip.y - base.y) / len } };
}

/**
 * A `derivePose` that stations a tag just past its stub's tip, on the far
 * side from the shape. `null`, so the tag keeps its authored pose, while its
 * connector draws no stub at that end.
 */
export function offPageTagDerivePose<TPose>(
  opts: { geometry?: PoseDescriptor<TPose> } = {},
): (node: { pose: TPose; data: unknown }, deps: readonly (DerivedDep<TPose> | undefined)[]) => TPose | null {
  const geometry = opts.geometry ?? (AUTO_POSE_DESCRIPTOR as PoseDescriptor<TPose>);
  return (node, deps) => {
    const tag = offPageTagOf(node);
    const path = deps[0]?.path ?? null;
    if (tag === null || path === null) return null;
    const at = stubTip(path, tag.end);
    if (at === null) return null;
    const b = geometry.getBounds(node.pose);
    const reach = GAP + (Math.abs(at.out.x) * b.width + Math.abs(at.out.y) * b.height) / 2;
    const cx = at.tip.x + at.out.x * reach;
    const cy = at.tip.y + at.out.y * reach;
    return translatePoseViaDescriptor(node.pose, cx - (b.x + b.width / 2), cy - (b.y + b.height / 2), geometry);
  };
}

/** Registry key for {@link OFF_PAGE_TAG_DERIVE_POSE}. */
export const DIAGRAM_OFF_PAGE_TAG = 'diagram:offPageTag';

/** The default tag derivation, as one stable function reference so `toJSON` can find its key. */
export const OFF_PAGE_TAG_DERIVE_POSE = offPageTagDerivePose<unknown>();
