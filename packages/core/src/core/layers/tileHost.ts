/**
 * A canvas's tiled layers: a tile pyramid per layer, baked through the canvas's own renderer under
 * one frame budget, and drawn as tile quads in place of the layer's commands.
 */
import { pathFromD } from '@weasel-js/geom';
import { viewToMat3, type DrawCommand, type TileTexture } from '@weasel-js/renderer';
import { createPlaneScheme, planeFloor, TilePyramid, type PlaneTileKey, type PlaneTileView, type TileDraw } from '@weasel-js/tiles';
import { sameList } from '@weasel-js/registry';
import type { View } from 'core/viewport/view';
import type { LayerDims } from './dims';
import { DEFAULT_TILE_BUDGET, DEFAULT_TILE_PX, type TileBudgetOptions, type TileOptions } from './tiles';

/** What a host bakes tiles with: a renderer's `tiles`. */
export interface TileBaker {
  bake(commands: readonly DrawCommand[], size: number): TileTexture | null;
  release(tile: TileTexture): void;
  idle(): void;
  readonly bytes: number;
  readonly generation: number;
}

/** What a frame of a host's tiled layers came to. */
export interface TileHostStats {
  /** Tiles baked this frame, across every tiled layer. */
  baked: number;
  /** Milliseconds spent baking them, on the CPU. */
  bakeMs: number;
  /** Quads drawn from a coarser or finer tile in place of a missing one. */
  standIns: number;
  /** Times a tiled layer's own commands were drawn for the screen this frame: past its `maxLevel`,
   *  or through its stale tiles while an edit goes on. A bake is not counted. */
  liveDraws: number;
  /** Tiles held, and the bytes their textures take, across every tiled layer. */
  held: number;
  bytes: number;
}

/** A canvas's tiled layers, kept across frames. */
export interface TileHost {
  /**
   * The commands drawing `layer` from its tiles under `view`, in world space: tile quads, and the
   * layer drawn live through its stale tiles while they are being edited. `draw` is the layer's own
   * draw, which a bake calls under the tile's view. A change in `deps` from the last frame's stales
   * every tile of the layer.
   */
  layerFrame(
    layerId: string, opts: TileOptions, view: View, dims: LayerDims,
    draw: (view: View, dims: LayerDims) => DrawCommand[], deps: readonly unknown[] | undefined,
  ): DrawCommand[];
  /** Close a frame: free the pyramids of layers it did not draw, and the scratch buffer if it baked nothing. */
  endFrame(): void;
  /** Tiles are still wanted or fading: the canvas should draw another frame. */
  owesFrame(): boolean;
  stats(): TileHostStats;
  dispose(): void;
}

/** Texels past each edge of a tile that it bakes, so bilinear sampling at a seam reads its neighbor's content. */
const GUTTER = 1;
/** A stale region drawn live through, while an edit goes on, may cover at most this share of the screen's tiles. */
const DRAW_THROUGH_SHARE = 0.25;

type Pyramid = TilePyramid<PlaneTileKey, PlaneTileView, TileTexture>;
interface LayerTiles { pyramid: Pyramid; tilePx: number; seen: boolean; last: View | null; deps: readonly unknown[] | undefined }

/** The world box `view` shows on a `dims` canvas, `[x0, y0, x1, y1]`. */
function worldBox(view: View, dims: LayerDims): number[] {
  const ax = view.x, bx = view.x + dims.width / view.scale.x;
  const ay = view.y, by = view.y + dims.height / view.scale.y;
  return [Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)];
}

