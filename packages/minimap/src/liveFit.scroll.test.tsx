/** A live fit frames what the view shows, a scrolled container's content moved by its offset, and refits on a scroll alone. */
import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createScene, RECT_POSE_DESCRIPTOR } from '@weasel-js/core';
import type { CanvasExtensionApi, ContributionDepReader, NodeId, View } from '@weasel-js/core';
import { createMinimapContribution } from './createMinimapContribution';
import { computeFitView } from './minimapMath';
import { useFitView } from './useFitView';

type P = { x: number; y: number; width: number; height: number };
const DIMS = { width: 100, height: 100 };
const centerX = (v: View): number => v.x + DIMS.width / (2 * v.scale.x);

function scrolledScene() {
  const scene = createScene<unknown, 'main', P>({ systemLayers: [{ id: 'main' }] });
  const box = scene.add({ kind: 'group', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 100, height: 100 } });
  scene.add({ kind: 'mark', parent: box, layer: 'main', data: {}, pose: { x: 0, y: 0, width: 100, height: 100 } });
  return { scene, box: box as NodeId };
}

describe('live fit over a scrolled container', () => {
  it('frames the content where the scroll shows it, and "scene" where the document holds it', () => {
    const { scene, box } = scrolledScene();
    scene.scroll.set(box, { x: 400, y: 0 });
    expect(centerX(computeFitView(scene, DIMS, 'live', RECT_POSE_DESCRIPTOR))).toBeCloseTo(-350);
    expect(centerX(computeFitView(scene, DIMS, 'scene', RECT_POSE_DESCRIPTOR))).toBeCloseTo(50);
  });

  it('refits the contribution camera on a scroll with no other scene change', () => {
    const { scene, box } = scrolledScene();
    const reader = { get: (name: string) => (name === 'scene' ? scene : undefined) } as unknown as ContributionDepReader;
    const api = { element: null, requestRedraw: () => {} } as unknown as CanvasExtensionApi;
    const minimap = createMinimapContribution({ rect: { x: 0, y: 0, w: DIMS.width, h: DIMS.height }, fit: 'live' });
    minimap.attach!(api, reader);
    const fit = minimap.views![0]!.view as (outer: View, dims: typeof DIMS) => View;
    const outer: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

    expect(centerX(fit(outer, DIMS))).toBeCloseTo(50);
    scene.scroll.set(box, { x: 400, y: 0 });
    expect(centerX(fit(outer, DIMS))).toBeCloseTo(-350);
  });

  it('refits useFitView on a scroll with no other scene change', () => {
    const { scene, box } = scrolledScene();
    const { result } = renderHook(() => useFitView(scene, DIMS.width, DIMS.height, 'live', RECT_POSE_DESCRIPTOR));
    expect(centerX(result.current)).toBeCloseTo(50);
    act(() => scene.scroll.set(box, { x: 400, y: 0 }));
    expect(centerX(result.current)).toBeCloseTo(-350);
  });
});
