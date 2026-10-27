import { applyToPoint, ellipsePath, linePath, rectPath, type Path, type Point } from '@weasel-js/geom';
import {
  viewToTransform, worldToScreen, type DrawCommand, type LayerHit, type RenderLayer, type View,
} from '@weasel-js/core';
import { SYMMETRY_KINDS, type SymmetrySpec } from './kinds';
import { latticePoints } from './wallpaper';

/** The guide layer's id. */
export const SYMMETRY_GUIDE_ID = 'weasel-symmetry-guide';
/** The affordance kind a press on one of the guide's handles arrives as. */
export const SYMMETRY_HANDLE_KIND = `layer:${SYMMETRY_GUIDE_ID}`;

/** Which handle a press took: the center, the knob that turns the axis, the
 *  end of a repeat's or a wallpaper's first step, or a wallpaper's first row. */
export type SymmetryHandle = 'center' | 'angle' | 'step' | 'row';

/** What a press on a handle carries to the drag action. */
export interface SymmetryHandlePress {
  handle: SymmetryHandle;
  group: string;
}

/** How the guide looks. Sizes are screen pixels. */
export interface SymmetryGuideStyle {
  color?: string;
  /** Spokes and repeat ticks, which say where copies go rather than what reflects. */
  faintColor?: string;
  handleRadiusPx?: number;
  /** How far from a handle a press still takes it. */
  hitRadiusPx?: number;
  /** How far from the center the angle knob sits, at least: it moves further
   *  out when the group's contents reach past it. */
  knobDistancePx?: number;
}

/** What the guide draws: the active group's spec and center, or null for none.
 *  `reach` is the world distance from the center to the farthest point of the
 *  group's contents; the angle knob sits past it so it never covers a shape. */
export interface SymmetryGuideSource {
  current(): { group: string; spec: SymmetrySpec; center: Point; reach?: number } | null;
  subscribe(listener: () => void): () => void;
}

const CURSORS: Record<SymmetryHandle, string> = { center: 'move', angle: 'grab', step: 'grab', row: 'grab' };

/**
 * Each handle the guide shows for `spec`, in screen pixels, topmost first.
 * The angle knob sits `knobPx` out, or further when the contents' `reach`
 * (world) puts it on a shape: then it is that far out on screen plus twice
 * `clearPx`, so its hit circle of that radius clears them with as much again.
 */
export function guideHandles(
  spec: SymmetrySpec,
  center: Point,
  view: View,
  knobPx: number,
  reach = 0,
  clearPx = 0,
): Array<{ handle: SymmetryHandle; at: Point }> {
  const t = viewToTransform(view);
  const [cx, cy] = worldToScreen(center.x, center.y, t);
  const out: Array<{ handle: SymmetryHandle; at: Point }> = [];
  const along = (handle: SymmetryHandle, angle: number, dist: number): void => {
    const [x, y] = worldToScreen(center.x + Math.cos(angle) * dist, center.y + Math.sin(angle) * dist, t);
    out.push({ handle, at: { x, y } });
  };
  if (spec.kind === 'repeat' || spec.kind === 'wallpaper') along('step', spec.angle, spec.spacing);
  if (spec.kind === 'wallpaper') along('row', spec.angle + spec.rowAngle, spec.rowSpacing);
  else if (hasAxis(spec)) {
    const d = screenDir(spec.angle, view);
    const reachPx = reach * Math.hypot(Math.cos(spec.angle) * view.scale.x, Math.sin(spec.angle) * view.scale.y);
    const dist = reach > 0 ? Math.max(knobPx, reachPx + 2 * clearPx) : knobPx;
    out.push({ handle: 'angle', at: { x: cx + d.x * dist, y: cy + d.y * dist } });
  }
  out.push({ handle: 'center', at: { x: cx, y: cy } });
  return out;
}

/** Whether the kind has an axis whose angle changes its copies. */
function hasAxis(spec: SymmetrySpec): boolean {
  return spec.kind === 'mirror' || spec.kind === 'both' || spec.kind === 'kaleidoscope';
}

/** A world direction at `angle`, as a unit vector on screen. */
function screenDir(angle: number, view: View): Point {
  const x = Math.cos(angle) * view.scale.x;
  const y = Math.sin(angle) * view.scale.y;
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}

/** The angles of the lines a spec reflects across: for a wallpaper, those
 *  through the center its cell reflects across. */
function mirrorAngles(spec: SymmetrySpec): number[] {
  if (spec.kind === 'wallpaper') {
    return spec.cell === 'none' ? [] : mirrorAngles({ ...spec, kind: spec.cell, angle: spec.angle + spec.cellAngle });
  }
  if (spec.kind === 'mirror') return [spec.angle];
  if (spec.kind === 'both') return [spec.angle, spec.angle + Math.PI / 2];
  if (spec.kind === 'kaleidoscope') {
    const n = Math.max(1, Math.round(spec.count));
    return Array.from({ length: n }, (_, k) => spec.angle + (Math.PI * k) / n);
  }
  return [];
}

