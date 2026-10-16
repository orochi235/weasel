import { boundsOfPath, type Path } from '@weasel-js/geom';
import type { Stroke } from '@weasel-js/paint';
import { markerHeads, resolveStrokeWidth, strokeInsets, tessellateStroke } from '@weasel-js/stroke';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { nodeMemo } from 'core/scene/nodeMemo';
import type { NodeInkCtx } from 'canvas/NodeShape';
import { strokeOutset } from './nodePaint';

/**
 * The box `stroke` covers along `path`, from the ribbon the renderer draws:
 * joins, caps, dashes, and per-vertex widths as tessellated, and marker heads.
 * An inner stroke stays inside the path, and an outer one reaches as far out as
 * a centered stroke twice as wide. `null` when the stroke paints nothing.
 */
export function strokedBounds(path: Path, stroke: Stroke, scale: number): Bounds | null {
  const width = resolveStrokeWidth(stroke.width ?? 1, scale);
  if (!(width > 0)) return null;
  const sized: Stroke = { ...stroke, width };
  const box = new Box();
  const align = stroke.align ?? 'center';
  if (align !== 'inner') {
    const k = align === 'outer' ? 2 : 1;
    const insets = strokeInsets(sized, width);
    const mesh = tessellateStroke(
      path,
      { ...sized, width: width * k, align: 'center', vertexWidths: stroke.vertexWidths?.map((w) => w * k) },
      { startInset: insets.start, endInset: insets.end },
    );
    const v = mesh.vertices;
    for (let i = 0; i + 1 < v.length; i += 2) box.add(v[i]!, v[i + 1]!, 0);
  }
  for (const { entry, path: head, size } of markerHeads(path, sized, width, undefined)) {
    const b = boundsOfPath(head);
    const pad = entry.outline ? (entry.outline.width * size) / 2 : 0;
    box.add(b.x, b.y, pad);
    box.add(b.x + b.width, b.y + b.height, pad);
  }
  return box.bounds();
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
  /** Relative to the pose's top-left, so a move reuses it. */
  box: Bounds | null;
}

/** The pose box grown by a uniform stroke outset: exact for a rect or an
 *  ellipse, whose stroke reaches the same distance past the box on every side. */
export function outsetPoseBox(pose: Bounds, stroke: Stroke | null, ctx: NodeInkCtx | undefined): Bounds {
  const box = normalized(pose);
  const r = stroke ? strokeOutset(stroke, ctx?.scale ?? 1) : 0;
  if (r === 0) return box;
  return { x: box.x - r, y: box.y - r, width: box.width + 2 * r, height: box.height + 2 * r };
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
  const held = nodeMemo(node, DRAWN_SLOT, undefined, (): DrawnRecord => ({ width: NaN, height: NaN, scale: NaN, box: null }));
  if (held.width !== pose.width || held.height !== pose.height || held.scale !== scale) {
    const at = { x: 0, y: 0, width: pose.width, height: pose.height };
    held.width = pose.width;
    held.height = pose.height;
    held.scale = scale;
    held.box = strokedBounds(pathAt(at), stroke, scale);
  }
  if (held.box === null) return box;
  const x0 = Math.min(box.x, pose.x + held.box.x);
  const y0 = Math.min(box.y, pose.y + held.box.y);
  const x1 = Math.max(box.x + box.width, pose.x + held.box.x + held.box.width);
  const y1 = Math.max(box.y + box.height, pose.y + held.box.y + held.box.height);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

function normalized(pose: Bounds): Bounds {
  return {
    x: Math.min(pose.x, pose.x + pose.width),
    y: Math.min(pose.y, pose.y + pose.height),
    width: Math.abs(pose.width),
    height: Math.abs(pose.height),
  };
}
