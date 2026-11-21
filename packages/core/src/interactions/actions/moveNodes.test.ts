import { describe, expect, it } from 'vitest';
import { createScene } from 'core/scene/scene';
import type { AnyScene } from 'core/scene/anyScene';
import { moveEachOps } from './moveNodes';

describe('moveEachOps', () => {
  it('leaves a node where a zero-delta entry reached it, though a later entry also reaches it', () => {
    const scene = createScene<object, 'main', { x: number; y: number; width: number; height: number }>({ systemLayers: [{ id: 'main' }] });
    const a = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 10, height: 10 } });
    const b = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: { x: 50, y: 0, width: 10, height: 10 } });
    const ops = moveEachOps(scene as unknown as AnyScene, [{ ids: [a], dx: 0, dy: 0 }, { ids: [a, b], dx: 5, dy: 0 }]);
    expect(ops.map((op) => (op.args as { id: string }).id)).toEqual([b]);
  });
});
