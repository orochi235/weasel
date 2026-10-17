/**
 * The draw commands path edit paints for the open path, in screen space: its
 * outline, then each anchor's handles and marker.
 */
import type { DrawCommand } from '@weasel-js/renderer';
import {
  circlePath, linePath, pathToAnchors, polygonFromPoints, resolveCorners, squarePath, type PenAnchor, type PolygonPath,
  type SpiroKind, type View,
} from '@weasel-js/geom';

/** Appearance of the outline and of the anchor and handle markers. */
export interface PathEditingOverlayStyle {
  anchorSizePx?: number;
  handleDotRadiusPx?: number;
  anchorFill?: string;
  anchorStroke?: string;
  handleStroke?: string;
  /** Fill of the control-point circle. Defaults to the handleStroke color
   *  at 50% alpha. */
  handleDotFill?: string;
  /** Fill of a selected anchor square. Defaults to the anchor stroke color. */
  anchorFillSelected?: string;
  /** The open path's outline, drawn over its own fill and stroke so the path
   *  shows however its paint and its markers cover it. */
  outlineStroke?: string;
  outlineWidthPx?: number;
  /** Radius of the dot an unselected anchor shrinks to where anchors sit
   *  closer together on screen than a marker is wide. */
  denseDotRadiusPx?: number;
  /** Stroke of the marquee rubber band. */
  marqueeStroke?: string;
  /** Fill of the marquee rubber band. */
  marqueeFill?: string;
}

/** The path-edit overlay's look where a {@link PathEditingOverlayStyle} leaves a field out. */
export const DEFAULT_OVERLAY_STYLE: Required<PathEditingOverlayStyle> = {
  anchorSizePx: 8,
  handleDotRadiusPx: 5,
  anchorFill: '#ffffff',
  anchorStroke: '#3478f6',
  handleStroke: '#7da7e8',
  // 50%-opacity handle-stroke color. #7da7e8 → rgba(125, 167, 232, 0.5).
  handleDotFill: 'rgba(125, 167, 232, 0.5)',
  anchorFillSelected: '#3478f6',
  outlineStroke: '#3478f6',
  outlineWidthPx: 1,
  denseDotRadiusPx: 1.5,
  marqueeStroke: '#3478f6',
  marqueeFill: 'rgba(52, 120, 246, 0.08)',
};

type Point = { x: number; y: number };

export function worldToScreen(p: Point, view: View): Point {
  return { x: (p.x - view.x) * view.scale.x, y: (p.y - view.y) * view.scale.y };
}

/** `path`, its corners expanded, with every coordinate carried to screen
 *  through `view`: a radius left on it would stay in world units. */
function onScreen(path: PolygonPath, view: View): PolygonPath {
  path = resolveCorners(path);
  const coords = new Float32Array(path.coords.length);
  for (let i = 0; i < coords.length; i += 2) {
    coords[i] = (path.coords[i] - view.x) * view.scale.x;
    coords[i + 1] = (path.coords[i + 1] - view.y) * view.scale.y;
  }
  return { ...path, coords };
}

/** Whether `sub[i]` sits closer to a neighbor along its subpath than `px` on screen. */
function crowded(sub: readonly Point[], closed: boolean, i: number, px: number): boolean {
  const n = sub.length;
  const near = (j: number): boolean => {
    if (!closed && (j < 0 || j >= n)) return false;
    const q = sub[(j + n) % n];
    return q !== sub[i] && Math.hypot(q.x - sub[i].x, q.y - sub[i].y) < px;
  };
  return near(i - 1) || near(i + 1);
}

const HALF_DISC_STEPS = 12;

/** A half-disc of radius `r` centered on `(x, y)`, bulging toward `toward`. */
function halfDisc(x: number, y: number, r: number, toward: Point): PolygonPath {
  const mid = Math.atan2(toward.y, toward.x);
  const pts: Point[] = [];
  for (let i = 0; i <= HALF_DISC_STEPS; i++) {
    const a = mid - Math.PI / 2 + (Math.PI * i) / HALF_DISC_STEPS;
    pts.push({ x: x + r * Math.cos(a), y: y + r * Math.sin(a) });
  }
  return polygonFromPoints(pts);
}

