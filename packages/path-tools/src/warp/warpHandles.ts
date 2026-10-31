/**
 * The controls of the selection's warp, as a hit-tested layer: a distort's
 * corners and the quad they make, an envelope's mesh points and the grid
 * lines through them, a puppet's pins. Over a selection holding no warp of
 * the kind, the controls of a fresh one are shown where it would start.
 */
import {
  applyToPoint, ellipsePath, pathFromD, polylineFromPoints, type Affine, type Point, type PolygonPath,
} from '@weasel-js/geom';
import { pathWarpMap, warpControls, type PathWarp } from '@weasel-js/geom/warp';
import type { DrawCommand } from '@weasel-js/renderer';
import {
  type Affordance, type AffordanceRegion, type ChromeState, composeAffordanceLayer, type CreateOutlinesAdapter, DEFAULT_OVERLAY_STYLE, type RenderLayer, type Scene, type View, viewToTransform, worldToScreen,
} from '@weasel-js/core';
import { warpLeavesOf } from './warpSelection';
import type { WarpHandleScratch, WarpLive } from './warpActions';
import {
  freshWarp, freshWarpBox, splitByWarp, type WarpKind, type WarpSettings,
} from './warpTargets';
import type { WarpBox } from '@weasel-js/geom/warp';

/** The id of the layer showing a `kind` warp's controls. A binding reaches
 *  its controls through `affordance:layer:<id>`. */
export const warpLayerId = (kind: WarpKind): string => `warp-${kind}`;

/** What the layer reads, live, on every paint and hit-test. */
export interface WarpHandleLayerSource {
  kind: WarpKind;
  /** Whether to show anything: the tool owning the layer is active. */
  active(): boolean;
  /** What a fresh warp is made with. */
  settings(): WarpSettings;
  scene(): Pick<Scene<unknown, string, unknown>, 'get' | 'childrenOf'> | undefined;
  /** What tells text from other nodes; absent, text gets no controls. */
  outlines?(): Pick<CreateOutlinesAdapter, 'getTextSource'> | undefined;
  live: WarpLive;
}

interface ControlGroup {
  warpId: string | null;
  warp: PathWarp;
  /** The path the warp is laid over, in the warp's frame. */
  source: PolygonPath;
  toWorld: Affine;
}

const HIT_PX = 8;
const SIZE_PX = DEFAULT_OVERLAY_STYLE.anchorSizePx;
const PIN_RADIUS_PX = DEFAULT_OVERLAY_STYLE.handleDotRadiusPx;
const ACCENT = DEFAULT_OVERLAY_STYLE.anchorStroke;
const LINE = { paint: { kind: 'solid' as const, color: ACCENT }, width: 1 };
const LINE_SAMPLES = 12;
const IDENTITY: Affine = [1, 0, 0, 1, 0, 0];

/** A closed polygon around `box`: what a fresh warp over text alone is laid on. */
const boxPath = (b: WarpBox): PolygonPath =>
  pathFromD(`M ${b.x} ${b.y} H ${b.x + b.width} V ${b.y + b.height} H ${b.x} Z`) as PolygonPath;

/** One group per warp the selection shares, then one for a fresh warp over
 *  whatever selected paths hold none and the selected text. */
function groupsOf(src: WarpHandleLayerSource, state: ChromeState): ControlGroup[] {
  const scene = src.scene();
  if (!scene || !src.active()) return [];
  const outlines = src.outlines?.();
  const leaves = warpLeavesOf(scene, state.selection, outlines, (id) => src.live.get(id));
  const { held, bare } = splitByWarp(leaves.paths, src.kind);
  const box = freshWarpBox(scene, leaves, src.kind);
  const out: ControlGroup[] = [];
  const seen = new Set<string>();
  for (const t of held) {
    if (seen.has(t.held.id)) continue;
    seen.add(t.held.id);
    out.push({ warpId: t.held.id, warp: t.held.warp, source: t.held.source, toWorld: t.toWorld });
  }
  if (box) out.push({ warpId: null, warp: freshWarp(src.kind, box, src.settings()), source: bare[0]?.path ?? boxPath(box), toWorld: IDENTITY });
  return out;
}

