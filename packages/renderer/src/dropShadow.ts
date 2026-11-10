import { roundRectPath, type Path } from '@weasel-js/geom';
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

/**
 * The shadow `box` casts with corner `radius`, as the shapes to fill and the
 * opacity of each: one hard-edged shape for no blur, else stacked translucent
 * ones whose overlap builds the falloff. No blur pass, so it costs a few fills.
 */
export function dropShadowLayers(
  box: { x: number; y: number; width: number; height: number },
  radius: number,
  s: DropShadow,
): { paths: Path[]; alpha: number } {
  const spread = s.spread ?? 0;
  const rect = (e: number): Path | null => {
    const w = box.width + e * 2;
    const h = box.height + e * 2;
    return w > 0 && h > 0 ? roundRectPath(box.x + s.x - e, box.y + s.y - e, w, h, Math.max(0, radius + e)) : null;
  };
  if (s.blur <= 0) {
    const p = rect(spread);
    return { paths: p ? [p] : [], alpha: 1 };
  }
  const paths: Path[] = [];
  const step = s.blur / (BLUR_LAYERS - 1);
  for (let i = 0; i < BLUR_LAYERS; i++) {
    const p = rect(spread + s.blur / 2 - i * step);
    if (p) paths.push(p);
  }
  return { paths, alpha: BLUR_LAYER_ALPHA };
}

/** {@link dropShadowLayers} as a draw command, filled in `color`. */
export function dropShadowCommand(
  box: { x: number; y: number; width: number; height: number },
  radius: number,
  s: DropShadow,
  color: string,
): DrawCommand {
  const { paths, alpha } = dropShadowLayers(box, radius, s);
  const fill = { paint: { kind: 'solid' as const, color } };
  return {
    kind: 'group',
    ...(alpha < 1 ? { alpha } : {}),
    children: paths.map((path) => ({ kind: 'path' as const, path, fill })),
  };
}
