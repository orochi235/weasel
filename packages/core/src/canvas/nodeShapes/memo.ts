
/**
 * Slot for a painter's memoized `paint` output.
 *
 * Distinct from {@link SILHOUETTE_SLOT} even though the two mostly invalidate
 * together: the silhouette bakes `pose.rotation` in (paint does not — the
 * render wrap applies it), and paint alone can depend on `NodePaintCtx` and on
 * ambient readiness. One entry keyed the same way for both would be wrong in
 * both directions.
 *
 * **Only for painters that are a pure function of `(node, pose, data)`.**
 * `kit:shape` and `kit:path` qualify and are also precisely the painters that
 * allocated a fresh `Path` per frame, defeating the tessellation cache in
 * `renderer/cache/cache.ts` (`WeakMap<Path, Mesh>`, keyed on Path identity).
 * `kit:text` and `kit:image` do not qualify — see the tests in
 * `NodeShape.cache.test.ts` that pin their opt-out.
 */
export const PAINT_SLOT = 'shape:paint';

export function derivesPath(node: { dependsOn?: readonly unknown[] | 'children'; derivePath?: unknown }): boolean {
  return (node.dependsOn?.length ?? 0) > 0 && node.derivePath !== undefined;
}
