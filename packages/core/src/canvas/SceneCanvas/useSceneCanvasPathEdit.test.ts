import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createScene } from 'core/scene/scene';
import type { RectPose } from 'core/scene/types';
import { viewerSelection } from 'core/selection/viewerSelection';
import { useSceneCanvasPathEdit } from './useSceneCanvasPathEdit';

describe('useSceneCanvasPathEdit', () => {
  it('keeps the path-edit shift-click lock under a selectTool whose extendClickLocked is undefined', () => {
    const scene = createScene<null, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const id = scene.add({ kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: null });
    scene.setSelection([id]);
    const { result } = renderHook(() => useSceneCanvasPathEdit({
      host: undefined, opening: undefined, getActiveMode: undefined, scene,
      selection: viewerSelection(scene as never), extensions: [],
      selectTool: { extendClickLocked: undefined } as never,
    }));
    act(() => { result.current.setPathEdit({ id }); });
    expect(result.current.pathEditState.getEditingId()).toBe(id);
    expect(result.current.selectToolWithDefaults.extendClickLocked?.()).toBe(true);
  });
});
