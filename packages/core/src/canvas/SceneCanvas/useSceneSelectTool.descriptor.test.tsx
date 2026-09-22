/**
 * `useSceneSelectTool` against a pose that is neither a rect nor a Path: every
 * bounds read and pick has to go through the descriptor.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScene } from 'core/scene/useScene';
import { useSceneAdapter } from 'canvas/sceneAdapter';
import { useSceneSelectTool } from './useSceneSelectTool';
import { circle, CIRCLE_POSE_DESCRIPTOR, type CirclePose } from 'core/geometry/circlePose.fixture';

function harness() {
  return renderHook(() => {
    const scene = useScene<object, 'default', CirclePose>({ systemLayers: [{ id: 'default' }] });
    const adapter = useSceneAdapter(scene, { poseDescriptor: CIRCLE_POSE_DESCRIPTOR });
    return {
      scene,
      // 'pose' picking isolates the pose pre-filter from the painter stage.
      tool: useSceneSelectTool({
        scene, adapter, poseDescriptor: CIRCLE_POSE_DESCRIPTOR, geometry: { picking: 'pose' },
      }),
    };
  });
}

describe('useSceneSelectTool — non-rect poses', () => {
  it('reports a circle’s bounds', () => {
    const { result } = harness();
    let id = '';
    act(() => { id = result.current.scene.add({ kind: 'leaf', layer: 'default', pose: circle(10, 10, 5), data: {} }); });
    expect(result.current.tool.boundsOf(id)).toEqual({ x: 5, y: 5, width: 10, height: 10 });
  });

  it('picks a circle inside its bounds', () => {
    const { result } = harness();
    let id = '';
    act(() => { id = result.current.scene.add({ kind: 'leaf', layer: 'default', pose: circle(10, 10, 5), data: {} }); });
    expect(result.current.tool.pickEvery(10, 10)).toEqual([id]);
  });
});
