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
import type { RectPose, Scene } from 'core/scene/types';
import type { View } from 'core/viewport/view';
import type { DrawCommand } from '@weasel-js/renderer';
import { type Path, linePath } from '@weasel-js/geom';
import { createScene } from 'core/scene/scene';
import type { GesturePreviewSource } from './gestureBounds';
import { createPaintedCursorState } from '@weasel-js/cursor';
import { ColorOverrideRegistry } from '@weasel-js/animator';
import type { Animator } from '@weasel-js/animator';
import { strokeOf } from '../util/paint';

type Data = Record<string, never>;

type Drawable = { draw: (data: unknown, view: View, dims: typeof DIMS) => DrawCommand[] };

/** The slots this file drives, read back off the built `layers` prop
 *  `<SceneCanvas>` hands `<Canvas>`. */
interface CapturedLayers {
  scene: { layers: ReadonlyArray<{ key: string; layer: Drawable }> };
  previewGhost: { layer: Drawable };
}

const captured = vi.hoisted(() => ({ layers: null as unknown }));

vi.mock('./Canvas', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./Canvas')>();
  const react = await import('react');
  const Canvas = react.forwardRef(function CanvasStub(
    props: CanvasProps<RectPose>,
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
        getSurfaceRect: () => ({ x: 0, y: 0, width: 0, height: 0 }),
        clientToWorld: (x: number, y: number): [number, number] => [x, y],
        requestRedraw: () => {},
        subscribeFrame: () => () => {},
        subscribeBeforePaint: () => () => {},
        subscribeResume: () => () => {},
        getView: () => VIEW,
        setView: () => {},
        subscribeView: () => () => {},
        getPaintedVersion: () => 0,
        paintedCursor: createPaintedCursorState(),
        cursorSink: { setBase() {}, setOverride() {} },
        getDebug: () => null,
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
  const a = scene.add({ kind: 'mark', layer: 'main', pose: pose(0), data: {} });
  const b = scene.add({ kind: 'mark', layer: 'main', pose: pose(100), data: {} });
  const edge = scene.add({
    kind: 'mark',
    layer: 'main',
    pose: pose(0),
    data: {},
    dependsOn: [a, b],
    derivePath: (_node, deps) => {
      const from = deps[0]?.pose;
      const to = deps[1]?.pose;
      if (!from || !to) return null;
      return linePath({ x: from.x, y: from.y }, { x: to.x, y: to.y });
    },
  });
  return { scene, a, b, edge };
}

/** Every command in `cmds`, groups and what they hold alike. */
function flat(cmds: readonly DrawCommand[]): DrawCommand[] {
  return cmds.flatMap((cmd) => (cmd.kind === 'group' ? [cmd, ...flat(cmd.children)] : [cmd]));
}

function pathCommands(cmds: readonly DrawCommand[]): Path[] {
  return flat(cmds).flatMap((cmd) => (cmd.kind === 'path' ? [cmd.path] : []));
}

/** What the scene slot paints, across the canvas layers it was built into. */
function paintScene(layers: CapturedLayers): DrawCommand[] {
  return layers.scene.layers.flatMap(({ layer }) => layer.draw(null, VIEW, DIMS));
}

function mount(
  scene: Scene<Data, 'main', RectPose>,
  animator?: Animator,
  alphaFor?: (id: string) => number,
): CapturedLayers {
  captured.layers = null;
  render(
    <SceneCanvas<Data, 'main', RectPose>
      scene={scene}
      width={300}
      height={300}
      animator={animator}
      alphaFor={alphaFor}
    />,
  );
  if (!captured.layers) throw new Error('SceneCanvas rendered no <Canvas> layers');
  return captured.layers as CapturedLayers;
}

describe('<SceneCanvas> installs the scene wiring', () => {
  it('paints the derived path through the scene layers it hands the renderer', () => {
    const { scene } = makeEdgeScene();
    expect(pathCommands(paintScene(mount(scene)))).toContainEqual(EXPECTED);
  });

  it('composes a node\'s override alpha into the scene layers it hands the renderer', () => {
    const { scene, a } = makeEdgeScene();
    scene.overrides.set(a, { alpha: 0.25 });
    const alphas = flat(paintScene(mount(scene))).flatMap((c) => (c.kind === 'group' ? [c.alpha] : []));
    expect(alphas.filter((alpha) => alpha !== undefined && alpha !== 1)).toEqual([0.25]);
  });

  it('multiplies a consumer alphaFor by the override alpha exactly once', () => {
    const { scene, a } = makeEdgeScene();
    scene.overrides.set(a, { alpha: 0.5 });
    const alphas = flat(paintScene(mount(scene, undefined, () => 0.4)))
      .flatMap((c) => (c.kind === 'group' && c.alpha !== undefined ? [c.alpha] : []));
    // Paint order is scene order: `a`, then `b`, then the edge between them.
    expect(alphas).toHaveLength(3);
    expect(alphas[0]).toBeCloseTo(0.2);
    expect(alphas[1]).toBeCloseTo(0.4);
    expect(alphas[2]).toBeCloseTo(0.4);
  });

  it('paints its animator\'s vertex-color overrides through the scene layers', () => {
    const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const id = scene.add({
      kind: 'mark',
      layer: 'main',
      pose: pose(0),
      data: { path: linePath({ x: 0, y: 0 }, { x: 10, y: 0 }), stroke: strokeOf('#fff', 2) } as unknown as Data,
    });
    const colorOverrides = new ColorOverrideRegistry();
    colorOverrides.set(id, 'stroke', [1, 0, 0, 1, 0, 0, 1, 1]);
    const animator = { colorOverrides, onTick: () => () => {} } as unknown as Animator;

    const body = flat(paintScene(mount(scene, animator))).find((c) => c.kind === 'path');
    expect(body?.kind === 'path' && body.stroke?.vertexColors).toEqual([1, 0, 0, 1, 0, 0, 1, 1]);
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
