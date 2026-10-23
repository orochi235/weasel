import { describe, expect, it } from 'vitest';
import { createScene } from './scene';
import { asNodeId } from './types';
import { POSE, makeScene, type Data, type Layer } from './testing/makeScene';

describe('createScene — construction', () => {
  it('rejects empty systemLayers', () => {
    expect(() =>
      createScene<Data, 'a'>({ systemLayers: [] }),
    ).toThrow(/at least one layer/);
  });

  it('rejects duplicate system layer ids', () => {
    expect(() =>
      createScene<Data, 'a'>({ systemLayers: [{ id: 'a' }, { id: 'a' }] }),
    ).toThrow(/duplicate system layer/);
  });

  it('seeds layers as visible+unlocked by default, kind=system', () => {
    const s = makeScene();
    expect(s.layers).toHaveLength(3);
    for (const l of s.layers) {
      expect(l.kind).toBe('system');
      expect(l.visible).toBe(true);
      expect(l.locked).toBe(false);
    }
  });

  it('honors initial visible/locked overrides', () => {
    const s = createScene<Data, 'a' | 'b'>({
      systemLayers: [
        { id: 'a', visible: false },
        { id: 'b', locked: true },
      ],
    });
    expect(s.layers[0].visible).toBe(false);
    expect(s.layers[1].locked).toBe(true);
  });

  it('applies `initial` nodes without writing to history', () => {
    const s = createScene<Data, Layer>({
      systemLayers: [{ id: 'background' }, { id: 'structures' }, { id: 'plantings' }],
      initial: [
        { kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'a' } },
      ],
    });
    expect(s.roots).toHaveLength(1);
    expect(s.canUndo()).toBe(false);
  });

  it('allows a child on a higher layer than its parent via createScene({ initial })', () => {
    const scene = createScene<{ label: string }, 'structures' | 'plantings', typeof POSE>({
      systemLayers: [{ id: 'structures' }, { id: 'plantings' }],
      initial: [
        { id: asNodeId('bed'), kind: 'group', layer: 'structures', pose: POSE, data: { label: 'bed' } },
        { id: asNodeId('plant'), kind: 'mark', layer: 'plantings', pose: POSE, data: { label: 'plant' }, parent: asNodeId('bed') },
      ],
    });
    expect(scene.get(asNodeId('plant'))?.layer).toBe('plantings');
    expect(scene.childrenOf(asNodeId('bed'))).toEqual([asNodeId('plant')]);
  });

  it('createScene({ initial }) preserves clipFromPose on container nodes', () => {
    const scene = createScene<Data, 'structures', typeof POSE>({
      systemLayers: [{ id: 'structures' }],
      initial: [
        {
          id: asNodeId('bed'),
          kind: 'group',
          layer: 'structures',
          pose: POSE,
          data: { label: 'bed' },
          clipFromPose: () => ({ kind: 'rect', x: 0, y: 0, width: 10, height: 10 }),
        },
      ],
    });
    const node = scene.get(asNodeId('bed'));
    expect(node?.kind).toBe('group');
    expect(typeof (node as { clipFromPose?: unknown }).clipFromPose).toBe('function');
  });
});
