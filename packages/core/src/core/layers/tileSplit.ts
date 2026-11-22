/**
 * Baking a layer's tiles under a frame budget: a tile whose bake would pass what the frame has left
 * is baked in parts over several frames, each part culled and clipped to its own square of texels.
 */
import { pathFromD } from '@weasel-js/geom';
import { viewToMat3, type DrawCommand, type TileBake, type TileTexture } from '@weasel-js/renderer';
import type { PlaneTileKey, TileBox } from '@weasel-js/tiles';
import type { View } from 'core/viewport/view';
import type { LayerDims } from './dims';

/** What a host bakes tiles with: a renderer's `tiles`. */
export interface TileBaker {
  bake(commands: readonly DrawCommand[], size: number): TileTexture | null;
  /** Start a tile baked over several calls, or null where the context is lost. */
  begin(size: number): TileBake | null;
  release(tile: TileTexture): void;
  idle(): void;
  readonly bytes: number;
  readonly generation: number;
}

/** Texels past each edge of a tile that it bakes, so bilinear sampling at a seam reads its neighbor's content. */
export const GUTTER = 1;
/** A part is never split below this share of its tile's side. */
const MIN_PART = 1 / 16;
/** At a level whose cost is not known yet, the first part baked is this share of the tile's side. */
const PROBE_PART = 1 / 4;
/** How far one part's measure lowers a level's cost, at most. */
const DECAY = 0.75;
/** What a part may cost even when the frame has nothing left, so a bake always moves. */
const FLOOR_MS = 2;

type Box = readonly [number, number, number, number];
type Draw = (view: View, dims: LayerDims) => DrawCommand[];
interface Scheme { boundsOf(k: PlaneTileKey): Float64Array; texelsPerUnit(k: PlaneTileKey): number; idOf(k: PlaneTileKey): string }

/** One layer's bakes: what each level has cost, and the tile being baked in parts. */
export interface TileBakes {
  /** Bake `key`, or more of it, until `deadline`: the tile once it is whole, else null. */
  bake(key: PlaneTileKey, draw: Draw, deadline: number): TileTexture | null;
  /** Throw away a tile part-baked under any of `boxes`, in world units, or under anything for `'all'`. */
  damaged(boxes: 'all' | readonly TileBox[]): void;
  /** A tile is part-baked: another frame is owed. */
  readonly inFlight: boolean;
  dispose(): void;
}

export function createTileBakes(baker: TileBaker, scheme: Scheme, tilePx: number, clock: () => number): TileBakes {
  const size = tilePx + 2 * GUTTER;
  const area = size * size;
  /** Milliseconds a texel, by level: the costliest part baked there lately. */
  const costs = new Map<number, number>();
  /** What a texel at level `z` is likely to cost: its own measure, else the nearest level's, a texel
   *  a level coarser covering four times the world. */
  const costAt = (z: number): number | undefined => {
    const own = costs.get(z);
    if (own !== undefined) return own;
    let best: number | undefined, gap = Infinity;
    for (const [at, c] of costs) {
      if (Math.abs(at - z) < gap) [best, gap] = [c * 4 ** (at - z), Math.abs(at - z)];
    }
    return best;
  };
  let part: { id: string; key: PlaneTileKey; bake: TileBake; todo: Box[] } | null = null;

  const drawn = (key: PlaneTileKey, draw: Draw, box: Box): DrawCommand[] => {
    const b = scheme.boundsOf(key);
    const k = scheme.texelsPerUnit(key);
    const tileView: View = { x: b[0]! - GUTTER / k, y: b[1]! - GUTTER / k, scale: { x: k, y: k } };
    const [x0, y0, x1, y1] = box;
    const whole = x0 === 0 && y0 === 0 && x1 === size && y1 === size;
    const view: View = whole ? tileView : { x: tileView.x + x0 / k, y: tileView.y + y0 / k, scale: tileView.scale };
    const cmds = draw(view, { width: x1 - x0, height: y1 - y0, dpr: 1, bake: true });
    const tile: DrawCommand = { kind: 'group', transform: viewToMat3(tileView), children: cmds };
    return whole ? [tile] : [{ kind: 'group', clip: pathFromD(`M${x0} ${y0}H${x1}V${y1}H${x0}Z`), children: [tile] }];
  };
  const timed = <T>(z: number, texels: number, run: () => T): T => {
    const t0 = clock();
    const out = run();
    // A cheap part lowers the measure slowly: the next one may land where the layer is dense.
    const measured = (clock() - t0) / texels;
    costs.set(z, Math.max(measured, (costs.get(z) ?? 0) * DECAY));
    return out;
  };
  const cancel = () => {
    part?.bake.cancel();
    part = null;
  };

  return {
    bake(key, draw, deadline) {
      const id = scheme.idOf(key);
      if (part && part.id !== id) cancel();
      const cost = costAt(key.z);
      if (!part) {
        if (cost !== undefined && cost * area <= Math.max(deadline - clock(), FLOOR_MS)) {
          return timed(key.z, area, () => baker.bake(drawn(key, draw, [0, 0, size, size]), size));
        }
        const bake = baker.begin(size);
        if (!bake) return null;
        part = { id, key, bake, todo: [[0, 0, size, size]] };
      }
      const p = part;
      let did = 0;
      while (p.todo.length > 0) {
        const box = p.todo.pop()!;
        const w = box[2] - box[0], h = box[3] - box[1];
        const known = costAt(key.z);
        const est = known === undefined ? (w > size * PROBE_PART ? Infinity : 0) : known * w * h;
        const left = Math.max(deadline - clock(), did === 0 ? FLOOR_MS : 0);
        if (est > left && w > size * MIN_PART) {
          p.todo.push(...quarters(box).reverse());
          continue;
        }
        if (did > 0 && est > left) {
          p.todo.push(box);
          break;
        }
        const ok = timed(key.z, w * h, () => p.bake.draw(drawn(key, draw, box)));
        if (!ok) {
          cancel();
          return null;
        }
        did++;
        if (clock() >= deadline) break;
      }
      if (p.todo.length > 0) return null;
      part = null;
      return p.bake.finish();
    },
    damaged(boxes) {
      if (!part) return;
      if (boxes === 'all') return cancel();
      const b = scheme.boundsOf(part.key);
      if (boxes.some((d) => d[0]! < b[2]! && d[2]! > b[0]! && d[1]! < b[3]! && d[3]! > b[1]!)) cancel();
    },
    get inFlight() { return part !== null; },
    dispose: cancel,
  };
}

/** `box` cut into four at its middle, in reading order. */
function quarters([x0, y0, x1, y1]: Box): Box[] {
  const mx = Math.floor((x0 + x1) / 2), my = Math.floor((y0 + y1) / 2);
  return [[x0, y0, mx, my], [mx, y0, x1, my], [x0, my, mx, y1], [mx, my, x1, y1]];
}
