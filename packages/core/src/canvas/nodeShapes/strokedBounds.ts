import { boundsOfPath, type Path } from '@weasel-js/geom';
import { scaleVertexWidth, type Stroke } from '@weasel-js/paint';
import {
  markerHeads, resolveStrokeWidth, strokeInsets, tessellateStroke,
  type InsetLength, type ScreenSpace, type StrokeSpaces,
} from '@weasel-js/stroke';
import { resolveStrokeLengths, type GlMat3, type StrokedPathCommand } from '@weasel-js/renderer';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { nodeMemo } from 'core/scene/nodeMemo';
import type { NodeInkCtx } from 'canvas/NodeShape';
import { strokeOutsetPerAxis } from './nodePaint';

/**
 * The box `stroke` covers along `path`, from the ribbon the renderer draws:
 * joins, caps, dashes, and per-vertex widths as tessellated, and marker heads.
 * An inner stroke stays inside the path, and an outer one reaches as far out as
 * a centered stroke twice as wide. `null` when the stroke paints nothing.
 *
 * With `screen` (see `NodeInkCtx.screen`), each screen-sized part is built the
 * way the renderer builds it under that map, so a `{ px }` stroke is exact in
 * every direction; without, it is resolved at `scale`.
 */
export function strokedBounds(path: Path, stroke: Stroke, scale: number, screen?: ScreenMap): Bounds | null {
  const { sized, spaces } = screen ? onScreen(path, stroke, screen) : atScale(stroke, scale);
  const width = resolveStrokeWidth(sized.width ?? 1, 1);
  if (!(width > 0)) return null;
  const box = new Box();
  const align = stroke.align ?? 'center';
  if (align !== 'inner') {
    const k = align === 'outer' ? 2 : 1;
    const insets = strokeInsets(sized, width);
    const mesh = tessellateStroke(
      path,
      { ...sized, width: width * k, align: 'center', vertexWidths: stroke.vertexWidths?.map((w) => scaleVertexWidth(w, k)) },
      {
        startInset: insetIn(insets.start, spaces.start, spaces.ribbon),
        endInset: insetIn(insets.end, spaces.end, spaces.ribbon),
        ...(spaces.ribbon ? { metric: spaces.ribbon.metric } : {}),
      },
    );
    const v = mesh.vertices;
    for (let i = 0; i + 1 < v.length; i += 2) box.add(v[i]!, v[i + 1]!, 0);
  }
  for (const { entry, path: head, size } of markerHeads(path, sized, width, undefined, spaces)) {
    const b = boundsOfPath(head);
    const pad = entry.outline ? (entry.outline.width * size) / 2 : 0;
    box.add(b.x, b.y, pad);
    box.add(b.x + b.width, b.y + b.height, pad);
  }
  return box.bounds();
}

/** `[a, b, c, d]`: a frame's linear map to screen pixels. */
export type ScreenMap = readonly [number, number, number, number];

function atScale(stroke: Stroke, scale: number): { sized: Stroke; spaces: StrokeSpaces } {
  return { sized: { ...stroke, width: resolveStrokeWidth(stroke.width ?? 1, scale) }, spaces: {} };
}

function onScreen(path: Path, stroke: Stroke, [a, b, c, d]: ScreenMap): { sized: Stroke; spaces: StrokeSpaces } {
  const transform = new Float32Array([a, b, 0, c, d, 0, 0, 0, 1]) as GlMat3;
  const { cmd, spaces } = resolveStrokeLengths(transform, { kind: 'path', path, stroke } as StrokedPathCommand);
  return { sized: cmd.stroke as Stroke, spaces };
}

/** `length`, measured in `head`'s space, as the tessellator reads it. */
function insetIn(length: number, head: ScreenSpace | undefined, ribbon: ScreenSpace | undefined): InsetLength {
  return head?.metric === ribbon?.metric ? length : { length, metric: head?.metric ?? null };
}

class Box {
  private x0 = Infinity;
  private y0 = Infinity;
  private x1 = -Infinity;
  private y1 = -Infinity;
  add(x: number, y: number, pad: number): void {
    this.x0 = Math.min(this.x0, x - pad);
    this.y0 = Math.min(this.y0, y - pad);
    this.x1 = Math.max(this.x1, x + pad);
    this.y1 = Math.max(this.y1, y + pad);
  }
  bounds(): Bounds | null {
    return this.x0 === Infinity ? null : { x: this.x0, y: this.y0, width: this.x1 - this.x0, height: this.y1 - this.y0 };
  }
}

const DRAWN_SLOT = 'shape:drawn';

interface DrawnRecord {
  width: number;
  height: number;
  scale: number;
  screen: ScreenMap | undefined;
  /** Relative to the pose's top-left, so a move reuses it. */
  box: Bounds | null;
}

/** The pose box grown by a uniform stroke outset: exact for a rect or an
 *  ellipse, whose stroke reaches the same distance past the box on every side. */
export function outsetPoseBox(pose: Bounds, stroke: Stroke | null, ctx: NodeInkCtx | undefined): Bounds {
  const box = normalized(pose);
  if (!stroke) return box;
  const r = strokeOutsetPerAxis(stroke, ctx);
  return { x: box.x - r.x, y: box.y - r.y, width: box.width + 2 * r.x, height: box.height + 2 * r.y };
}

/**
 * The pose box together with what `stroke` covers along `pathAt(pose)`,
 * memoized per node on the pose's size and the view scale: a drag that only
 * moves the node does not stroke it again.
 */
export function strokedPoseBox(
  node: { data?: unknown },
  pose: Bounds,
  stroke: Stroke | null,
  ctx: NodeInkCtx | undefined,
  pathAt: (pose: Bounds) => Path,
): Bounds {
  const box = normalized(pose);
  if (stroke === null) return box;
  const scale = ctx?.scale ?? 1;
  const screen = ctx?.screen;
  const held = nodeMemo(node, DRAWN_SLOT, undefined, (): DrawnRecord => ({ width: NaN, height: NaN, scale: NaN, screen: undefined, box: null }));
  if (held.width !== pose.width || held.height !== pose.height || held.scale !== scale || !sameMap(held.screen, screen)) {
    const at = { x: 0, y: 0, width: pose.width, height: pose.height };
    held.width = pose.width;
    held.height = pose.height;
    held.scale = scale;
    held.screen = screen;
    held.box = strokedBounds(pathAt(at), stroke, scale, screen);
  }
  if (held.box === null) return box;
  const x0 = Math.min(box.x, pose.x + held.box.x);
  const y0 = Math.min(box.y, pose.y + held.box.y);
  const x1 = Math.max(box.x + box.width, pose.x + held.box.x + held.box.width);
  const y1 = Math.max(box.y + box.height, pose.y + held.box.y + held.box.height);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

function sameMap(m: ScreenMap | undefined, n: ScreenMap | undefined): boolean {
  if (m === n) return true;
  return !!m && !!n && m[0] === n[0] && m[1] === n[1] && m[2] === n[2] && m[3] === n[3];
}

function normalized(pose: Bounds): Bounds {
  return {
    x: Math.min(pose.x, pose.x + pose.width),
    y: Math.min(pose.y, pose.y + pose.height),
    width: Math.abs(pose.width),
    height: Math.abs(pose.height),
  };
}
