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
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) refuse(label, 'a positive finite number', v);
  }
  for (const [label, v] of [['scale.x', scale.x], ['scale.y', scale.y]] as const) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v === 0) refuse(label, 'a nonzero finite number', v);
  }
  for (const [label, v] of [['sourceRect.x', sourceRect.x], ['sourceRect.y', sourceRect.y]] as const) {
    if (typeof v !== 'number' || !Number.isFinite(v)) refuse(label, 'a finite number', v);
  }
}