/**
 * The active group's guide: its mirror lines across the canvas, a spoke per
 * wedge of a radial kind, a repeat's line and steps, and the handles that
 * move the center, turn the axis and stretch a repeat. Only a handle is hit;
 * a stroke can start anywhere else, on a line included.
 */
export function symmetryGuideLayer(source: SymmetryGuideSource, style: SymmetryGuideStyle = {}): RenderLayer<unknown> {
  const color = style.color ?? 'rgba(0, 140, 255, 0.9)';
  const faint = style.faintColor ?? 'rgba(0, 140, 255, 0.35)';
  const r = style.handleRadiusPx ?? 5;
  const hitR = style.hitRadiusPx ?? 9;
  const knob = style.knobDistancePx ?? 64;
  const stroke = (c: string) => ({ paint: { kind: 'solid' as const, color: c }, width: { px: 1 } });
  const line = (a: Point, b: Point, c: string): DrawCommand => ({ kind: 'path', path: linePath(a, b), stroke: stroke(c) });
  const dot = (at: Point, radius: number): Path => ellipsePath({ x: at.x - radius, y: at.y - radius, width: radius * 2, height: radius * 2 });

  return {
    id: SYMMETRY_GUIDE_ID,
    label: 'Symmetry guide',
    space: 'screen',
    subscribe: source.subscribe,
    draw(_data, view, dims): DrawCommand[] {
      const g = source.current();
      if (!g) return [];
      const { spec, center, reach: contentReach = 0 } = g;
      const t = viewToTransform(view);
      const [cx, cy] = worldToScreen(center.x, center.y, t);
      const reach = Math.hypot(dims.width, dims.height) * 2;
      const out: DrawCommand[] = [];
      for (const a of mirrorAngles(spec)) {
        const d = screenDir(a, view);
        out.push(line({ x: cx - d.x * reach, y: cy - d.y * reach }, { x: cx + d.x * reach, y: cy + d.y * reach }, color));
      }
      if (spec.kind === 'radial') {
        const n = Math.max(1, Math.round(spec.count));
        for (let k = 0; k < n; k++) {
          const d = screenDir(spec.angle + (2 * Math.PI * k) / n, view);
          out.push(line({ x: cx, y: cy }, { x: cx + d.x * reach, y: cy + d.y * reach }, faint));
        }
      }
      if (spec.kind === 'repeat') {
        const d = screenDir(spec.angle, view);
        out.push(line({ x: cx, y: cy }, { x: cx + d.x * reach, y: cy + d.y * reach }, faint));
        for (const m of SYMMETRY_KINDS.repeat.transforms(spec, center)) {
          const [wx, wy] = applyToPoint(m, center.x, center.y);
          const [x, y] = worldToScreen(wx, wy, t);
          out.push({ kind: 'path', path: dot({ x, y }, 2.5), fill: { paint: { kind: 'solid', color: faint } } });
        }
      }
      if (spec.kind === 'wallpaper') out.push(...latticeGuide(spec, center, view, faint));
      for (const h of guideHandles(spec, center, view, knob, contentReach, hitR)) {
        if (h.handle === 'angle') out.push(line({ x: cx, y: cy }, h.at, color));
        if (h.handle === 'step' || h.handle === 'row') out.push(line({ x: cx, y: cy }, h.at, faint));
        out.push({
          kind: 'path',
          path: dot(h.at, h.handle === 'center' ? r + 1 : r),
          fill: { paint: { kind: 'solid', color: h.handle === 'center' ? color : '#fff' } },
          stroke: { paint: { kind: 'solid', color: h.handle === 'center' ? '#fff' : color }, width: { px: 1.5 } },
        });
      }
      return out;
    },
    hitTest(worldX, worldY, _data, view): LayerHit | null {
      const g = source.current();
      if (!g) return null;
      const [px, py] = worldToScreen(worldX, worldY, viewToTransform(view));
      for (const h of guideHandles(g.spec, g.center, view, knob, g.reach ?? 0, hitR)) {
        if (Math.hypot(px - h.at.x, py - h.at.y) > hitR) continue;
        const press: SymmetryHandlePress = { handle: h.handle, group: g.group };
        return { strength: 'exclusive', cursor: CURSORS[h.handle], initialScratch: press };
      }
      return null;
    },
  };
}

/** A wallpaper's extent outlined, and a dot at each of its lattice points. */
function latticeGuide(spec: SymmetrySpec, center: Point, view: View, color: string): DrawCommand[] {
  const t = viewToTransform(view);
  const { x, y, width, height } = spec.extent;
  const [x0, y0] = worldToScreen(center.x + x, center.y + y, t);
  const [x1, y1] = worldToScreen(center.x + x + width, center.y + y + height, t);
  const paint = { kind: 'solid' as const, color };
  const out: DrawCommand[] = [{
    kind: 'path',
    path: rectPath(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)),
    stroke: { paint, width: { px: 1 }, dash: [4, 4] },
  }];
  for (const p of latticePoints(spec)) {
    const [px, py] = worldToScreen(center.x + p.x, center.y + p.y, t);
    out.push({ kind: 'path', path: ellipsePath({ x: px - 2, y: py - 2, width: 4, height: 4 }), fill: { paint } });
  }
  return out;
}
