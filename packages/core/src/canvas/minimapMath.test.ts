import { describe, expect, it } from 'vitest';
import { createScene } from 'core/scene/scene';
import type { Scene } from 'core/scene/types';
import type { View } from 'core/viewport/view';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import {
  computeFitView,
  computeIndicatorCommand,
  FALLBACK_FIT_VIEW,
} from './minimapMath';

interface Data { label: string }
interface Pose { x: number; y: number; width: number; height: number }

type S = Scene<Data, 'bg', Pose>;

function makeScene(): S {
  return createScene<Data, 'bg', Pose>({ systemLayers: [{ id: 'bg' }] });
}

const identityPoseBounds = (p: Pose): Bounds => p;

describe('computeFitView — fit="scene"', () => {
  it('empty scene returns fallback view', () => {
    const scene = makeScene();
    const view = computeFitView(scene, { width: 200, height: 100 }, 'scene', identityPoseBounds);
    expect(view).toEqual(FALLBACK_FIT_VIEW);
  });

  it('one-node scene centers the node in the minimap', () => {
    const scene = makeScene();
    scene.add({
      kind: 'leaf',
      layer: 'bg',
      pose: { x: 10, y: 20, width: 40, height: 40 },
      data: { label: 'a' },
    });
    const dims = { width: 200, height: 200 };
    const view = computeFitView(scene, dims, 'scene', identityPoseBounds);
    // Uniform scale; pose center (30, 40) sits at minimap center.
    const cx = view.x + dims.width / (2 * view.scale.x);
    const cy = view.y + dims.height / (2 * view.scale.y);
    expect(cx).toBeCloseTo(30, 6);
    expect(cy).toBeCloseTo(40, 6);
    // Both axes equal scale (uniform).
    expect(view.scale.x).toBeCloseTo(view.scale.y, 6);
  });

  it('many-node scene fits the union AABB', () => {
    const scene = makeScene();
    scene.add({ kind: 'leaf', layer: 'bg', pose: { x: 0, y: 0, width: 10, height: 10 }, data: { label: 'a' } });
    scene.add({ kind: 'leaf', layer: 'bg', pose: { x: 90, y: 40, width: 10, height: 10 }, data: { label: 'b' } });
    // Union: { x: 0, y: 0, width: 100, height: 50 }
    const dims = { width: 200, height: 200 };
    const view = computeFitView(scene, dims, 'scene', identityPoseBounds);
    const cx = view.x + dims.width / (2 * view.scale.x);
    const cy = view.y + dims.height / (2 * view.scale.y);
    expect(cx).toBeCloseTo(50, 6);
    expect(cy).toBeCloseTo(25, 6);
    expect(view.scale.x).toBeCloseTo(view.scale.y, 6);
  });

  it('asymmetric scene picks the tighter-axis scale (wider than tall)', () => {
    const scene = makeScene();
    // 1000 wide x 100 tall, into a 200x200 minimap with padding=8 → avail 184x184.
    scene.add({ kind: 'leaf', layer: 'bg', pose: { x: 0, y: 0, width: 1000, height: 100 }, data: { label: 'a' } });
    const dims = { width: 200, height: 200 };
    const view = computeFitView(scene, dims, 'scene', identityPoseBounds);
    // x-axis is tighter: 184/1000 < 184/100, so the chosen uniform scale
    // is the x-axis ratio.
    expect(view.scale.x).toBeCloseTo(184 / 1000, 6);
    expect(view.scale.y).toBeCloseTo(184 / 1000, 6);
  });

  it('asymmetric scene picks the tighter-axis scale (taller than wide)', () => {
    const scene = makeScene();
    scene.add({ kind: 'leaf', layer: 'bg', pose: { x: 0, y: 0, width: 100, height: 1000 }, data: { label: 'a' } });
    const dims = { width: 200, height: 200 };
    const view = computeFitView(scene, dims, 'scene', identityPoseBounds);
    expect(view.scale.x).toBeCloseTo(184 / 1000, 6);
    expect(view.scale.y).toBeCloseTo(184 / 1000, 6);
  });

  it('ignores container nodes when unioning leaf poses', () => {
    const scene = makeScene();
    const c = scene.add({
      kind: 'container',
      layer: 'bg',
      pose: { x: -1000, y: -1000, width: 2000, height: 2000 },
      data: { label: 'c' },
    });
    scene.add({
      kind: 'leaf',
      layer: 'bg',
      pose: { x: 0, y: 0, width: 10, height: 10 },
      data: { label: 'child' },
      parent: c,
    });
    const dims = { width: 200, height: 200 };
    const view = computeFitView(scene, dims, 'scene', identityPoseBounds);
    // If container were considered, scale would be much smaller. Leaf-only:
    // union is just the 10x10 leaf, so scale ~ 184/10.
    expect(view.scale.x).toBeCloseTo(184 / 10, 6);
  });
});

