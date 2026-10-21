import type { NodeId } from 'core/scene/types';
import type { AngleCandidate, AngleCollect, SnapSource } from './types';

const QUARTER = Math.PI / 2;

/**
 * A rotate's angle targets: every quarter turn, and the world rotation of
 * every other visible node that can turn. Shift's step is the rotate's own.
 * Every `<SceneCanvas>` asks it, under the id `'rotation'`.
 */
export function rotationSnapSource(): SnapSource {
  let cached: { key: readonly unknown[]; angles: number[] } | null = null;
  const nodeAngles = (q: AngleCollect): readonly number[] => {
    const { scene, rotationOf } = q;
    if (!scene || !rotationOf) return [];
    const key = [scene, scene.getVersion(), rotationOf, q.exclude];
    if (cached && key.every((k, i) => k === cached!.key[i])) return cached.angles;
    const exclude = new Set(q.exclude);
    const angles: number[] = [];
    for (const id of scene.nodes.keys()) {
      if (exclude.has(id) || scene.isHidden(id as NodeId)) continue;
      const angle = rotationOf(id);
      if (angle !== undefined && Number.isFinite(angle)) angles.push(angle);
    }
    cached = { key, angles };
    return angles;
  };
  return {
    id: 'rotation',
    roles: [],
    gestures: ['rotate'],
    collect: () => [],
    *angles(q): Iterable<AngleCandidate> {
      for (let k = 0; k < 4; k++) yield { angle: k * QUARTER };
      for (const angle of nodeAngles(q)) yield { angle };
    },
  };
}
