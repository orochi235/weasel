import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { DrawCommand, GroupDrawCommand } from '@weasel-js/renderer';
import { createScene } from 'core/scene/scene';
import { RECT_POSE_COMPOSITION } from 'core/scene/composePose';
import type { Node, RectPose } from 'core/scene/types';
import type { View } from 'core/viewport/view';
import type { GesturePreviewSource } from '../gestureBounds';
import { usePreviewGhostLayer } from './usePreviewGhostLayer';

type N = Node<null, 'main' | 'off', RectPose>;
const at = (x: number): RectPose => ({ x, y: 0, width: 10, height: 10 });
const VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DIMS = { width: 100, height: 100, dpr: 1 };

const drawOne = (_n: N, pose: RectPose): DrawCommand[] => [{
  kind: 'path',
  path: { kind: 'rect', x: pose.x, y: pose.y, width: pose.width, height: pose.height },
  fill: { paint: { color: '#000' } },
}];

const rectsIn = (cmds: readonly DrawCommand[]): number[] => cmds.flatMap((c) =>
  c.kind === 'group' ? rectsIn((c as GroupDrawCommand).children) : c.kind === 'path' && c.path.kind === 'rect' ? [c.path.x] : []);

const previewing = (ids: string[]) => {
  const source: GesturePreviewSource = { previewIds: () => ids, previewPose: () => null };
  return { getPreviewSources: () => [source] };
};

function sceneWithGroup() {
  const scene = createScene<null, 'main' | 'off', RectPose>({
    systemLayers: [{ id: 'main' }, { id: 'off' }], composition: RECT_POSE_COMPOSITION,
  });
  const g = scene.add({ kind: 'group', layer: 'main', pose: at(100), data: null });
  return { scene, g };
}

describe('usePreviewGhostLayer', () => {
  it('ghosts no hidden child and no child on a hidden layer of a dragged container, as the scene paints it', () => {
    const { scene, g } = sceneWithGroup();
    scene.add({ kind: 'mark', layer: 'main', pose: at(1), data: null, parent: g });
    scene.add({ kind: 'mark', layer: 'main', pose: at(2), data: null, parent: g, hidden: true } as never);
    scene.add({ kind: 'mark', layer: 'off', pose: at(3), data: null, parent: g });
    scene.setLayerVisible('off', false);
    const { result } = renderHook(() => usePreviewGhostLayer({ scene, sceneSlot: { drawOne } }));
    expect(rectsIn(result.current.draw(previewing([g]), VIEW, DIMS) as DrawCommand[]).sort()).toEqual([100, 101]);
  });
});
