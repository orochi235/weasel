import { ellipsePath } from '@weasel-js/geom';
import type { DrawCommand } from '@weasel-js/renderer';
import type { RenderLayer } from '@weasel-js/core';
import { viewToTransform } from '@weasel-js/core';
import { worldToScreen } from '@weasel-js/core';
import type { WeighedPath } from './weightActions';

/** A weighed point's dot radius in screen px, where `targets.weightPointRadiusPx` sets none. */
export const POINT_RADIUS_PX = 3.5;
const RIM = '#10161d';
/** No weight, and all of it. */
const COLD = [0x1f, 0x6f, 0x8b];
const HOT = [0xff, 0x8a, 0x3d];
const IDLE = '#8a94a3';

const mix = (w: number): string => {
  const c = COLD.map((v, k) => Math.round(v + (HOT[k] - v) * w));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
};

/**
 * A screen-space layer drawing a dot on every point of every path under a rig, anchors and
 * curve handles alike, colored by how much the active joint weighs it. With no joint active
 * the dots are gray.
 */
export function createWeightOverlay(source: {
  id: string;
  paths(): readonly WeighedPath[];
  active(): string | null;
  subscribe(fn: () => void): () => void;
  /** Point dot radius in screen px, read each frame. Default `POINT_RADIUS_PX`. */
  pointRadiusPx?: () => number | undefined;
}): RenderLayer<unknown> {
  return {
    id: source.id,
    label: 'Weights',
    space: 'screen',
    subscribe: source.subscribe,
    draw: (_data, view) => {
      const t = viewToTransform(view);
      const active = source.active();
      const r = source.pointRadiusPx?.() ?? POINT_RADIUS_PX;
      const out: DrawCommand[] = [];
      for (const { path, skin } of source.paths()) {
        const weights = active === null ? undefined : skin[active];
        let total: number[] | undefined;
        if (active !== null) {
          total = new Array<number>(path.coords.length >> 1).fill(0);
          for (const joint in skin) skin[joint].forEach((w, i) => { if (i < total!.length) total![i] += w; });
        }
        for (let i = 0; 2 * i + 1 < path.coords.length; i++) {
          const [x, y] = worldToScreen(path.coords[2 * i], path.coords[2 * i + 1], t);
          const share = total && total[i] > 0 ? (weights?.[i] ?? 0) / total[i] : 0;
          out.push({
            kind: 'path',
            path: ellipsePath({ x: x - r, y: y - r, width: 2 * r, height: 2 * r }),
            fill: { paint: { kind: 'solid', color: active === null ? IDLE : mix(share) } },
            stroke: { paint: { color: RIM }, width: 1 },
          });
        }
      }
      return out;
    },
  };
}
