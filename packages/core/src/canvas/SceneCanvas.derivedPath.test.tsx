/**
 * Does `<SceneCanvas>` actually install the scene wiring?
 *
 * jsdom has no WebGL, so `<Canvas>` early-returns before any layer draws. The
 * component is rendered against a stub `<Canvas>` that captures the `layers`
 * prop instead — the same object the renderer would walk — and the layers are
 * then driven directly. Testing `wireSceneSlotToScene` alone proves nothing
 * about whether the component calls it.
 */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import type { CanvasProps } from './Canvas';
import type { CanvasExtensionApi } from './canvasExtension';
import type { Node, RectPose, Scene } from 'core/scene/types';
import type { View } from 'core/viewport/view';
import type { DrawCommand } from '../renderer';
import type { Path } from 'core/geometry/path';
import { createScene } from 'core/scene/scene';
import { linePath } from 'features/paths/builder';
import type { GesturePreviewSource } from './gestureBounds';

type Data = Record<string, never>;

/** The slots this file drives, read back off the `layers` prop `<SceneCanvas>`
 *  hands `<Canvas>`. `LayersMap`'s index signature collapses its named slots to
 *  `never` when read generically, so they are re-declared rather than cast. */
interface CapturedLayers {
  scene: {
    drawOne: (n: Node<Data, 'main', RectPose>, p: RectPose, v: View) => DrawCommand[];
    alphaFor?: (id: string) => number;
  };
  previewGhost: {
    layer: { draw: (data: unknown, view: View, dims: typeof DIMS) => DrawCommand[] };
  };
}

const captured = vi.hoisted(() => ({ layers: null as unknown }));

vi.mock('./Canvas', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./Canvas')>();
  const react = await import('react');
  const Canvas = react.forwardRef(function CanvasStub(
    props: CanvasProps<Node<Data, 'main', RectPose>, RectPose>,
    ref: React.Ref<unknown>,
  ) {
    captured.layers = props.layers;
    const elRef = react.useRef<HTMLCanvasElement | null>(null);
    react.useLayoutEffect(() => {
      // The component spreads this handle, so it has to be a plain object:
      // every member it reaches for is a no-op, and only `element` is real
      // (it feeds `internalCanvasRef`).
      const api = {
        element: elRef.current,
        surface: elRef.current,
        requestRedraw: () => {},
        subscribeFrame: () => () => {},
        getView: () => VIEW,
        setView: () => {},
        subscribeView: () => () => {},
        getPaintedVersion: () => 0,
        registerLayer: () => () => {},
        hitTestExtras: () => null,
      } satisfies CanvasExtensionApi;
      const set = (v: unknown) => {
        if (typeof ref === 'function') ref(v);
        else if (ref) (ref as React.MutableRefObject<unknown>).current = v;
      };
      set(api);
      return () => set(null);
    }, [ref]);
    return react.createElement('canvas', { ref: elRef });
  });
  return { ...actual, Canvas };
});

const { SceneCanvas } = await import('./SceneCanvas');

const pose = (x: number): RectPose => ({ x, y: 0, width: 10, height: 10 });
const VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DIMS = { width: 300, height: 300 };
const EXPECTED = linePath({ x: 0, y: 0 }, { x: 100, y: 0 });

/** Two anchors and an edge deriving a line between them. */
function makeEdgeScene() {
  const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const a = scene.add({ kind: 'leaf', layer: 'main', pose: pose(0), data: {} });
  const b = scene.add({ kind: 'leaf', layer: 'main', pose: pose(100), data: {} });
  const edge = scene.add({
    kind: 'leaf',
    layer: 'main',
    pose: pose(0),
    data: {},
    dependsOn: [a, b],
    derivePath: (_node, deps) => {
      const [from, to] = deps;
      if (!from || !to) return null;
      return linePath({ x: from.x, y: from.y }, { x: to.x, y: to.y });
    },
  });
  return { scene, a, b, edge };
}

function pathCommands(cmds: readonly DrawCommand[]): Path[] {
  const out: Path[] = [];
  for (const cmd of cmds) {
    if (cmd.kind === 'path') out.push(cmd.path);
    else if (cmd.kind === 'group') out.push(...pathCommands(cmd.children));
  }
  return out;
}

function mount(scene: Scene<Data, 'main', RectPose>): CapturedLayers {
  captured.layers = null;
  render(
    <SceneCanvas<Data, 'main', RectPose>
      scene={scene}
      width={300}
      height={300}
    />,
  );
  if (!captured.layers) throw new Error('SceneCanvas rendered no <Canvas> layers');
  return captured.layers as CapturedLayers;
}

describe('<SceneCanvas> installs the scene wiring', () => {
  it('paints the derived path through the scene slot it hands the renderer', () => {
    const { scene, edge } = makeEdgeScene();
    const slot = mount(scene).scene;
    const node = scene.get(edge)!;
    expect(pathCommands(slot.drawOne(node, node.pose, VIEW))).toEqual([EXPECTED]);
  });

  it('composes a node\'s override alpha into the slot it hands the renderer', () => {
    const { scene, a } = makeEdgeScene();
    scene.overrides.set(a, { alpha: 0.25 });
    const slot = mount(scene).scene;
    expect(slot.alphaFor?.(a)).toBeCloseTo(0.25);
  });

  it('paints the derived path in a preview ghost', () => {
    const { scene, edge } = makeEdgeScene();
    // In-flight ids and poses reach the ghost on the drawing view's envelope,
    // not off the surface's tool registry.
    const env = {
      getPreviewSources: (): readonly GesturePreviewSource[] => [{
        previewIds: () => [edge as string],
        previewPose: (id: string) => (id === (edge as string) ? pose(0) : null),
      }],
    };
    const ghost = mount(scene).previewGhost.layer;
    expect(pathCommands(ghost.draw(env, VIEW, DIMS))).toEqual([EXPECTED]);
  });
});
