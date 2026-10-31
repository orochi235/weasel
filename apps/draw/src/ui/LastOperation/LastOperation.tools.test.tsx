/**
 * In draw, a Smudge brush stroke and a Distort drag leave the last-operation panel up, and a change there replays
 * the gesture in place. The brush's Size in the panel and in the options row are one setting: a change in the panel
 * is the value the row shows and the next stroke uses.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import {
  ActionsProvider, DepRegistryProvider, PathBuilder, SceneCanvas, asNodeId, createScene, useActionsRegistry,
  type ActionsRegistry, type PolygonPath, type ToolsApi,
} from '@weasel-js/core';
import { usePathToolsTools } from '@weasel-js/path-tools';
import { DRAW_FEATURES } from '../../drawFeatures';
import { ToolOptionsPublisher } from '../../adapterPublishers';
import { drawPrefs } from '../../prefs';
import { LastOperation } from '.';

beforeAll(() => {
  (HTMLCanvasElement.prototype as unknown as { getContext: () => null }).getContext = () => null;
});
afterEach(() => {
  cleanup();
  drawPrefs().reset();
});

const A = asNodeId('a');
type Pose = { x: number; y: number; width: number; height: number };

function setup() {
  const scene = createScene<{ path: PolygonPath; warp?: unknown }, 'main', Pose>({ systemLayers: [{ id: 'main' }] });
  const path = new PathBuilder().moveTo(20, 50).lineTo(220, 50).lineTo(220, 150).lineTo(20, 150).close().build() as PolygonPath;
  scene.add({ id: A, kind: 'mark', layer: 'main', data: { path }, pose: { x: 20, y: 50, width: 200, height: 100 } });
  scene.setSelection([A]);
  const grabbed: { tools?: ToolsApi; registry?: ActionsRegistry | null } = {};
  function Harness() {
    grabbed.registry = useActionsRegistry();
    const tools = usePathToolsTools();
    return (
      <>
        <ToolOptionsPublisher />
        <SceneCanvas features={DRAW_FEATURES} scene={scene} layers={{}} width={400} height={400}
          tools={tools} onToolsCreated={(t) => { grabbed.tools = t; }} />
        <LastOperation />
      </>
    );
  }
  const { container } = render(<DepRegistryProvider><ActionsProvider><Harness /></ActionsProvider></DepRegistryProvider>);
  return {
    scene,
    canvas: container.querySelector('canvas')!,
    registry: () => grabbed.registry!,
    use: (id: string) => act(() => grabbed.tools!.setActive(id)),
  };
}

// jsdom's canvas rect is all zeros and the view is identity, so client coords are world coords.
function drag(canvas: HTMLCanvasElement, from: [number, number], to: [number, number]) {
  const at = (type: string, [x, y]: [number, number]) =>
    canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
  act(() => {
    at('pointerdown', from);
    for (let i = 1; i <= 4; i++) at('pointermove', [from[0] + ((to[0] - from[0]) * i) / 4, from[1] + ((to[1] - from[1]) * i) / 4]);
    at('pointerup', to);
  });
}

const pathOf = (scene: ReturnType<typeof setup>['scene']) => JSON.stringify(scene.get(A)!.data.path);

describe('the last-operation panel in draw', () => {
  it("replays a Smudge stroke at a new Size, and makes that Size the options row's", () => {
    const { scene, canvas, registry, use } = setup();
    use('smudgeBrush');
    const depth = scene.history.undoDepth();
    drag(canvas, [120, 50], [120, 30]);
    const first = pathOf(scene);
    expect(screen.getByRole('region', { name: 'Smudge brush' })).toBeInTheDocument();
    act(() => { fireEvent.change(screen.getByRole('slider', { name: /Size/ }), { target: { value: '90' } }); });
    expect(pathOf(scene)).not.toBe(first);
    expect(scene.history.undoDepth()).toBe(depth + 1);
    expect(drawPrefs().get('tools.smudgeBrush.radiusPx')).toBe(90);
    expect(registry().paramsOf('smudgeBrush')).toMatchObject({ radiusPx: 90 });
  });

  it('replays a Distort drag as Perspective, as one undo entry', () => {
    const { scene, canvas, use } = setup();
    use('distort');
    const depth = scene.history.undoDepth();
    drag(canvas, [220, 150], [250, 180]);
    const warpOf = () => (scene.get(A)!.data.warp as { warp: { kind: string; mode: string } } | undefined)?.warp;
    expect(warpOf()).toMatchObject({ kind: 'distort', mode: 'free' });
    expect(screen.getByRole('region', { name: 'Distort' })).toBeInTheDocument();
    act(() => { fireEvent.click(screen.getByRole('radio', { name: 'Perspective' })); });
    expect(warpOf()).toMatchObject({ kind: 'distort', mode: 'perspective' });
    expect(scene.history.undoDepth()).toBe(depth + 1);
    expect([...scene.getSelection()]).toEqual([A]);
  });
});