/** A host baking through `baker`, sharing `budget` across its layers. */
export function createTileHost(baker: TileBaker, budget: TileBudgetOptions = {}, clock: () => number = () => performance.now()): TileHost {
  const layers = new Map<string, LayerTiles>();
  const share = { ...DEFAULT_TILE_BUDGET, ...budget };
  let generation = baker.generation;
  let frameStart = 0;
  let owes = false;
  let stats: TileHostStats = { baked: 0, bakeMs: 0, standIns: 0, liveDraws: 0, held: 0, bytes: 0 };
  let opened = false;

  const open = () => {
    if (opened) return;
    opened = true;
    frameStart = clock();
    owes = false;
    stats = { baked: 0, bakeMs: 0, standIns: 0, liveDraws: 0, held: 0, bytes: 0 };
    // Every texture went with the context: start over.
    if (baker.generation !== generation) {
      generation = baker.generation;
      for (const l of layers.values()) l.pyramid.clear();
    }
  };

  const pyramidFor = (id: string, opts: TileOptions): LayerTiles => {
    const tilePx = opts.tilePx ?? DEFAULT_TILE_PX;
    let l = layers.get(id);
    if (l && l.tilePx !== tilePx) {
      l.pyramid.clear();
      l = undefined;
    }
    if (!l) {
      const scheme = createPlaneScheme(tilePx);
      const size = tilePx + 2 * GUTTER;
      const pyramid: Pyramid = new TilePyramid({
        scheme, maxLevel: opts.maxLevel, fadeMs: opts.fadeMs ?? 160, maxBytes: share.bytes, bytesPerTile: size * size * 4,
        bytesOf: (t) => t.size * t.size * 4,
        release: (t) => baker.release(t),
        floor: () => {
          const b = opts.bounds?.();
          return b ? planeFloor(scheme, tilePx, b, opts.floorTiles ?? 2) : [];
        },
      });
      l = { pyramid, tilePx, seen: true, last: null, deps: undefined };
      layers.set(id, l);
    }
    l.seen = true;
    return l;
  };

  return {
    layerFrame(layerId, opts, view, dims, draw, deps) {
      open();
      const l = pyramidFor(layerId, opts);
      const depsMoved = deps !== undefined && l.deps !== undefined && !sameList(l.deps, deps, Object.is);
      l.deps = deps;
      const { pyramid, tilePx } = l;
      const damage = opts.damage?.since();
      if (depsMoved || damage === 'all') pyramid.dirtyAll();
      else if (damage) for (const box of damage) pyramid.dirty(box);

      const scheme = pyramid.cache.scheme;
      const bake = bakeWith(baker, scheme, tilePx, draw);
      const box = worldBox(view, dims);
      const motion: [number, number] | undefined = l.last ? [view.x - l.last.x, view.y - l.last.y] : undefined;
      l.last = { x: view.x, y: view.y, scale: { ...view.scale } };
      const pxPerUnit = Math.max(Math.abs(view.scale.x), Math.abs(view.scale.y)) * dims.dpr;
      const t0 = clock();
      const spent = t0 - frameStart;
      const frame = pyramid.run({ box, pxPerUnit, ...(motion ? { motion } : {}) }, t0, bake, {
        ms: Math.max(0, share.ms - spent), tiles: Math.max(1, share.tiles - stats.baked), clock,
      });
      stats.baked += frame.baked;
      stats.bakeMs += clock() - t0;
      if (frame.pending > 0 || frame.fading) owes = true;
      if (frame.live) {
        stats.liveDraws++;
        return draw(view, dims);
      }
      const out: DrawCommand[] = frame.draws.map((d) => quadOf(d, scheme, tilePx));
      for (const d of frame.draws) if (d.tile.id !== scheme.idOf(d.at)) stats.standIns++;
      // An edit in progress draws through its stale tiles live, while they cover little of the screen;
      // they rebake once it has held still for a frame.
      const editing = frame.stale.filter((k) => (pyramid.cache.get(scheme.idOf(k))?.dirtiedAt ?? -1) >= pyramid.frame - 1);
      const onScreen = (scheme as typeof scheme & { wanted(v: PlaneTileView, z: number): readonly { ring?: boolean }[] })
        .wanted({ box, pxPerUnit }, frame.level).filter((w) => !w.ring).length;
      if (editing.length > 0 && editing.length <= Math.max(1, onScreen * DRAW_THROUGH_SHARE)) {
        stats.liveDraws++;
        out.push({ kind: 'group', clip: unionOf(editing.map((k) => scheme.boundsOf(k))), children: draw(view, dims) });
        owes = true;
      }
      return out;
    },
    endFrame() {
      open();
      opened = false;
      let held = 0;
      for (const [id, l] of layers) {
        if (!l.seen) {
          l.pyramid.clear();
          layers.delete(id);
          continue;
        }
        l.seen = false;
        held += l.pyramid.cache.count;
      }
      stats.held = held;
      stats.bytes = baker.bytes;
      if (stats.baked === 0) baker.idle();
    },
    owesFrame: () => owes,
    stats: () => stats,
    dispose() {
      for (const l of layers.values()) l.pyramid.clear();
      layers.clear();
      baker.idle();
    },
  };
}

/** Bake a tile of a layer drawn by `draw`: its commands under the tile's own view, a texel to the unit, its gutter included. */
function bakeWith(
  baker: TileBaker, scheme: { boundsOf(k: PlaneTileKey): Float64Array; texelsPerUnit(k: PlaneTileKey): number },
  tilePx: number, draw: (view: View, dims: LayerDims) => DrawCommand[],
): (key: PlaneTileKey) => TileTexture | null {
  const size = tilePx + 2 * GUTTER;
  return (key) => {
    const b = scheme.boundsOf(key);
    const k = scheme.texelsPerUnit(key);
    const tileView: View = { x: b[0]! - GUTTER / k, y: b[1]! - GUTTER / k, scale: { x: k, y: k } };
    const cmds = draw(tileView, { width: size, height: size, dpr: 1, bake: true });
    return baker.bake([{ kind: 'group', transform: viewToMat3(tileView), children: cmds }], size);
  };
}

/** The tile command drawing `d`: its spot's world box, sampling its part of the tile inside the gutter. */
function quadOf(d: TileDraw<PlaneTileKey, TileTexture>, scheme: { boundsOf(k: PlaneTileKey): Float64Array }, tilePx: number): DrawCommand {
  const b = scheme.boundsOf(d.at);
  const s = d.source;
  return {
    kind: 'tile', tile: d.tile.payload, x: b[0]!, y: b[1]!, width: b[2]! - b[0]!, height: b[3]! - b[1]!,
    source: { x: GUTTER + s[0]! * tilePx, y: GUTTER + s[1]! * tilePx, width: (s[2]! - s[0]!) * tilePx, height: (s[3]! - s[1]!) * tilePx },
    ...(d.alpha < 1 ? { opacity: d.alpha } : {}),
  };
}

/** The union of disjoint boxes as one clip path. */
function unionOf(boxes: readonly Float64Array[]) {
  return pathFromD(boxes.map((b) => `M${b[0]} ${b[1]}H${b[2]}V${b[3]}H${b[0]}Z`).join(''));
}
