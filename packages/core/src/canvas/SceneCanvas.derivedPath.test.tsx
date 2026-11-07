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
import { act, fireEvent, render, renderHook } from '@testing-library/react';
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
import { useAnimator } from '@weasel-js/animator/react';
import type { Animator } from '@weasel-js/animator';
import { strokeOf } from '../util/paint';
import { linear } from '@weasel-js/geom';
import type { StrokeTrim } from '@weasel-js/paint';
import type { TrimOverride } from '@weasel-js/animator';

type Data = Record<string, never>;

type Drawable = { draw: (data: unknown, view: View, dims: typeof DIMS) => DrawCommand[] };

/** The slots this file drives, read back off the built `layers` prop
 *  `<SceneCanvas>` hands `<Canvas>`. */
interface CapturedLayers {
  scene: { layers: ReadonlyArray<{ key: string; layer: Drawable }> };
  previewGhost: { layer: Drawable };
}

const captured = vi.hoisted(() => ({ layers: null as unknown, redrawOn: undefined as CanvasProps<RectPose>['redrawOn'] }));

vi.mock('./Canvas', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./Canvas')>();
  const react = await import('react');
  const Canvas = react.forwardRef(function CanvasStub(
    props: CanvasProps<RectPose>,
    ref: React.Ref<unknown>,
  ) {
    captured.layers = props.layers;
    captured.redrawOn = props.redrawOn;
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
        pickAt: async () => 0,
        readIds: async () => ({ x: 0, y: 0, width: 0, height: 0, data: new Uint32Array(0) }), readIdsSync: () => null, worker: null,
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
const DIMS = { width: 300, height: 300, dpr: 1 };
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

/** A stroked line from (0, 0) to (`length`, 0) wearing `trim`. */
function lineScene(trim?: StrokeTrim, length = 10) {
  const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const data = { path: linePath({ x: 0, y: 0 }, { x: length, y: 0 }), stroke: { ...strokeOf('#fff', 2), ...(trim ? { trim } : {}) } };
  const id = scene.add({ kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: length, height: 0 }, data: data as unknown as Data });
  return { scene, id, data };
}

/** The trim on the first stroked command the scene slot paints. */
function paintedTrim(layers: CapturedLayers): StrokeTrim | undefined {
  const body = flat(paintScene(layers)).find((c) => c.kind === 'path' && c.stroke !== undefined);
  return body?.kind === 'path' ? body.stroke?.trim : undefined;
}

/** Frames advanced by hand, for `useAnimator`'s `requestFrame`. */
function frameClock() {
  let now = 0;
  const due = new Map<number, (t: number) => void>();
  let next = 1;
  return {
    now: () => now,
    requestFrame: (cb: (t: number) => void) => { const h = next++; due.set(h, cb); return h; },
    cancelFrame: (h: number) => { due.delete(h); },
    advance: (ms: number) => {
      now += ms;
      const run = [...due.values()];
      due.clear();
      for (const cb of run) cb(now);
    },
  };
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

  it("paints its animator's trim overrides through the scene layers, leaving the scene alone", () => {
    const { scene, id, data } = lineScene({ pace: 'anchor' });
    const undoable = scene.history.canUndo();
    const animator = renderHook(() => useAnimator()).result.current;
    animator.trimOverrides.set(id, { end: 0.5 });

    expect(paintedTrim(mount(scene, animator))).toEqual({ pace: 'anchor', end: 0.5 });
    expect(scene.get(id)!.data).toBe(data);
    expect(scene.history.canUndo()).toBe(undoable);
  });

  it("paints a running trim tween's frames, keeping the stroke's own start", () => {
    const { scene, id } = lineScene({ start: { length: 2 } });
    const clock = frameClock();
    const animator = renderHook(() => useAnimator(clock)).result.current;
    const layers = mount(scene, animator);
    act(() => {
      animator.tween({ target: animator.trimOverrides.target(id, 'end'), from: 0, to: 1, ms: 100, easing: linear });
    });
    act(() => clock.advance(0));
    act(() => clock.advance(50));
    expect(paintedTrim(layers)).toEqual({ start: { length: 2 }, end: expect.closeTo(0.5, 6) });
    act(() => clock.advance(50));
    // At rest the override's `end: 1` is the stroke's own window, so the stroke's own command paints.
    expect(animator.trimOverrides.get(id)).toEqual({ end: 1 });
    expect(paintedTrim(layers)).toEqual({ start: { length: 2 } });
  });

  it('repaints for a bare set or clear on either override store', () => {
    const { scene, id } = lineScene();
    const animator = renderHook(() => useAnimator()).result.current;
    mount(scene, animator);
    let repaints = 0;
    const offs = (captured.redrawOn ?? []).map((source) => source.subscribe(() => { repaints += 1; }));
    animator.trimOverrides.set(id, { end: 0.5 });
    expect(repaints).toBe(1);
    animator.colorOverrides.set(id, 'stroke', [1, 0, 0, 1, 0, 0, 1, 1]);
    expect(repaints).toBe(2);
    animator.trimOverrides.clear(id);
    animator.colorOverrides.clear(id, 'stroke');
    expect(repaints).toBe(4);
    for (const off of offs) off();
  });

  it('picks by the authored trim whatever the animator paints', () => {
    const hovered: (string | null)[] = [];
    const hoverAt = (trim: StrokeTrim, override: TrimOverride) => {
      const { scene, id } = lineScene(trim, 100);
      const animator = renderHook(() => useAnimator()).result.current;
      animator.trimOverrides.set(id, override);
      const { container } = render(
        <SceneCanvas<Data, 'main', RectPose>
          scene={scene} width={300} height={300} animator={animator} onHover={(hit) => hovered.push(hit)}
        />,
      );
      fireEvent.pointerMove(container.querySelector('canvas')!, { clientX: 90, clientY: 0 });
      return id;
    };
    hoverAt({ end: 0.1 }, { end: 1 });
    const drawnOn = hoverAt({}, { end: 0.1 });
    expect(hovered).toEqual([drawnOn]);
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
