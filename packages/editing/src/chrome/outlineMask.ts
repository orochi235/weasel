/**
 * The mask behind `outline.mask`: what paints in front of an outlined node
 * covers its outline, as it covers the node.
 *
 * The overlay paints after the whole scene, so the outline is clipped to the
 * world outside every later node's ink. The clip is one evenodd path, a frame
 * around everything with the union of those regions inside it, because nested
 * clips intersect and the renderer allows seven.
 */
import {
  asPolygonPath, boundsOfPath, growRect, joinPaths, rectPath, rectsOverlap, unionRects, type Path, type Rect,
} from '@weasel-js/geom';
import { multiPolygonToPath, pathToMultiPolygon, pathUnion } from '@weasel-js/geom/booleans';
import type { DrawCommand } from '@weasel-js/renderer';
import type { CommandStroke } from '@weasel-js/paint';
import { isNodeHidden, sceneLayerPaintedFrom, type DrawnBoundsScene, type NodeId, type View } from '@weasel-js/core';
import { edgeOfReach, inkReachOf, shapeOutlineCommands, type EdgeCache, type ShapeOutlineReads } from './shapeOutline';

/** A shapes scene a mask can read: paint order and a version to key on. */
export type MaskScene = DrawnBoundsScene & Required<Pick<DrawnBoundsScene, 'renderOrderNodes' | 'getVersion'>>;

/** What one frame's masks read beyond the outline's own reads. */
export interface MaskReads extends ShapeOutlineReads {
  scene: MaskScene;
  /** Whether the view paints scene layer `id`. Default: every layer. */
  paints?: (layer: string) => boolean;
}

/** `scene` as a {@link MaskScene}, or a throw naming what `outline.mask` is missing. */
export function requireMaskScene(scene: DrawnBoundsScene): MaskScene {
  if (typeof scene.renderOrderNodes !== 'function' || typeof scene.getVersion !== 'function') {
    throw new Error(
      'weasel: outline.mask needs a shapes scene that answers renderOrderNodes() and getVersion(), as a Scene does.',
    );
  }
  return scene as MaskScene;
}

/**
 * The ids painted after `id` whose ink meets `area`, a world rect, and the
 * region each covers, in paint order. `id`'s own subtree is part of it and
 * covers nothing; a group covers with its members, which come after it.
 */
export function occludersOf(
  id: string, area: Rect, reads: MaskReads, scale: number, edges: EdgeCache,
): { ids: string[]; regions: Path[] } {
  const { scene } = reads;
  const order = scene.renderOrderNodes();
  const ids: string[] = [];
  const regions: Path[] = [];
  let at = order.findIndex((n) => n.id === id);
  if (at < 0) return { ids, regions };
  const own = subtreeOf(scene, id as NodeId);
  for (at++; at < order.length; at++) {
    const other = order[at]!.id;
    if (own.has(other)) continue;
    const node = scene.get(other);
    if (!node || node.kind === 'group' || isNodeHidden(scene, other)) continue;
    if (reads.paints && !reads.paints(node.layer)) continue;
    const reach = inkReachOf(other, node, reads, scale);
    if (!reach) continue;
    // A closed edge stays within its silhouette's box grown by the reach at a
    // miter's default limit; an open one's heads can reach further, so it is built.
    if (!reach.open && !rectsOverlap(growRect(boundsOfPath(reach.silhouette), reach.distance * 4), area)) continue;
    const region = edgeOfReach(other, reach, reads, scale, edges);
    if (!region || !rectsOverlap(boundsOfPath(region), area)) continue;
    ids.push(other);
    regions.push(region);
  }
  return { ids, regions };
}

function subtreeOf(scene: DrawnBoundsScene, id: NodeId): Set<string> {
  const out = new Set<string>();
  const walk = (at: NodeId) => {
    for (const child of scene.childrenOf?.(at) ?? []) {
      if (out.has(child)) continue;
      out.add(child);
      walk(child);
    }
  };
  walk(id);
  return out;
}

/** How far a flattened region may stray from its curve, in screen pixels. */
const FLATTEN_PX = 0.25;

