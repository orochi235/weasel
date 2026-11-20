import { isFiniteNumber } from '@weasel-js/registry';
/**
 * Throw unless `sourceRect` and `scale` describe a render `renderSceneToPixels` can make: a positive finite
 * width and height, a finite corner, and a nonzero finite scale on each axis. Each error opens with `prefix`
 * and names the field. Imports nothing, so a Node caller reaches it through `@weasel-js/core/math`.
 */
export function checkPixelRenderRect(
  sourceRect: { x: unknown; y: unknown; width: unknown; height: unknown },
  scale: { x: unknown; y: unknown },
  prefix = 'renderSceneToPixels',
): void {
  const refuse = (label: string, want: string, v: unknown): never => {
    throw new Error(`${prefix}: ${label} must be ${want}, got ${String(v)}`);
  };
  for (const [label, v] of [['sourceRect.width', sourceRect.width], ['sourceRect.height', sourceRect.height]] as const) {
    if (!isFiniteNumber(v) || v <= 0) refuse(label, 'a positive finite number', v);
  }
  for (const [label, v] of [['scale.x', scale.x], ['scale.y', scale.y]] as const) {
    if (!isFiniteNumber(v) || v === 0) refuse(label, 'a nonzero finite number', v);
  }
  for (const [label, v] of [['sourceRect.x', sourceRect.x], ['sourceRect.y', sourceRect.y]] as const) {
    if (!isFiniteNumber(v)) refuse(label, 'a finite number', v);
  }
}

/** The output pixels a render of `sourceRect` at `scale` makes, each axis rounded and at least 1, as
 *  `renderSceneToPixels` sizes it. Call {@link checkPixelRenderRect} first. */
export function pixelRenderSize(
  sourceRect: { width: number; height: number }, scale: { x: number; y: number },
): { width: number; height: number } {
  return {
    width: Math.max(1, Math.round(sourceRect.width * Math.abs(scale.x))),
    height: Math.max(1, Math.round(sourceRect.height * Math.abs(scale.y))),
  };
}
