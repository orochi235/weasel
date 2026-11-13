import type { DrawCommand } from '@weasel-js/core';
import { drawOneLayer, subscribeToSources, viewportWorldRect, type Dims, type RenderLayer } from '@weasel-js/core';
import type { View } from '@weasel-js/core';
import { tiledProject } from './tiledProject';

/**
 * How far apart the copies sit, in world units. A bare number wraps the x
 * axis only — the side-scrolling backdrop this is usually reached for.
 * `{ x, y }` wraps both; naming one key wraps that axis alone.
 */
export type TilePeriod = number | { x?: number; y?: number };

/** How far the content reaches outside its own cell, in world units. */
export type TileBleed = number | { x?: number; y?: number };

/** Options for {@link createTiledLayer}. */
export interface CreateTiledLayerOptions<TData> {
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

/** Copies one draw will make. Past this the view is zoomed so far out that a
 *  cell covers a pixel or two, and each copy still costs a full source draw. */
const MAX_COPIES = 4096;

function axes(v: TilePeriod | TileBleed | undefined, fallback: number): Axes {
  if (v === undefined) return { x: fallback, y: fallback };
  if (typeof v === 'number') return { x: v, y: fallback };
  return { x: v.x ?? fallback, y: v.y ?? fallback };
}

/** Column-major, the layout `GlMat3` documents. */
function translate(tx: number, ty: number): Float64Array {
  return new Float64Array([1, 0, 0, 0, 1, 0, tx, ty, 1]);
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
 * is two tiled layers stacked. Sources keep their order in every copy, and a
 * source's `effects` run once over all of its copies.
 *
 * The plane is `space: 'world'`, which is what lets it be a `source` of
 * `createParallaxLayer`: the parallax plane hands it the derived inner view,
 * the lattice resolves against that, and the copies ride the plane.
 *
 * **Zoomed out until a draw would take more than a few thousand copies, the
 * lattice draws none.** A cell is then a pixel or two across.
 *
 * **A `space: 'screen'` source is drawn once, untiled, in screen space**, in its place among the sources — it
 * ignores the view by definition, so every copy would land on top of the last. Same constraint
 * `createParallaxLayer` carries. Under a view with no finite inverse, zoomed to 0 or a denormal on an axis,
 * it draws nothing.
 */
export function createTiledLayer<TData>(
  opts: CreateTiledLayerOptions<TData>,
): RenderLayer<TData> {
  const { id, label, source, period, bleed } = opts;
  return {
    id,
    label,
    space: 'world',
    subscribe: subscribeToSources(source),
    draw: (data, view, dims) => {
      const p = axes(typeof period === 'function' ? period(view, dims) : period, Infinity);
      const b = axes(bleed, 0);
      const shown = viewportWorldRect(view, dims);
      const kx = tiledProject(shown.x, shown.x + shown.width, p.x, b.x);
      const ky = tiledProject(shown.y, shown.y + shown.height, p.y, b.y);

      const out: DrawCommand[] = [];
      // Written so a non-finite span, which a zero view scale gives, fails it too. Past a safe
      // integer `i++` never moves, so a view panned that far draws no copies either.
      const tiling = (kx.to - kx.from + 1) * (ky.to - ky.from + 1) <= MAX_COPIES
        && [kx.from, kx.to, ky.from, ky.to].every(Number.isSafeInteger);

      // Layer by layer, so a later source sits above an earlier one in every copy, and a
      // layer's effects run once over all of its copies.
      for (const layer of source) {
        if ((layer.space ?? 'world') === 'screen') {
          // This plane is drawn through the view, so screen content is handed the view's inverse; a view
          // with none, zoomed to 0 or a denormal, collapses the plane to a point, and the content with it.
          const inverse = new Float64Array([1 / view.scale.x, 0, 0, 0, 1 / view.scale.y, 0, view.x, view.y, 1]);
          if (!inverse.every(Number.isFinite)) continue;
          const onScreen = drawOneLayer(layer, data, view, dims);
          if (onScreen.length > 0) out.push({ kind: 'group', transform: inverse, children: onScreen });
          continue;
        }
        if (!tiling) continue;
        const drawCopies = (): DrawCommand[] => {
          const copies: DrawCommand[] = [];
          for (let i = kx.from; i <= kx.to; i++) {
            for (let j = ky.from; j <= ky.to; j++) {
              const tx = Number.isFinite(p.x) ? i * p.x : 0;
              const ty = Number.isFinite(p.y) ? j * p.y : 0;
              const shifted: View = { ...view, x: view.x - tx, y: view.y - ty };
              const children = layer.draw(data, shifted, dims);
              if (children.length === 0) continue;
              copies.push(tx === 0 && ty === 0
                ? { kind: 'group', children }
                : { kind: 'group', transform: translate(tx, ty), children });
            }
          }
          return copies;
        };
        // Through `drawOneLayer`, as a parallax plane draws its sources, so a source that throws paints
        // nothing and is reported by its own id while the rest of the lattice still draws. As a screen
        // layer with no effects it hands the copies back unwrapped.
        const copies = drawOneLayer({ id: layer.id, label: layer.label, space: 'screen', draw: drawCopies }, data, view, dims);
        if (copies.length === 0) continue;
        if (layer.effects && layer.effects.length > 0) out.push({ kind: 'group', effects: layer.effects, children: copies });
        else out.push(...copies);
      }
      return out;
    },
  };
}