/**
 * A clip that keeps out of `regions`: a frame round them and `area` with their
 * union cut out. Each region is flattened to {@link FLATTEN_PX} at `scale`
 * first, which a clip cannot tell from the curve and which unites in
 * milliseconds where a curve-kept union of a few hundred ellipses takes a
 * tenth of a second.
 */
export function clipOutside(regions: readonly Path[], area: Rect, scale: number): Path | null {
  if (regions.length === 0) return null;
  const flattenTolerance = FLATTEN_PX / scale;
  const union = pathUnion(...regions.map((r) => multiPolygonToPath(pathToMultiPolygon(r, { flattenTolerance }))));
  if (union.commands.length === 0) return null;
  const frame = growRect(unionRects([boundsOfPath(union), area])!, 1);
  const joined = joinPaths([asPolygonPath(rectPath(frame.x, frame.y, frame.width, frame.height)), union]);
  return { ...joined, fillRule: 'evenodd' };
}

interface HeldMask {
  version: number;
  generation: number;
  scale: number;
  layers: string;
  edge: Path;
  clip: Path | null;
  occluders: readonly string[];
}

/**
 * A per-layer builder of outline masks. Each outlined id's clip is kept until
 * the scene's version or override generation moves, the view's scale or
 * painted layers change, or its own edge is rebuilt; each occluder's region
 * is kept as the outliner keeps an edge.
 */
export function createOutlineMasker(): {
  /** The clip for each of `edges`, the outline of the id at the same index in
   *  `ids`, or `null` where nothing covers it. `reachPx` is how far the stroke
   *  reaches past its edge on screen. */
  clips(ids: readonly string[], edges: readonly Path[], reads: MaskReads, scale: number, reachPx: number): (Path | null)[];
} {
  const held = new Map<string, HeldMask>();
  const regions: EdgeCache = new Map();
  return {
    clips(ids, edges, reads, scale, reachPx) {
      const version = reads.scene.getVersion();
      const generation = reads.scene.overrides?.getGeneration() ?? 0;
      const layers = paintedKey(reads);
      let rebuilt = false;
      const out = ids.map((id, i) => {
        const edge = edges[i]!;
        const h = held.get(id);
        if (h && h.version === version && h.generation === generation && h.scale === scale
          && h.layers === layers && h.edge === edge) return h.clip;
        rebuilt = true;
        const area = growRect(boundsOfPath(edge), (reachPx + 1) / scale);
        const found = occludersOf(id, area, reads, scale, regions);
        const clip = clipOutside(found.regions, area, scale);
        held.set(id, { version, generation, scale, layers, edge, clip, occluders: found.ids });
        return clip;
      });
      if (rebuilt || held.size > ids.length) prune(held, regions, ids);
      return out;
    },
  };
}

function paintedKey(reads: MaskReads): string {
  if (!reads.paints) return '';
  return (reads.scene.layers ?? []).map((l) => (reads.paints!(l.id) ? '1' : '0')).join('');
}

function prune(held: Map<string, HeldMask>, regions: EdgeCache, ids: readonly string[]): void {
  const live = new Set(ids);
  for (const id of held.keys()) if (!live.has(id)) held.delete(id);
  const used = new Set<string>();
  for (const h of held.values()) for (const o of h.occluders) used.add(o);
  for (const id of regions.keys()) if (!used.has(id)) regions.delete(id);
}

/** Which scene layers the view drawing `data` paints, as {@link MaskReads.paints}. */
export function viewPaints(data: unknown, scene: DrawnBoundsScene): Pick<MaskReads, 'paints'> {
  if (!scene.layers) return {};
  return { paints: sceneLayerPaintedFrom(data, scene.layers.map((l) => ({ id: l.id, visible: true }))) };
}

/** The outline commands for `traced`'s paths: those nothing covers in one
 *  group, and each covered one in a group of its own under its clip. */
export function maskedOutlineCommands(
  traced: { paths: readonly Path[] }, stroke: CommandStroke, view: View, clips: readonly (Path | null)[],
): DrawCommand[] {
  const open = traced.paths.filter((_, i) => clips[i] == null);
  const out = shapeOutlineCommands(open, stroke, view);
  traced.paths.forEach((path, i) => {
    const clip = clips[i];
    if (clip) out.push(...shapeOutlineCommands([path], stroke, view, clip));
  });
  return out;
}
