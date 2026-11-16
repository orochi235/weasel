import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { sceneToAdapter, useScene } from '@weasel-js/core';
import { IDENTITY_POSE_COMPOSITION, useSelection, asNodeId } from '@weasel-js/core/engine';
import { useSelectTool } from './useSelectTool';
import type { Action, ActionDeps } from '@weasel-js/routing';
import { circleForTests as circle, CIRCLE_POSE_DESCRIPTORForTests as CIRCLE_POSE_DESCRIPTOR, type CirclePoseForTests as CirclePose } from '@weasel-js/core/test-seams';

describe('useSelectTool — default pickEvery reads the descriptor', () => {
  it('selects a circle pressed at its center', () => {
    const { result } = renderHook(() => {
      const scene = useScene<object, 'default', CirclePose>({ composition: IDENTITY_POSE_COMPOSITION,
        systemLayers: [{ id: 'default' }],
        initial: [{ id: asNodeId('c'), kind: 'mark', layer: 'default', pose: circle(50, 50, 10), data: {} }],
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
        world: { x: 50, y: 50 }, mods: { alt: false, ctrl: false, meta: false, shift: false },
      });
    });
    expect(result.current.sel.current).toEqual(['c']);
  });
});