const toWorld = (m: Affine, p: Point): Point => {
  const [x, y] = applyToPoint(m, p.x, p.y);
  return { x, y };
};

function pinPaint(view: View, at: { x: number; y: number }): DrawCommand[] {
  const [x, y] = worldToScreen(at.x, at.y, viewToTransform(view));
  const r = PIN_RADIUS_PX;
  return [{
    kind: 'path',
    path: ellipsePath({ x: x - r, y: y - r, width: 2 * r, height: 2 * r }),
    fill: { paint: { kind: 'solid', color: '#ffffff' } },
    stroke: { paint: { kind: 'solid', color: ACCENT }, width: 2 },
  }];
}

/** The lines a group's controls hang on, in world space: a distort's quad,
 *  an envelope's grid lines carried through the mesh. */
function guideLines(group: ControlGroup): Point[][] {
  const { warp, toWorld: m } = group;
  if (warp.kind === 'distort') {
    const c = warp.corners.map((p) => toWorld(m, p));
    return [[...c, c[0]]];
  }
  if (warp.kind !== 'envelope') return [];
  const map = pathWarpMap(warp, group.source);
  const { box, mesh } = warp;
  const at = (u: number, v: number) => toWorld(m, map({ x: box.x + u * box.width, y: box.y + v * box.height }));
  const lines: Point[][] = [];
  for (let i = 0; i <= mesh.rows; i++) {
    const n = mesh.cols * LINE_SAMPLES;
    lines.push(Array.from({ length: n + 1 }, (_, k) => at(k / n, i / mesh.rows)));
  }
  for (let j = 0; j <= mesh.cols; j++) {
    const n = mesh.rows * LINE_SAMPLES;
    lines.push(Array.from({ length: n + 1 }, (_, k) => at(j / mesh.cols, k / n)));
  }
  return lines;
}

function warpAffordance(src: WarpHandleLayerSource): Affordance {
  const id = warpLayerId(src.kind);
  return {
    id,
    regions(state): readonly AffordanceRegion[] {
      const out: AffordanceRegion[] = [];
      for (const group of groupsOf(src, state)) {
        warpControls(group.warp).forEach((local, index) => {
          const p = toWorld(group.toWorld, local);
          out.push({
            id: `${group.warpId ?? 'fresh'}:${index}`,
            targetId: null,
            shape: { kind: 'point', x: p.x, y: p.y, hitRadiusPx: HIT_PX },
            paint: group.warp.kind === 'puppet'
              ? { kind: 'custom', draw: ({ world, view }) => pinPaint(view, world) }
              : {
                kind: 'square',
                sizePx: SIZE_PX,
                fill: { paint: { kind: 'solid', color: '#ffffff' } },
                stroke: { paint: { kind: 'solid', color: ACCENT }, width: 1 },
              },
            cursor: 'move',
            strength: 'exclusive',
            claimedKinds: ['pointer'],
            bind: () => ({ initialScratch: { warpId: group.warpId, index } satisfies WarpHandleScratch }),
          });
        });
      }
      return out;
    },
    decorate(state, view) {
      const t = viewToTransform(view);
      const out: DrawCommand[] = [];
      for (const group of groupsOf(src, state)) {
        for (const line of guideLines(group)) {
          const screen = line.map((p) => {
            const [x, y] = worldToScreen(p.x, p.y, t);
            return { x, y };
          });
          out.push({ kind: 'path', path: polylineFromPoints(screen), stroke: LINE });
        }
      }
      return out;
    },
  };
}

/**
 * The layer, for `CanvasExtensionApi.registerLayer` — the attach route that
 * is hit-tested. Its guide lines paint before its controls, so a control is
 * never hidden under a line.
 */
export function createWarpHandleLayer(src: WarpHandleLayerSource): RenderLayer<unknown> {
  const lines: Affordance = { id: `${warpLayerId(src.kind)}:lines`, regions: () => [], decorate: warpAffordance(src).decorate };
  const controls: Affordance = { ...warpAffordance(src), decorate: undefined };
  return composeAffordanceLayer(warpLayerId(src.kind), 'Warp controls', [lines, controls]) as unknown as RenderLayer<unknown>;
}
