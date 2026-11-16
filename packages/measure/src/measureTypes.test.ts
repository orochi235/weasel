import { describe, expect, it } from 'vitest';
import { asNodeId, createScene, type RectPose, type Scene } from '@weasel-js/core';
import { measureNode } from './measurement';
import { measurementsContribution } from './measureContribution';
import { createMeasurements } from './measurements';

// Enforced by `npm run typecheck`; the runtime body keeps vitest from reporting an empty file.

type Layer = 'default' | 'annotations';

describe('measure typing', () => {
  it('fits a typed scene: a measurement node in its initial list, the scene in the contribution', () => {
    const scene: Scene<unknown, Layer, RectPose> = createScene<unknown, Layer, RectPose>({
      systemLayers: [{ id: 'default' }, { id: 'annotations', annotation: true }],
      initial: [measureNode(asNodeId('m'), 'annotations', { x: 0, y: 0 }, { x: 10, y: 0 })],
    });
    const contribution = measurementsContribution(scene, createMeasurements({ layer: 'annotations' }));
    expect(contribution.id).toBe('weasel-measure');
    expect(scene.nodes.size).toBe(1);
  });
});
