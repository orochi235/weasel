/**
 * The layers drawing a puppet warp's mesh: each triangle filled by how much
 * its area changed, turned-over ones in magenta and ringed, and the stretches
 * of outline those own drawn heavy. They follow a pin mid-drag by reading the
 * drag's preview off their draw envelope.
 */
import {
  type CanvasViewHelpers, type EditableShape, flattenPreviews, type RenderLayer, resolvePreviews, type Scene, type View,
} from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';
import { ellipsePath, PATH_L, PATH_M, PATH_Z, type PolygonPath } from '@weasel-js/geom';
import { meshModelOf, type MeshModel, type Stage } from './meshModel';

export type MeshShow = 'area' | 'wire' | 'off';

export interface MeshDisplay {
  stage: Stage;
  show: MeshShow;
}

export const INVERTED = '#ff2bd6';
const SHRUNK = [58, 111, 216];
const SAME = [216, 216, 208];
const GROWN = [232, 144, 44];
const WIRE = 'rgba(24, 24, 32, 0.45)';
/** Area ratios are binned in quarter steps of log2, from half to double. */
const STEPS = 4;
/** Screen radius of the ring around a turned-over triangle, which can be too thin to see. */
const RING_PX = 9;

const mix = (a: number[], b: number[], t: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(', ')})`;

/** The color a triangle takes for its area ratio, in bins from halved to doubled; turned over is magenta. */
export function areaColor(ratio: number): string {
  if (!(ratio > 0)) return INVERTED;
  const bin = Math.max(-STEPS, Math.min(STEPS, Math.round(Math.log2(ratio) * STEPS)));
  return bin < 0 ? mix(SAME, SHRUNK, -bin / STEPS) : mix(SAME, GROWN, bin / STEPS);
}

/** What the panel's key shows, in the colors the layer paints. */
export const LEGEND: readonly { label: string; color: string }[] = [
  { label: 'Halved', color: areaColor(0.5) },
  { label: 'Unchanged', color: areaColor(1) },
  { label: 'Doubled', color: areaColor(2) },
  { label: 'Turned over', color: INVERTED },
];

function trianglesPath(world: Float64Array, T: Uint32Array, tris: readonly number[]): PolygonPath {
  const commands = new Uint8Array(4 * tris.length);
  const coords = new Float32Array(6 * tris.length);
  tris.forEach((t, k) => {
    commands.set([PATH_M, PATH_L, PATH_L, PATH_Z], 4 * k);
    for (let c = 0; c < 3; c++) {
      coords[6 * k + 2 * c] = world[2 * T[3 * t + c]];
      coords[6 * k + 2 * c + 1] = world[2 * T[3 * t + c] + 1];
    }
  });
  return { kind: 'polygon', commands, coords, fillRule: 'nonzero' };
}

function segmentsPath(world: Float64Array, edges: readonly { a: number; b: number }[]): PolygonPath {
  const commands = new Uint8Array(2 * edges.length);
  const coords = new Float32Array(4 * edges.length);
  edges.forEach(({ a, b }, k) => {
    commands.set([PATH_M, PATH_L], 2 * k);
    coords.set([world[2 * a], world[2 * a + 1], world[2 * b], world[2 * b + 1]], 4 * k);
  });
  return { kind: 'polygon', commands, coords, fillRule: 'nonzero' };
}

const magenta = (width: number) => ({ paint: { kind: 'solid' as const, color: INVERTED }, width });

/** The mesh's draw commands, in world space; `px` is one screen pixel in world units. */
export function meshCommands(model: MeshModel, show: MeshShow, px: number): DrawCommand[] {
  if (show === 'off') return [];
  const { triangles: T, world, ratio } = model;
  const out: DrawCommand[] = [];
  const all = Array.from(ratio, (_, t) => t);
  if (show === 'area') {
    const bins = new Map<string, number[]>();
    for (const t of all) {
      const color = areaColor(ratio[t]);
      if (color !== INVERTED) (bins.get(color) ?? bins.set(color, []).get(color)!).push(t);
    }
    for (const [color, tris] of bins) out.push({ kind: 'path', path: trianglesPath(world, T, tris), fill: { paint: { kind: 'solid', color } } });
  }
  out.push({ kind: 'path', path: trianglesPath(world, T, all), stroke: { paint: { kind: 'solid', color: WIRE }, width: px } });
  // Turned over last, so another triangle folded across one cannot hide it.
  const flipped = all.filter((t) => ratio[t] <= 0);
  if (flipped.length > 0) out.push({ kind: 'path', path: trianglesPath(world, T, flipped), fill: { paint: { kind: 'solid', color: INVERTED } } });
  return out;
}

/**
 * Drawn over the shape: a ring around each turned-over triangle, and heavy
 * over each stretch of outline one owns, where the refit outline doubles back.
 */
export function backwardCommands(model: MeshModel, px: number): DrawCommand[] {
  const { triangles: T, world, ratio } = model;
  const out: DrawCommand[] = [];
  const r = RING_PX * px;
  for (let t = 0; t < ratio.length; t++) {
    if (ratio[t] > 0) continue;
    let cx = 0, cy = 0;
    for (let k = 0; k < 3; k++) { cx += world[2 * T[3 * t + k]] / 3; cy += world[2 * T[3 * t + k] + 1] / 3; }
    out.push({ kind: 'path', path: ellipsePath({ x: cx - r, y: cy - r, width: 2 * r, height: 2 * r }), stroke: magenta(2 * px) });
  }
  const backward = model.outline.filter((e) => ratio[e.tri] <= 0);
  if (backward.length > 0) out.push({ kind: 'path', path: segmentsPath(world, backward), stroke: magenta(4 * px) });
  return out;
}

export interface MeshLayerSource {
  scene: Scene<unknown, string, unknown>;
  nodeId: string;
  display(): MeshDisplay;
  /** Told the model each paint draws, the drag's included. */
  onModel?(model: MeshModel | null): void;
}

/** The node as drawn this frame: the drag's preview of it when one is in flight. */
function liveNode(src: MeshLayerSource, envelope: unknown): EditableShape | null {
  const sources = (envelope as Partial<CanvasViewHelpers<unknown>> | null)?.getPreviewSources?.() ?? [];
  const preview = flattenPreviews(resolvePreviews(sources, src.scene)).find((p) => p.id === src.nodeId);
  if (preview) return { ...preview.node, pose: preview.pose, data: preview.data } as EditableShape;
  return (src.scene.get(src.nodeId as never) as EditableShape | undefined) ?? null;
}

/**
 * Two layers over one model: the mesh, to go under the shape, and the rings
 * and backward outline stretches, to go over the shape's own outline.
 */
export function createMeshLayers(src: MeshLayerSource): { mesh: RenderLayer<unknown>; backward: RenderLayer<unknown> } {
  // Keyed on the node's data and pose, not the node: the scene swaps those on a node object it keeps.
  let last: { data: unknown; pose: unknown; stage: Stage; model: MeshModel | null } | null = null;
  const modelFor = (envelope: unknown): MeshModel | null => {
    const { stage } = src.display();
    const node = liveNode(src, envelope);
    if (!last || last.stage !== stage || last.data !== node?.data || last.pose !== node?.pose) {
      last = { data: node?.data, pose: node?.pose, stage, model: meshModelOf(node, stage) };
    }
    return last.model;
  };
  const px = (view: View) => 1 / Math.abs(view.scale.x);
  return {
    mesh: {
      id: 'puppet-mesh',
      label: 'Puppet mesh',
      draw: (envelope, view) => {
        const model = modelFor(envelope);
        src.onModel?.(model);
        return model ? meshCommands(model, src.display().show, px(view)) : [];
      },
    },
    backward: {
      id: 'puppet-backward',
      label: 'Backward outline',
      draw: (envelope, view) => {
        const model = modelFor(envelope);
        return model ? backwardCommands(model, px(view)) : [];
      },
    },
  };
}