describe('computeFitView — fit={kind:"world", rect}', () => {
  it('landscape rect (wider than dims) picks the x-axis fit', () => {
    const scene = makeScene();
    const dims = { width: 200, height: 200 };
    const view = computeFitView(
      scene,
      dims,
      { kind: 'world', rect: { x: 0, y: 0, width: 400, height: 100 } },
      identityPoseBounds,
    );
    expect(view.scale.x).toBeCloseTo(184 / 400, 6);
    expect(view.scale.y).toBeCloseTo(184 / 400, 6);
    const cx = view.x + dims.width / (2 * view.scale.x);
    const cy = view.y + dims.height / (2 * view.scale.y);
    expect(cx).toBeCloseTo(200, 6);
    expect(cy).toBeCloseTo(50, 6);
  });

  it('portrait rect (taller than dims) picks the y-axis fit', () => {
    const scene = makeScene();
    const dims = { width: 200, height: 200 };
    const view = computeFitView(
      scene,
      dims,
      { kind: 'world', rect: { x: -50, y: 0, width: 100, height: 400 } },
      identityPoseBounds,
    );
    expect(view.scale.x).toBeCloseTo(184 / 400, 6);
    expect(view.scale.y).toBeCloseTo(184 / 400, 6);
  });

  it('exact-aspect rect fits both axes equally', () => {
    const scene = makeScene();
    // dims and rect both square ⇒ both axis ratios equal.
    const view = computeFitView(
      scene,
      { width: 200, height: 200 },
      { kind: 'world', rect: { x: 0, y: 0, width: 100, height: 100 } },
      identityPoseBounds,
    );
    expect(view.scale.x).toBeCloseTo(184 / 100, 6);
    expect(view.scale.y).toBeCloseTo(184 / 100, 6);
  });

  it('zero-width rect falls back to identity scale (no divide-by-zero)', () => {
    const scene = makeScene();
    const view = computeFitView(
      scene,
      { width: 200, height: 200 },
      { kind: 'world', rect: { x: 5, y: 5, width: 0, height: 100 } },
      identityPoseBounds,
    );
    expect(view.scale.x).toBe(1);
    expect(view.scale.y).toBe(1);
    expect(Number.isFinite(view.x)).toBe(true);
    expect(Number.isFinite(view.y)).toBe(true);
  });

  it('zero-height rect falls back to identity scale (no divide-by-zero)', () => {
    const scene = makeScene();
    const view = computeFitView(
      scene,
      { width: 200, height: 200 },
      { kind: 'world', rect: { x: 5, y: 5, width: 100, height: 0 } },
      identityPoseBounds,
    );
    expect(view.scale.x).toBe(1);
    expect(view.scale.y).toBe(1);
  });

  it('custom padding shrinks the fit ratio', () => {
    const scene = makeScene();
    const view = computeFitView(
      scene,
      { width: 200, height: 200 },
      { kind: 'world', rect: { x: 0, y: 0, width: 100, height: 100 } },
      identityPoseBounds,
      { padding: 0 },
    );
    expect(view.scale.x).toBeCloseTo(200 / 100, 6);
  });
});

