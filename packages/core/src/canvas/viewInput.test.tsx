/**
 * A press over a view resolves through that view's camera: it selects what the
 * view shows under the pointer, and a drag moves it in that view's world units.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, act } from '@testing-library/react';
import { createRef } from 'react';
import { SceneCanvas } from './SceneCanvas';
import { CanvasView } from './CanvasView';
import { createScene } from 'core/scene/scene';
import type { Scene, NodeId } from 'core/scene/types';
import type { View } from 'core/viewport/view';
import type { RenderLayer } from 'core/layers/render';
import type { SceneCanvasApi } from './canvasExtension';

type D = { kind: 'rect' };
type P = { x: number; y: number; width: number; height: number };

/** A 4× lens over the world origin, painted at canvas x ∈ [200, 300). */
const LENS = { x: 200, y: 0, w: 100, h: 100 };
const LENS_VIEW: View = { x: 0, y: 0, scale: { x: 4, y: 4 } };

/** Canvas (220, 20) is lens-local (20, 20), world (5, 5) through the lens —
 *  inside `inLens` — and world (220, 20) on the canvas's own camera, inside
 *  `underLens`. */
const PRESS = { x: 220, y: 20 };

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

function makeScene() {
  const scene = createScene<D, 'main', P>({ systemLayers: [{ id: 'main' }] });
  const inLens = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: { kind: 'rect' } });
  const underLens = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 210, y: 10, width: 30, height: 30 }, data: { kind: 'rect' } });
  return { scene, inLens, underLens };
}

function pointer(el: Element, type: string, x: number, y: number) {
  el.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: 1, clientX: x, clientY: y,
    button: 0, buttons: type === 'pointerup' ? 0 : 1,
  }));
}

function drag(el: Element, from: { x: number; y: number }, dx: number) {
  act(() => {
    pointer(el, 'pointerdown', from.x, from.y);
    pointer(el, 'pointermove', from.x + dx / 2, from.y);
    pointer(el, 'pointermove', from.x + dx, from.y);
    pointer(el, 'pointerup', from.x + dx, from.y);
  });
}

function click(el: Element, at: { x: number; y: number }) {
  act(() => {
    pointer(el, 'pointerdown', at.x, at.y);
    pointer(el, 'pointerup', at.x, at.y);
  });
}

const poseOf = (scene: Scene<D, 'main', P>, id: NodeId) => scene.nodes.get(id)!.pose;

describe('a press over a view', () => {
  it('selects the node the view shows under the pointer', () => {
    const { scene, inLens } = makeScene();
    const { container } = render(
      <SceneCanvas scene={scene} layers={{}} width={400} height={300}>
        <CanvasView id="lens" bounds={LENS} defaultView={LENS_VIEW} />
      </SceneCanvas>,
    );
    click(container.querySelector('canvas')!, PRESS);
    expect(scene.getSelection()).toEqual([inLens]);
  });

  it('drags in the view’s world units: 40 screen px at 4× is 10', () => {
    const { scene, inLens } = makeScene();
    const { container } = render(
      <SceneCanvas scene={scene} layers={{}} width={400} height={300}>
        <CanvasView id="lens" bounds={LENS} defaultView={LENS_VIEW} />
      </SceneCanvas>,
    );
    drag(container.querySelector('canvas')!, PRESS, 40);
    expect(poseOf(scene, inLens)).toMatchObject({ x: 10, y: 0 });
  });
});

