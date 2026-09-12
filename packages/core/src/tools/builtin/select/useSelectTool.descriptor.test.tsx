import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { sceneToAdapter } from 'canvas/sceneAdapter';
import { useScene } from 'core/scene/useScene';
import { useSelection } from 'core/selection/useSelection';
import { asNodeId } from 'core/scene/types';
import { useSelectTool } from './useSelectTool';
import type { Action } from '../../../interactions/actions/registry';
import type { ActionDeps } from '../../../interactions/actions/invoker';
import { circle, CIRCLE_POSE_DESCRIPTOR, type CirclePose } from 'core/geometry/circlePose.fixture';

describe('useSelectTool — default pickEvery reads the descriptor', () => {
  it('selects a circle pressed at its center', () => {
    const { result } = renderHook(() => {
      const scene = useScene<object, 'default', CirclePose>({
        systemLayers: [{ id: 'default' }],
        initial: [{ id: asNodeId('c'), kind: 'leaf', layer: 'default', pose: circle(50, 50, 10), data: {} }],
      });
      const sel = useSelection({ mode: 'single' });
      const adapter = sceneToAdapter(scene, { selection: sel, poseDescriptor: CIRCLE_POSE_DESCRIPTOR });
      return { tool: useSelectTool(adapter as never, { poseDescriptor: CIRCLE_POSE_DESCRIPTOR } as never), sel };
    });
    const invoker = (result.current.tool as { actions?: readonly Action[] })
      .actions?.find((a) => a.id === 'select.pick')?.invoker;
    if (invoker?.timing !== 'immediate') throw new Error('select.pick missing');
    act(() => {
      invoker.run({ selection: result.current.sel } as unknown as ActionDeps, {
        worldX: 50, worldY: 50, mods: { alt: false, ctrl: false, meta: false, shift: false },
      });
    });
    expect(result.current.sel.current).toEqual(['c']);
  });
});
