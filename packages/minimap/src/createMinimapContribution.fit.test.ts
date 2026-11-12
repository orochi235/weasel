/** The contribution's fit camera refits on everything the fit reads, the pose descriptor included. */
import { describe, it, expect } from 'vitest';
import { createScene, RECT_POSE_DESCRIPTOR } from '@weasel-js/core';
import type { CanvasExtensionApi, ContributionDepReader, PoseDescriptor, View } from '@weasel-js/core';
import { createMinimapContribution } from './createMinimapContribution';

type P = { x: number; y: number; width: number; height: number };
const OUTER: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DIMS = { width: 400, height: 300 };

describe('createMinimapContribution fit', () => {
  it('refits when the surface swaps its pose descriptor', () => {
    const scene = createScene<unknown, 'main', P>({ systemLayers: [{ id: 'main' }] });
    scene.add({ kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 100, height: 100 }, data: {} });
    let descriptor: PoseDescriptor<P> = RECT_POSE_DESCRIPTOR;
    const reader = {
      get: (name: string) => (name === 'scene' ? scene : name === 'poseDescriptor' ? descriptor : undefined),
    } as unknown as ContributionDepReader;
    const api = { element: null, requestRedraw: () => {} } as unknown as CanvasExtensionApi;
    const minimap = createMinimapContribution({ rect: { x: 0, y: 0, w: 116, h: 116 } });
    minimap.attach!(api, reader);
    const fit = minimap.views![0]!.view as (outer: View, dims: typeof DIMS) => View;

    expect(fit(OUTER, DIMS).scale.x).toBeCloseTo(1);
    descriptor = { ...RECT_POSE_DESCRIPTOR, getBounds: (p) => ({ ...p, width: p.width * 2, height: p.height * 2 }) };
    expect(fit(OUTER, DIMS).scale.x).toBeCloseTo(0.5);
  });
});