/**
 * The marker for an anchor at `at`, `size` px across, by what kind of point it
 * is: a square for an ordinary anchor (`kind` null) and a spiro corner, a
 * circle for a smooth spiro point, and a half-disc for a spiro point beside a
 * straight segment, its flat side toward the line. A `left` point's line
 * arrives from `prev` and a `right` point's leaves toward `next`, both in the
 * same screen space; without that neighbor the half-disc faces right.
 */
export function anchorMarkerPath(
  kind: SpiroKind | null,
  at: Point,
  size: number,
  prev: Point | null = null,
  next: Point | null = null,
): PolygonPath {
  if (kind === 'smooth') return circlePath(at.x, at.y, size / 2);
  if (kind === 'left' || kind === 'right') {
    const from = kind === 'left' ? prev : next;
    const away = from ? { x: at.x - from.x, y: at.y - from.y } : { x: 1, y: 0 };
    const toward = away.x === 0 && away.y === 0 ? { x: 1, y: 0 } : away;
    return halfDisc(at.x, at.y, (size / 2) * 1.2, toward);
  }
  return squarePath(at.x, at.y, size);
}

/** The on-screen neighbors of `sub[i]` along its subpath, null past an open end. */
function neighbors(sub: readonly Point[], closed: boolean, i: number): [Point | null, Point | null] {
  const n = sub.length;
  const prev = i > 0 || closed ? sub[(i - 1 + n) % n] : null;
  const next = i < n - 1 || closed ? sub[(i + 1) % n] : null;
  return [prev, next];
}

function handleCommands(a: Point, handle: Point, style: Required<PathEditingOverlayStyle>): DrawCommand[] {
  return [
    { kind: 'path', path: linePath(a, handle), stroke: { paint: { kind: 'solid', color: style.handleStroke }, width: 1 } },
    {
      kind: 'path',
      path: circlePath(handle.x, handle.y, style.handleDotRadiusPx),
      fill: { paint: { kind: 'solid', color: style.handleDotFill } },
    },
  ];
}

/**
 * The open path's outline, then its anchors in walk order — each anchor's
 * handles under its marker. A selected anchor's marker is filled, an
 * unselected one's hollow, or a dot where its neighbors crowd it. The marker
 * is a square, or with `kinds`, the spiro kind of each anchor by flat index,
 * that kind's {@link anchorMarkerPath}. Flat indices count the way
 * `enumerateAnchors` does, as the selection does.
 */
export function anchorMarkerCommands(
  path: PolygonPath,
  view: View,
  selected: ReadonlySet<number>,
  style: Required<PathEditingOverlayStyle>,
  kinds: readonly SpiroKind[] | null = null,
): DrawCommand[] {
  const out: DrawCommand[] = [{
    kind: 'path',
    path: onScreen(path, view),
    stroke: { paint: { kind: 'solid', color: style.outlineStroke }, width: style.outlineWidthPx },
  }];
  const { anchors, closed } = pathToAnchors(path);
  let flat = 0;
  anchors.forEach((sub: PenAnchor[], s) => {
    const screen = sub.map((a) => worldToScreen(a, view));
    const isClosed = closed[s];
    sub.forEach((a, i) => {
      const kind = kinds?.[flat] ?? null;
      const isSelected = selected.has(flat++);
      const at = screen[i];
      if (a.inHandle) out.push(...handleCommands(at, worldToScreen(a.inHandle, view), style));
      if (a.outHandle) out.push(...handleCommands(at, worldToScreen(a.outHandle, view), style));
      if (!isSelected && crowded(screen, closed[s], i, style.anchorSizePx)) {
        out.push({
          kind: 'path',
          path: circlePath(at.x, at.y, style.denseDotRadiusPx),
          fill: { paint: { kind: 'solid', color: style.anchorStroke } },
        });
        return;
      }
      out.push({
        kind: 'path',
        path: anchorMarkerPath(kind, at, style.anchorSizePx, ...neighbors(screen, isClosed, i)),
        fill: { paint: { kind: 'solid', color: isSelected ? style.anchorFillSelected : style.anchorFill } },
        stroke: { paint: { kind: 'solid', color: style.anchorStroke }, width: 1 },
      });
    });
  });
  return out;
}
