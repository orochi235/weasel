import { roundRectPath, type Path, type Rect } from '@weasel-js/geom';
import type { DrawCommand } from './DrawCommand';

/** A shadow a box casts, as CSS `box-shadow` measures one: offset, blur, and how far it grows past the box. */
export interface DropShadow {
  x: number;
  y: number;
  /** How wide the falloff is; 0 is a hard edge. */
  blur: number;
  spread?: number;
}

// A blurred shadow is nested rounded rects reaching blur / 2 either side of its edge,
// whose overlap builds the falloff.
const BLUR_LAYERS = 7;
const BLUR_LAYER_ALPHA = 0.16;

/** The layers of a shadow, outermost first, and the opacity each is filled at. */
export interface DropShadowLayers {
  paths: Path[];
  /** One per path. Stacked, they cover the shadow's interior fully and fall off linearly to its edge. */
  alphas: number[];
  /** @deprecated One opacity for every path, which leaves a blurred shadow's interior at about 70% of its
   *  color; fill each path at its own entry in `alphas` instead. */
  alpha: number;
}

/**
 * The corner radius of a box whose corners are `radius`, grown by `by` on every side (shrunk, for a negative `by`), as
 * CSS spreads a shadow: a corner sharper than the growth stays sharper, so a square box casts a square shadow.
 */
export function spreadRadius(radius: number, by: number): number {
  if (by <= 0 || radius >= by) return Math.max(0, radius + by);
  return Math.max(0, radius + by * (1 + (radius / by - 1) ** 3));
}

/**
 * The shadow `box` casts with corner `radius`, as the shapes to fill and the
 * opacity of each: one hard-edged shape for no blur, else stacked translucent
 * ones whose overlap builds the falloff. No blur pass, so it costs a few fills.
 */
export function dropShadowLayers(
  box: Rect,
  radius: number,
  s: DropShadow,
): DropShadowLayers {
  const spread = s.spread ?? 0;
  const spreadR = spreadRadius(radius, spread);
  const rect = (e: number): Path | null => {
    const w = box.width + e * 2;
    const h = box.height + e * 2;
    return w > 0 && h > 0 ? roundRectPath(box.x + s.x - e, box.y + s.y - e, w, h, Math.max(0, spreadR + e - spread)) : null;
  };
  if (s.blur <= 0) {
    const p = rect(spread);
    return p ? { paths: [p], alphas: [1], alpha: 1 } : { paths: [], alphas: [], alpha: 1 };
  }
  const paths: Path[] = [];
  const alphas: number[] = [];
  const step = s.blur / (BLUR_LAYERS - 1);
  for (let i = 0; i < BLUR_LAYERS; i++) {
    const p = rect(spread + s.blur / 2 - i * step);
    if (!p) continue;
    paths.push(p);
    // Over the i layers outside it, coverage is i / N; this layer takes it to (i + 1) / N.
    alphas.push(1 / (BLUR_LAYERS - i));
  }
  return { paths, alphas, alpha: BLUR_LAYER_ALPHA };
}

/** {@link dropShadowLayers} as a draw command, filled in `color`. */
export function dropShadowCommand(
  box: Rect,
  radius: number,
  s: DropShadow,
  color: string,
): DrawCommand {
  const { paths, alphas } = dropShadowLayers(box, radius, s);
  const fill = { paint: { kind: 'solid' as const, color } };
  return {
    kind: 'group',
    children: paths.map((path, i): DrawCommand => {
      const cmd = { kind: 'path' as const, path, fill };
      return alphas[i] < 1 ? { kind: 'group', alpha: alphas[i], children: [cmd] } : cmd;
    }),
  };
}
