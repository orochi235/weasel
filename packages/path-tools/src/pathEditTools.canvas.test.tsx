/**
 * The path-edit tools on a canvas in path edit: each runs its action from its
 * own binding, and with `anchors` on, the drag edits anchors again.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import {
  SceneCanvas, asNodeId, createScene, pathFromD, pathInWorld, type PolygonPath, type ToolsApi,
} from '@weasel-js/core';
import { createModeRegistry, DEFAULT_MODES } from '@weasel-js/modes';
import { pathToAnchors } from '@weasel-js/geom';
import { lengthenPreset, simplifyBrushPreset } from './presets';
import { usePathEditTools } from './toolSets';

beforeAll(() => {
  (HTMLCanvasElement.prototype as unknown as { getContext: () => null }).getContext = () => null;
});
afterEach(() => cleanup());

const A = asNodeId('a');
const FEATURES = ['draw', lengthenPreset, simplifyBrushPreset] as const;
type Pose = { x: number; y: number; width: number; height: number };

function setup(d: string, width: number, height: number) {
  const scene = createScene<{ path: PolygonPath }, 'main', Pose>({ systemLayers: [{ id: 'main' }] });
  scene.add({
    id: A, kind: 'mark', layer: 'main', data: { path: pathFromD(d) as PolygonPath },
    pose: { x: 0, y: 0, width, height },
  });
  scene.setSelection([A]);
  const modes = createModeRegistry({ modes: DEFAULT_MODES, initial: 'path-edit' });
  const tools: { current?: ToolsApi } = {};
  function Harness() {
    const pathEditTools = usePathEditTools();
    return (
      <SceneCanvas features={FEATURES} scene={scene} layers={{}} width={256} height={256}
        modes={modes} tools={pathEditTools} defaultPathEdit={{ id: A }}
        onToolsCreated={(t) => { tools.current = t; }} />
    );
  }
  const { container } = render(<Harness />);
  const canvas = container.querySelector('canvas')!;
  const use = (id: string) => act(() => tools.current!.setActive(id));
  const coords = () => {
    const node = scene.get(A)!;
    return Array.from((pathInWorld(node.data.path, node.pose as never) as PolygonPath).coords);
  };
  const anchorCount = () => pathToAnchors(scene.get(A)!.data.path).anchors[0].length;
  return { canvas, tools, use, coords, anchorCount };
}

// jsdom's canvas rect is all zeros and the view is identity, so client coords are world coords.
function drag(canvas: HTMLCanvasElement, points: [number, number][]) {
  const at = (type: string, [x, y]: [number, number]) =>
    canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
  act(() => {
    at('pointerdown', points[0]);
    for (const p of points.slice(1)) at('pointermove', p);
    at('pointerup', points[points.length - 1]);
  });
}

const ELBOW = 'M 0 0 L 20 0 L 20 20';

describe('path-edit tools on a canvas', () => {
  it('starts path edit on the anchors tool, where a drag on an end anchor moves it', () => {
    const t = setup(ELBOW, 20, 20);
    expect(t.tools.current?.active).toBe('anchors');
    drag(t.canvas, [[20, 20], [22, 35], [24, 50]]);
    expect(t.coords()).toEqual([0, 0, 20, 0, 24, 50]);
  });

  it('lengthens from an end anchor with Lengthen on', () => {
    const t = setup(ELBOW, 20, 20);
    t.use('lengthen');
    drag(t.canvas, [[20, 20], [22, 35], [24, 50]]);
    expect(t.coords()).toEqual([0, 0, 20, 0, 20, 50]);
  });

  it('brushes anchors away with the Simplify brush on', () => {
    const points = Array.from({ length: 21 }, (_, i) => `${i * 5} ${i % 2 === 0 ? 0 : 0.2}`);
    const t = setup(`M ${points.join(' L ')}`, 100, 0.2);
    const before = t.anchorCount();
    t.use('simplifyBrush');
    drag(t.canvas, Array.from({ length: 21 }, (_, i): [number, number] => [i * 5, 0]));
    expect(t.anchorCount()).toBeLessThan(before);
  });
});
