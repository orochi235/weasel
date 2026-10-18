import type { NodeId } from 'core/scene/types';
import type { AngleCandidate, SnapSource } from './types';

const QUARTER = Math.PI / 2;

/**
 * A rotate's angle targets: every quarter turn, and the world rotation of
 * every other visible node that can turn. The Shift step is not a source:
 * it is the rotate's `snap.constrain` role, which applies with no source
 * at all.
 */
export function rotationSnapSource(): SnapSource {
  return {
    id: 'rotation',
    roles: [],
    gestures: ['rotate'],
    collect: () => [],
    *angles(q): Iterable<AngleCandidate> {
      for (let k = 0; k < 4; k++) yield { angle: k * QUARTER };
      const { scene, rotationOf } = q;
      if (!scene || !rotationOf) return;
      const exclude = new Set(q.exclude);
      for (const id of scene.nodes.keys()) {
        if (exclude.has(id) || scene.isHidden(id as NodeId)) continue;
        const angle = rotationOf(id);
        if (angle !== undefined && Number.isFinite(angle)) yield { angle };
      }
    },
  };
}
