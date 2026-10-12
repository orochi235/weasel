
/**
 * Slot for a painter's memoized `paint` output.
 *
 * Distinct from the silhouette slot even though the two mostly invalidate
 * together: the silhouette bakes `pose.rotation` in (paint does not — the
 * render wrap applies it), and paint alone can depend on `NodePaintCtx` and on
 * ambient readiness.
 *
 * **Only for painters that are a pure function of `(node, pose, data)`.**
 * `kit:text` and `kit:image` do not qualify.
 */
export const PAINT_SLOT = 'shape:paint';

export function derivesPath(node: { dependsOn?: readonly unknown[] | 'children'; derivePath?: unknown }): boolean {
  return (node.dependsOn?.length ?? 0) > 0 && node.derivePath !== undefined;
}
