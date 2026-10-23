import { describe, it, expect } from 'vitest';
import { createScene } from 'core/scene/scene';
import { asNodeId, type RectPose, type Scene } from 'core/scene/types';
import { drawnBoxes } from 'interactions/actions/drawnBoxes';
import { buildProbes } from './probes2d';
import { sceneProbeReads } from './sceneReads';

const ID = asNodeId('r');

function strokedRect(): Scene<unknown, string, unknown> {
  const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.add({
    id: ID, kind: 'mark', layer: 'main',
    data: { shape: 'rect', stroke: { paint: { kind: 'solid', color: '#000' }, width: 10 } },
    pose: { x: 10, y: 20, width: 100, height: 50 },
  });
  return scene as unknown as Scene<unknown, string, unknown>;
}

function reads(geometryAt?: () => { x: number; y: number } | null) {
  const scene = strokedRect();
  const boxes = drawnBoxes({ scene } as Parameters<typeof drawnBoxes>[0]);
  return sceneProbeReads({ scene, boxes, ...(geometryAt ? { geometryAt } : {}) });
}

describe('buildProbes', () => {
  it('puts a move\'s box probes on the drawn box and its origin probe on the pose origin', () => {
    const probes = buildProbes({ gesture: 'move', press: { x: 30, y: 30 }, ids: [ID] }, reads());
    expect(probes).toEqual([
      { id: `origin:${ID}`, at: { x: 10, y: 20 }, role: 'origin' },
      { id: 'box.min', at: { x: 5, y: 15 }, role: 'box' },
      { id: 'box.center', at: { x: 60, y: 45 }, role: 'box' },
      { id: 'box.max', at: { x: 115, y: 75 }, role: 'box' },
      { id: 'geometry', at: { x: 30, y: 30 }, role: 'geometry' },
    ]);
  });

  it('puts the geometry probe on the subject\'s own geometry when some is near the press', () => {
    const probes = buildProbes({ gesture: 'move', press: { x: 30, y: 30 }, ids: [ID] }, reads(() => ({ x: 10, y: 20 })));
    expect(probes.find((p) => p.role === 'geometry')?.at).toEqual({ x: 10, y: 20 });
  });

  it('probes the pointer for a point gesture', () => {
    expect(buildProbes({ gesture: 'point', press: { x: 3, y: 4 } }, reads()))
      .toEqual([{ id: 'pointer', at: { x: 3, y: 4 }, role: 'pointer' }]);
  });

  it('probes the moving edge of a resize, on the drawn box: its midpoint as pointer, its ends as box', () => {
    const probes = buildProbes(
      { gesture: 'resize', press: { x: 114, y: 40 }, ids: [ID], handle: { x: 'min', y: 'free' } }, reads(),
    );
    expect(probes).toEqual([
      { id: 'pointer', at: { x: 115, y: 45 }, role: 'pointer' },
      { id: 'box.0', at: { x: 115, y: 15 }, role: 'box' },
      { id: 'box.1', at: { x: 115, y: 75 }, role: 'box' },
    ]);
  });

  it('probes a resize\'s dragged corner as pointer and box, through the box it names', () => {
    const probes = buildProbes({
      gesture: 'resize', press: { x: 0, y: 0 }, ids: [ID], handle: { x: 'max', y: 'max' },
      box: { bounds: { x: 0, y: 0, width: 10, height: 20 }, toWorld: (p) => ({ x: p.x + 100, y: p.y }) },
    }, reads());
    expect(probes).toEqual([
      { id: 'pointer', at: { x: 100, y: 0 }, role: 'pointer' },
      { id: 'box.0', at: { x: 100, y: 0 }, role: 'box' },
    ]);
  });
});