describe('computeFitView — fit=function', () => {
  it('calls the function with (scene, dims) and returns its result unchanged', () => {
    const scene = makeScene();
    const dims = { width: 200, height: 100 };
    const expected: View = { x: 7, y: 8, scale: { x: 0.5, y: 0.25 } };
    let calledWithScene: unknown = null;
    let calledWithDims: unknown = null;
    const got = computeFitView(
      scene,
      dims,
      (s, d) => {
        calledWithScene = s;
        calledWithDims = d;
        return expected;
      },
      identityPoseBounds,
    );
    expect(got).toBe(expected);
    expect(calledWithScene).toBe(scene);
    expect(calledWithDims).toBe(dims);
  });
});

describe('computeIndicatorCommand', () => {
  // The indicator is emitted in WORLD coords. The caller wraps the command
  // list in a group transformed by the minimap's view, so the view→screen
  // step happens once, in the same place the scene nodes pay it.

  it('identity main view → world rect = full mainViewDims', () => {
    const mainView: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    const cmd = computeIndicatorCommand(mainView, { width: 800, height: 600 });
    expect(cmd.kind).toBe('path');
    expect(cmd.path.kind).toBe('rect');
    if (cmd.path.kind !== 'rect') throw new Error('unreachable');
    expect(cmd.path.x).toBeCloseTo(0, 6);
    expect(cmd.path.y).toBeCloseTo(0, 6);
    expect(cmd.path.width).toBeCloseTo(800, 6);
    expect(cmd.path.height).toBeCloseTo(600, 6);
  });

  it('zoomed main view → world rect shrinks proportionally', () => {
    const mainView: View = { x: 0, y: 0, scale: { x: 2, y: 2 } };
    const cmd = computeIndicatorCommand(mainView, { width: 800, height: 600 });
    if (cmd.path.kind !== 'rect') throw new Error('unreachable');
    // At 2× zoom the main canvas covers 400×300 of world.
    expect(cmd.path.width).toBeCloseTo(400, 6);
    expect(cmd.path.height).toBeCloseTo(300, 6);
  });

  it('panned main view → world rect translates by mainView origin', () => {
    const mainView: View = { x: 50, y: 30, scale: { x: 1, y: 1 } };
    const cmd = computeIndicatorCommand(mainView, { width: 800, height: 600 });
    if (cmd.path.kind !== 'rect') throw new Error('unreachable');
    expect(cmd.path.x).toBeCloseTo(50, 6);
    expect(cmd.path.y).toBeCloseTo(30, 6);
    expect(cmd.path.width).toBeCloseTo(800, 6);
    expect(cmd.path.height).toBeCloseTo(600, 6);
  });

  it('non-uniform main view scale → rect dimensions reflect each axis', () => {
    const mainView: View = { x: 0, y: 0, scale: { x: 2, y: 4 } };
    const cmd = computeIndicatorCommand(mainView, { width: 800, height: 800 });
    if (cmd.path.kind !== 'rect') throw new Error('unreachable');
    expect(cmd.path.width).toBeCloseTo(400, 6);
    expect(cmd.path.height).toBeCloseTo(200, 6);
  });

  it('default style is white 1px [2,3] dash', () => {
    const cmd = computeIndicatorCommand(
      { x: 0, y: 0, scale: { x: 1, y: 1 } },
      { width: 100, height: 100 },
    );
    expect(cmd.stroke?.paint).toEqual({ fill: 'solid', color: '#ffffff' });
    expect(cmd.stroke?.width).toBe(1);
    expect(cmd.stroke?.dash).toEqual([2, 3]);
  });

  it('custom style is reflected on the command', () => {
    const cmd = computeIndicatorCommand(
      { x: 0, y: 0, scale: { x: 1, y: 1 } },
      { width: 100, height: 100 },
      { stroke: '#ff00aa', width: 2.5, dash: [4, 1, 2, 1] },
    );
    expect(cmd.stroke?.paint).toEqual({ fill: 'solid', color: '#ff00aa' });
    expect(cmd.stroke?.width).toBe(2.5);
    expect(cmd.stroke?.dash).toEqual([4, 1, 2, 1]);
  });
});
