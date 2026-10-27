import { describe, expect, it } from 'vitest';
import { createScene, type Scene } from '@weasel-js/core';
import { createGridPreset } from './preset';
import { expectNear, moveBy } from '../sources/testing/session';

type Pose = { x: number; y: number; width: number; height: number };

function moved(preset: ReturnType<typeof createGridPreset>, x: number, y: number) {
  const scene = createScene<object, 'default', Pose>({ systemLayers: [{ id: 'default', visible: true, locked: false }] });
  const id = scene.add({ kind: 'mark', layer: 'default', pose: { x, y, width: 10, height: 10 }, data: {} });
  return moveBy({ sources: preset.snapSources!, ids: [id], scene: scene as unknown as Scene<unknown, string, unknown> }).by(0, 0);
}

describe('createGridPreset', () => {
  it('draws its grid in the grid slot and nowhere else', () => {
    const preset = createGridPreset({ spacing: 20 });
    expect(preset.id).toBe('grid');
    expect(Object.keys(preset.layers!)).toEqual(['grid']);
    expect(preset.layers!.grid!.layer.draw).toBeTypeOf('function');
  });

  it('snaps a move onto its spacing', () => {
    expectNear(moved(createGridPreset({ spacing: 20 }), 23, 38).point, { x: -3, y: 2 });
  });

  it('snaps from the origin it is given', () => {
    expectNear(moved(createGridPreset({ spacing: 20, snap: { origin: { x: 5, y: 5 } } }), 23, 38).point, { x: 2, y: 7 });
  });

  it('draws without snapping when snap is off', () => {
    expect(createGridPreset({ spacing: 20, snap: false }).snapSources).toEqual([]);
  });

  it('takes its own id, so a canvas can carry two', () => {
    expect(createGridPreset({ id: 'fine', spacing: 5 }).id).toBe('fine');
  });
});
