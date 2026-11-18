import { describe, expect, it } from 'vitest';
import { clusterSpecs, START } from '../DiagramClustersDemo';
import { moved } from '../diagram/shared';

const at = (specs: ReturnType<typeof clusterSpecs>, id: string) => {
  const spec = specs.find((s) => s.id === id);
  if (!spec || !('pose' in spec)) throw new Error(`no node ${id}`);
  const { x, y } = spec.pose as { x: number; y: number };
  return { x, y };
};

describe('DiagramClustersDemo', () => {
  it('keeps a dragged box where it was dropped, and the others where they stood', () => {
    const before = clusterSpecs(START);
    const from = at(before, 'fetch');
    const to = { x: from.x - 150, y: from.y - 30 };
    const after = clusterSpecs(moved(START, [{ id: 'fetch', ...to }]));
    expect(at(after, 'fetch')).toEqual(to);
    for (const id of ['decode', 'cache', 'probe', 'score', 'report', 'clock']) {
      expect(at(after, id)).toEqual(at(before, id));
    }
  });
});