describe('SceneCanvasApi.addView', () => {
  function mount(props: Parameters<SceneCanvasApi['addView']>[0]) {
    const { scene, inLens, underLens } = makeScene();
    const ref = createRef<SceneCanvasApi>();
    const r = render(<SceneCanvas ref={ref} scene={scene} layers={{}} width={400} height={300} />);
    let handle!: ReturnType<SceneCanvasApi['addView']>;
    act(() => { handle = ref.current!.addView(props); });
    return { scene, inLens, underLens, handle, canvas: r.container.querySelector('canvas')!, ref };
  }

  it('routes a press through a view declared imperatively', () => {
    const h = mount({ id: 'lens', bounds: () => LENS, view: () => LENS_VIEW });
    click(h.canvas, PRESS);
    expect(h.scene.getSelection()).toEqual([h.inLens]);
  });

  it('reads a thunked camera per event, so a moving lens is honored', () => {
    let camera: View = { x: 1000, y: 1000, scale: { x: 4, y: 4 } };
    const h = mount({ id: 'lens', bounds: () => LENS, view: () => camera });
    camera = LENS_VIEW;
    drag(h.canvas, PRESS, 40);
    expect(poseOf(h.scene, h.inLens)).toMatchObject({ x: 10, y: 0 });
  });

  it('stops routing once removed', () => {
    const h = mount({ id: 'lens', bounds: () => LENS, view: () => LENS_VIEW });
    act(() => { h.handle.remove(); });
    click(h.canvas, PRESS);
    expect(h.scene.getSelection()).toEqual([h.underLens]);
  });

  it('paints nothing on the surface when `paint` is false, and hands the host its draw', () => {
    const h = mount({ id: 'lens', bounds: () => LENS, view: () => LENS_VIEW, paint: false });
    const outer: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    const cmds = h.handle.draw({}, outer, { width: 400, height: 300 });
    expect(cmds).toHaveLength(1);
    expect(cmds[0]).toMatchObject({ kind: 'group', clip: { width: LENS.w, height: LENS.h } });
    // Still routed: paint is the host's, input is the surface's.
    click(h.canvas, PRESS);
    expect(h.scene.getSelection()).toEqual([h.inLens]);
  });
});

describe('a view that is not interactive', () => {
  it('leaves a press to the canvas beneath it, as a plain viewport layer does', () => {
    const { scene, underLens } = makeScene();
    const { container } = render(
      <SceneCanvas scene={scene} layers={{}} width={400} height={300}>
        <CanvasView id="lens" bounds={LENS} defaultView={LENS_VIEW} interactive={false} />
      </SceneCanvas>,
    );
    click(container.querySelector('canvas')!, PRESS);
    expect(scene.getSelection()).toEqual([underLens]);
  });
});

describe('registered layers and views', () => {
  type Square = { x0: number; x1: number; y0: number; y1: number };
  /** Claims a screen-space square on whatever frame it is asked in, recording
   *  each frame's scale. */
  function claimingLayer(seen: number[], sq: Square): RenderLayer<unknown> {
    return {
      id: 'chrome', label: 'chrome', space: 'screen', draw: () => [],
      hitTest: (wx, wy, _data, view) => {
        seen.push(view.scale.x);
        const sx = (wx - view.x) * view.scale.x;
        const sy = (wy - view.y) * view.scale.y;
        return sx >= sq.x0 && sx < sq.x1 && sy >= sq.y0 && sy < sq.y1 ? { strength: 'exclusive' } : null;
      },
    };
  }

  it('a layer painted over a view takes the press before the view does', () => {
    const { scene } = makeScene();
    const ref = createRef<SceneCanvasApi>();
    const { container } = render(
      <SceneCanvas ref={ref} scene={scene} layers={{}} width={400} height={300}>
        <CanvasView id="lens" bounds={LENS} defaultView={LENS_VIEW} />
      </SceneCanvas>,
    );
    const seen: number[] = [];
    act(() => { ref.current!.registerLayer(claimingLayer(seen, { x0: 200, x1: 240, y0: 0, y1: 40 })); });
    click(container.querySelector('canvas')!, PRESS);
    // Claimed on the canvas's frame, so nothing in the lens got selected.
    expect(scene.getSelection()).toEqual([]);
    expect(seen).toContain(1);
  });

  it('a view does not hit-test a registered layer it does not paint', () => {
    const { scene, inLens } = makeScene();
    const ref = createRef<SceneCanvasApi>();
    const { container } = render(
      <SceneCanvas ref={ref} scene={scene} layers={{}} width={400} height={300}>
        <CanvasView id="lens" bounds={LENS} defaultView={LENS_VIEW} />
      </SceneCanvas>,
    );
    const seen: number[] = [];
    // PRESS is canvas (220, 20), outside this square, and lens-local (20, 20),
    // inside it: a layer asked on the lens's frame would wrongly claim it.
    act(() => { ref.current!.registerLayer(claimingLayer(seen, { x0: 0, x1: 60, y0: 0, y1: 40 })); });
    click(container.querySelector('canvas')!, PRESS);
    expect(seen).not.toContain(4);
    expect(scene.getSelection()).toEqual([inLens]);
  });
});
