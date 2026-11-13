import type { NodeId } from './types';

const isRect = (p: unknown): boolean => {
  const r = p as Record<string, unknown> | null;
  return !!r && typeof r === 'object' && typeof r.x === 'number' && typeof r.y === 'number'
    && typeof r.width === 'number' && typeof r.height === 'number';
};

/**
 * `specs`, loaded under `composition`. Without one the scene folds poses with `RIGID_POSE_COMPOSITION`, which reads
 * only rects: a nested node whose pose, or whose container's, is not one would read back with `NaN` in it, so it
 * throws instead, saying to pass the composition.
 */
export function foldable<T extends { id?: NodeId; parent?: NodeId | null; pose: unknown }>(
  specs: T[],
  composition: unknown,
): T[] {
  if (composition) return specs;
  const poses = new Map(specs.map((s) => [s.id, s.pose]));
  for (const s of specs) {
    if (s.parent == null) continue;
    const bad = !isRect(s.pose) ? s.id : !isRect(poses.get(s.parent)) ? s.parent : undefined;
    if (bad === undefined) continue;
    throw new Error(
      `sceneFromJSON: node "${String(bad)}" is in a container, and its pose is not a rect, which the default `
      + 'composition (RIGID_POSE_COMPOSITION) cannot fold. Pass the composition the scene was made with: '
      + 'sceneFromJSON(json, { composition }).',
    );
  }
  return specs;
}
