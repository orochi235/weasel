/**
 * The chrome's bounds source carries the frame the node is drawn in: its
 * rotation and its `transform`, so `poseFrameOf` over the bounds is
 * `poseFrameOf` over the pose.
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { poseFrameOf } from '@weasel-js/geom';
import { useScene } from 'core/scene/useScene';
import type { RectPose, UseSceneOptions } from 'core/scene/types';
import { useSceneAdapter } from 'canvas/useSceneAdapter';
import { asNodeId } from 'core/scene/types';
import { useSceneSelectTool } from './useSceneSelectTool';

const POSE: RectPose = { x: 10, y: 20, width: 100, height: 40, rotation: Math.PI / 6, transform: [1, 0, 0.5, 1] };

describe('chrome bounds of a node whose pose carries a transform', () => {
  it('reports the frame the node is drawn in', () => {
    const initial: UseSceneOptions<object, 'default', RectPose>['initial'] = [{
      id: asNodeId('n'), kind: 'mark', layer: 'default', pose: POSE, data: {},
    }];
    const { result } = renderHook(() => {
      const scene = useScene<object, 'default', RectPose>({ systemLayers: [{ id: 'default' }], initial });
      const adapter = useSceneAdapter(scene);
      return useSceneSelectTool({ scene, adapter });
    });
    const b = result.current.boundsOf('n');
    expect(b).toMatchObject({ x: 10, y: 20, width: 100, height: 40 });
    expect(poseFrameOf(b)).toEqual(poseFrameOf(POSE));
  });
});
