import type { DrawCommand } from '../../renderer';
import type { Dims, RenderLayer } from '../../core/layers/render';
import type { View } from '../../core/viewport/view';
import { tiledProject } from './tiledProject';

/**
 * How far apart the copies sit, in world units. A bare number wraps the x
 * axis only — the side-scrolling backdrop this is usually reached for.
 * `{ x, y }` wraps both; naming one key wraps that axis alone.
 *
 * The period names the axes, so there is no separate `axis` option: two ways
 * to say which axes wrap is one way for them to disagree.
 */
export type TilePeriod = number | { x?: number; y?: number };

/** How far the content reaches outside its own cell, in world units. */
export type TileBleed = number | { x?: number; y?: number };

/** Options for {@link createTiledLayer}. */
export interface CreateTiledLayerOpts<TData> {
  id: string;
  label: string;
  /** Layers redrawn once per visible copy. */
  source: RenderLayer<TData>[];
  /**
   * The lattice. A function is read per draw, so the period can follow the
   * camera or the canvas — "one screen wide" is a period, not a constant.
   */
  period: TilePeriod | ((view: View, dims: Dims) => TilePeriod);
  /**
   * How far the source's content reaches outside the cell `[0, period)`, in
   * world units. Content that overhangs by more than it declares pops in at
   * the edge of the view instead of scrolling in. Default 0.
   */
  bleed?: TileBleed;
}

interface Axes { x: number; y: number }

function axes(v: TilePeriod | TileBleed | undefined, fallback: number): Axes {
  if (v === undefined) return { x: fallback, y: fallback };
  if (typeof v === 'number') return { x: v, y: fallback };
  return { x: v.x ?? fallback, y: v.y ?? fallback };
}

/** Column-major, the layout `Mat3` documents. */
function translate(tx: number, ty: number): Float32Array {
  return new Float32Array([1, 0, 0, 0, 1, 0, tx, ty, 1]);
}

/**
 * Wrap source RenderLayers in a periodic lattice: the content is authored
 * once, in the cell `[0, period)`, and every copy of it the view can see is
 * drawn. Panning in either direction keeps producing copies, so the content
 * loops seamlessly with no state and no wrap-around bookkeeping.
 *
 * Each copy draws the source through a view shifted by `-k * period`, so a
 * source that culls against the view it is handed culls per copy and never
 * learns it is being tiled. The copy's commands are then translated by
 * `+k * period` in world space.
 *
 * The lattice is per layer, not per shape. Content on two different periods
 * is two tiled layers stacked, which keeps each source ignorant of the other
 * — a per-shape period would move the lattice into the source and make the
 * wrapper unable to cull.
 *
 * The plane is `space: 'world'`, which is what lets it be a `source` of
 * `createParallaxLayer`: the parallax plane hands it the derived inner view,
 * the lattice resolves against that, and the copies ride the plane.
 *
 * **A `space: 'screen'` source is drawn once, untiled** — it ignores the view
 * by definition, so every copy would land on top of the last. Same constraint
 * `createParallaxLayer` carries.
 */
export function createTiledLayer<TData>(
  opts: CreateTiledLayerOpts<TData>,
): RenderLayer<TData> {
  const { id, label, source, period, bleed } = opts;
  return {
    id,
    label,
    space: 'world',
    draw: (data, view, dims) => {
      const p = axes(typeof period === 'function' ? period(view, dims) : period, Infinity);
      const b = axes(bleed, 0);
      const spanX = dims.width / view.scale.x;
      const spanY = dims.height / view.scale.y;
      const kx = tiledProject(view.x, view.x + spanX, p.x, b.x);
      const ky = tiledProject(view.y, view.y + spanY, p.y, b.y);

      const out: DrawCommand[] = [];
      for (const layer of source) {
        if ((layer.space ?? 'world') === 'screen') out.push(...layer.draw(data, view, dims));
      }
      const tiles = source.filter((layer) => (layer.space ?? 'world') !== 'screen');

      for (let i = kx.from; i <= kx.to; i++) {
        for (let j = ky.from; j <= ky.to; j++) {
          const tx = Number.isFinite(p.x) ? i * p.x : 0;
          const ty = Number.isFinite(p.y) ? j * p.y : 0;
          const shifted: View = { ...view, x: view.x - tx, y: view.y - ty };
          const children: DrawCommand[] = [];
          for (const layer of tiles) children.push(...layer.draw(data, shifted, dims));
          if (children.length === 0) continue;
          out.push(tx === 0 && ty === 0
            ? { kind: 'group', children }
            : { kind: 'group', transform: translate(tx, ty), children });
        }
      }
      return out;
    },
  };
}
