/** A two-finger touch pinch over `<MinimapCanvas>` zooms the main view about the point between the fingers; one finger pans it. */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { useState } from 'react';
import { createScene, DEFAULT_MAX_ZOOM, RECT_POSE_DESCRIPTOR, viewScreenToWorld, viewWorldToScreen } from '@weasel-js/core';
import type { DrawCommand, PoseDescriptor, Scene, View, ZoomClampOptions } from '@weasel-js/core';
import { MinimapCanvas } from './MinimapCanvas';
import { computeFitView } from './minimapMath';

vi.mock('@weasel-js/renderer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@weasel-js/core')>()),
  WeaselRenderer: class {
    render(): void {}
    lastFrameStats() { return { retained: { composited: 0, declined: 0 } }; }
    resize(): void {}
    dispose(): void {}
  },
}));

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

beforeEach(() => {
  cleanup();
  const fakeGl = { enable: () => {} } as unknown as WebGL2RenderingContext;
  HTMLCanvasElement.prototype.getContext = (function (this: HTMLCanvasElement, kind: string) {
    return kind === 'webgl2' ? fakeGl : null;
  }) as HTMLCanvasElement['getContext'];
});

type P = { x: number; y: number; width: number; height: number };
const descriptor = RECT_POSE_DESCRIPTOR as unknown as PoseDescriptor<P>;

function makeScene(): Scene<object, 'main', P> {
  const s = createScene<object, 'main', P>({ systemLayers: [{ id: 'main' }] });
  s.batch('seed', () => {
    s.add({ kind: 'mark', data: {}, layer: 'main', pose: { x: 0, y: 0, width: 200, height: 200 } });
  });
  return s;
}

const drawOne = (): DrawCommand[] => [];
const MAIN: View = { x: 10, y: 20, scale: { x: 2, y: 2 } };
const MAIN_DIMS = { width: 400, height: 300 };
const Y = 50;

/** A `<MinimapCanvas>` whose main view follows its own writes, as a host's state would. */
function mount(zoom?: boolean | ZoomClampOptions, start: View = MAIN) {
  const scene = makeScene();
  const seen: View[] = [];
  function Host() {
    const [main, setMain] = useState(start);
    return (
      <MinimapCanvas
        scene={scene} mainView={main} mainViewDims={MAIN_DIMS}
        onMainViewChange={(v) => { seen.push(v); setMain(v); }}
        width={100} height={100} drawOne={drawOne} poseDescriptor={descriptor}
        {...(zoom === undefined ? {} : { zoom })}
      />
    );
  }
  const { container } = render(<Host />);
  const canvas = container.querySelector('canvas')!;
  const fit = computeFitView(scene, { width: 100, height: 100 }, 'scene', descriptor);
  const touch = (type: string, pointerId: number, clientX: number): void => {
    act(() => {
      canvas.dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true, pointerId, pointerType: 'touch', clientX, clientY: Y,
        button: 0, buttons: type === 'pointerup' ? 0 : 1,
      }));
    });
  };
  const main = (): View => seen.at(-1) ?? start;
  /** World point under minimap x on the `Y` line. */
  const worldAt = (x: number) => viewScreenToWorld(fit, { x, y: Y });
  return { touch, main, worldAt, fit };
}

/** The main view's center, in world. */
const centerOf = (v: View) => ({ x: v.x + MAIN_DIMS.width / (2 * v.scale.x), y: v.y + MAIN_DIMS.height / (2 * v.scale.y) });

describe('<MinimapCanvas> touch pinch', () => {
  it('zooms the main view about the point between the fingers, which follows them', () => {
    const { touch, main, worldAt } = mount();
    touch('pointerdown', 1, 40);
    touch('pointerdown', 2, 60);
    const before = main();
    const anchor = viewWorldToScreen(before, worldAt(50));

    // Spread 20 → 30 px, the centroid 50 → 55.
    touch('pointermove', 2, 70);
    const after = main();
    expect(after.scale.x).toBeCloseTo(before.scale.x * 1.5);
    expect(after.scale.y).toBeCloseTo(before.scale.y * 1.5);
    const held = viewWorldToScreen(after, worldAt(55));
    expect(held.x).toBeCloseTo(anchor.x);
    expect(held.y).toBeCloseTo(anchor.y);
  });

  it('pans with one finger, centering the main view on the point under it', () => {
    const { touch, main, worldAt } = mount();
    touch('pointerdown', 1, 30);
    touch('pointermove', 1, 50);
    touch('pointermove', 1, 60);
    expect(main().scale).toEqual(MAIN.scale);
    expect(centerOf(main()).x).toBeCloseTo(worldAt(60).x);
    expect(centerOf(main()).y).toBeCloseTo(worldAt(60).y);
  });

  it('hands a pan to the pinch when a second finger lands, and back when it lifts', () => {
    const { touch, main, worldAt, fit } = mount();
    touch('pointerdown', 1, 20);
    touch('pointermove', 1, 40);
    expect(centerOf(main()).x).toBeCloseTo(worldAt(40).x);

    touch('pointerdown', 2, 60);
    const before = main();
    const anchor = viewWorldToScreen(before, worldAt(50));
    // Both fingers move: spread 20 → 40, centroid 50 → 55. The pan's finger is part of the pinch now.
    touch('pointermove', 1, 35);
    touch('pointermove', 2, 75);
    const pinched = main();
    expect(pinched.scale.x).toBeCloseTo(before.scale.x * 2);
    const held = viewWorldToScreen(pinched, worldAt(55));
    expect(held.x).toBeCloseTo(anchor.x);
    expect(held.y).toBeCloseTo(anchor.y);

    // The second finger lifts; the first pans again from where the pinch left the view, without a jump.
    touch('pointerup', 2, 75);
    touch('pointermove', 1, 45);
    const panned = main();
    expect(panned.scale).toEqual(pinched.scale);
    expect(centerOf(panned).x - centerOf(pinched).x).toBeCloseTo(10 / fit.scale.x);
    expect(centerOf(panned).y).toBeCloseTo(centerOf(pinched).y);
  });

  it('ends both when the pan\'s own finger lifts, and the other finger moves nothing', () => {
    const { touch, main } = mount();
    touch('pointerdown', 1, 20);
    touch('pointermove', 1, 40);
    touch('pointerdown', 2, 60);
    touch('pointermove', 2, 70);
    touch('pointerup', 1, 40);
    const left = main();
    touch('pointermove', 2, 90);
    expect(main()).toEqual(left);
  });

  it('clamps to the kit default limits', () => {
    const top: View = { x: 0, y: 0, scale: { x: DEFAULT_MAX_ZOOM, y: DEFAULT_MAX_ZOOM } };
    const { touch, main } = mount(undefined, top);
    touch('pointerdown', 1, 40);
    touch('pointerdown', 2, 60);
    touch('pointermove', 2, 90);
    expect(main().scale.x).toBe(DEFAULT_MAX_ZOOM);
  });

  it('clamps to the limits it is given', () => {
    const { touch, main } = mount({ min: 0.5, max: 2.5 });
    touch('pointerdown', 1, 40);
    touch('pointerdown', 2, 60);
    touch('pointermove', 2, 99);
    expect(main().scale.x).toBe(2.5);
    touch('pointermove', 2, 41);
    expect(main().scale.x).toBe(0.5);
  });

  it('binds no pinch with zoom off', () => {
    const { touch, main } = mount(false);
    touch('pointerdown', 1, 40);
    touch('pointerdown', 2, 60);
    touch('pointermove', 2, 90);
    expect(main().scale).toEqual(MAIN.scale);
  });
});
