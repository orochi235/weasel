import { Activity, StrictMode, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { act, render, renderHook } from '@testing-library/react';
import { createScene } from 'core/scene/scene';
import type { RectPose } from 'core/scene/composePose';
import { asNodeId, type AddNodeSpec } from 'core/scene/types';
import type { SceneSource, SceneStream } from './streamScene';
import { useSceneStream } from './useSceneStream';

type Data = { fill: unknown };
const flush = () => new Promise<void>((r) => setImmediate(r));
const source: SceneSource<Data, 'main', RectPose> = {
  cellSize: 100,
  load: async (cell): Promise<AddNodeSpec<Data, 'main', RectPose>[]> => [{
    id: asNodeId(`n${cell.x}_${cell.y}`), kind: 'mark', layer: 'main',
    pose: { x: cell.box[0], y: cell.box[1], width: 10, height: 10 }, data: { fill: null },
  }],
};
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DIMS = { width: 150, height: 150 };

/** A scene that counts the edit passes held on it. */
function countedScene() {
  const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const passes = { held: 0 };
  const add = scene.addEditPass.bind(scene);
  scene.addEditPass = (...args: Parameters<typeof add>) => {
    const off = add(...args);
    passes.held++;
    return () => { passes.held--; off(); };
  };
  return { scene, passes };
}

describe('useSceneStream', () => {
  it('leaves no edit pass behind from a render StrictMode throws away', () => {
    const { scene, passes } = countedScene();
    const wrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;
    const { unmount } = renderHook(() => useSceneStream(scene, source), { wrapper });
    expect(passes.held).toBe(1);
    unmount();
    expect(passes.held).toBe(0);
  });

  it('streams again once a hidden Activity shows it, after its effects were cleaned up', async () => {
    const { scene } = countedScene();
    let stream: SceneStream | null = null;
    const Probe = () => { stream = useSceneStream(scene, source, { margin: 0 }); return null; };
    const { rerender } = render(<Activity mode="visible"><Probe /></Activity>);
    rerender(<Activity mode="hidden"><Probe /></Activity>);
    rerender(<Activity mode="visible"><Probe /></Activity>);
    const { update } = stream!;
    await act(async () => {
      update(VIEW, DIMS);
      for (let k = 0; k < 5; k++) await flush();
    });
    expect(scene.get(asNodeId('n0_0'))).toBeDefined();
    expect(stream!.stats().nodes).toBe(scene.nodes.size);
  });
});
