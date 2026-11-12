import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createScene } from 'core/scene/scene';
import { registerNodeShape } from './NodeShape';
import { defaultDrawOne } from './defaultDrawOne';
import { buildSceneLayer } from './buildSceneLayer';
import { sceneToAdapter } from './sceneAdapter';
import { planPixelRender } from './renderSceneToPixels';
import { sceneViewFrame } from './sceneViewRender';

// A painter recording the density it was told it paints at.
const seen: (number | undefined)[] = [];
let dispose: () => void = () => {};
const dprDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'devicePixelRatio');

beforeEach(() => {
  seen.length = 0;
  dispose = registerNodeShape(
    { id: 'test:pixel-scale', matches: () => true, paint: (_n, _p, ctx) => { seen.push(ctx?.pixelScale); return []; } },
    { priority: 'high' },
  );
  // The window's density, which none of these paint at.
  Object.defineProperty(globalThis, 'devicePixelRatio', { value: 2, configurable: true });
});

afterEach(() => {
  dispose();
  if (dprDescriptor) Object.defineProperty(globalThis, 'devicePixelRatio', dprDescriptor);
  else delete (globalThis as { devicePixelRatio?: number }).devicePixelRatio;
});

function oneNodeScene() {
  const scene = createScene<null, 'bg', { x: number; y: number; width: number; height: number }>({
    systemLayers: [{ id: 'bg' }],
  });
  const id = scene.add({ kind: 'mark', layer: 'bg', pose: { x: 0, y: 0, width: 10, height: 10 }, data: null });
  return Object.assign(scene, { only: () => scene.get(id)! });
}

const VIEW = { x: 0, y: 0, scale: { x: 3, y: 3 } };

describe("a painter's pixelScale", () => {
  it("is the canvas's own density times the view's scale", () => {
    const scene = oneNodeScene();
    const layer = buildSceneLayer({ drawOne: defaultDrawOne }, sceneToAdapter(scene) as never, () => null, () => null);
    layer.draw(null, VIEW, { width: 100, height: 100, dpr: 1 });
    expect(seen).toEqual([3]);
  });

  it("is a view's own `dpr` in a detached render", () => {
    sceneViewFrame({ scene: oneNodeScene(), view: VIEW, width: 100, height: 100, drawOne: defaultDrawOne, dpr: 1.5 });
    expect(seen).toEqual([4.5]);
  });

  it('is the output scale in a pixel render, which never reads the window', () => {
    planPixelRender({ scene: oneNodeScene(), sourceRect: { x: 0, y: 0, width: 10, height: 10 }, scale: { x: 3, y: 3 } });
    expect(seen).toEqual([3]);
  });

  it("is the window's density times the view's scale when nothing says another", () => {
    defaultDrawOne(oneNodeScene().only(), { x: 0, y: 0, width: 10, height: 10 }, VIEW);
    expect(seen).toEqual([6]);
  });
});
