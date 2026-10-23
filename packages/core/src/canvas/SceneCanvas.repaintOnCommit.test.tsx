/**
 * A prop that reaches the paint through a ref or a memo still repaints when it
 * changes: `chromeVisibility` is read live by the chrome-caps resolver, so no
 * identity the canvas can compare moves with it. The paint counts for a hover
 * and a drag pin what that costs.
 *
 * The GL recorder is load-bearing: without a WebGL2 context every paint bails
 * before landing, and every count here is zero.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
import type { Scene } from 'core/scene/types';
import type { RenderLayer } from 'core/layers/render';
import type { SurfaceContribution } from './surfaceContribution';
import type { VisibilityRules } from 'features/chrome-caps';
import { never } from 'features/chrome-caps';
import { makeGLRecorder } from '@weasel-js/renderer/testing/glRecorder';

type D = { kind: 'rect' };
type L = 'main';
type P = { x: number; y: number; width: number; height: number };

beforeAll(() => {
  const recorder = makeGLRecorder();
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn((kind: unknown) => (kind === 'webgl2' ? recorder.gl : null));
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

afterEach(() => { cleanup(); });

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const frames = async (n: number) => { await act(async () => { for (let i = 0; i < n; i++) await frame(); }); };

function makeScene(): Scene<D, L, P> {
  const s = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
  s.batch('seed', () => {
    s.add({ kind: 'mark', data: { kind: 'rect' }, layer: 'main', pose: { x: 0, y: 0, width: 50, height: 50 } });
  });
  return s;
}

/** A screen layer with no `deps`, so the command cache cannot serve it and
 *  every paint of the surface's own view calls its draw. */
function paintProbe(count: { n: number }): RenderLayer<unknown> {
  return {
    id: 'paint-probe', label: 'probe', space: 'screen',
    draw: (data) => {
      if ((data as { viewId?: string | null } | null)?.viewId == null) count.n++;
      return [];
    },
  };
}

function mount() {
  const scene = makeScene();
  const count = { n: 0 };
  const ambient: SurfaceContribution[] = [{ id: 'probe', eligibility: { always: true }, overlay: paintProbe(count) }];
  const layers = {};
  const ui = (chromeVisibility: VisibilityRules) => (
    <SceneCanvas features={['draw']} scene={scene} layers={layers} width={200} height={200}
      ambient={ambient} chromeVisibility={chromeVisibility} />
  );
  const shown: VisibilityRules = {};
  const r = render(ui(shown));
  const canvas = r.container.querySelector('canvas')!;
  const fire = (type: string, x: number, y: number, buttons: number): void => {
    act(() => {
      canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, buttons }));
    });
  };
  return { count, rerender: (v: VisibilityRules) => r.rerender(ui(v)), fire };
}

describe('SceneCanvas repaints on a committed render', () => {
  it('repaints when only chromeVisibility changes', async () => {
    const { count, rerender } = mount();
    await frames(3);
    const before = count.n;
    expect(before).toBeGreaterThan(0);

    rerender({ 'selection.handles': never });
    await frames(3);

    expect(count.n).toBe(before + 1);
  });

  it('paints nothing for a hover over empty canvas', async () => {
    const { count, fire } = mount();
    await frames(3);
    const before = count.n;
    for (let i = 0; i < 10; i++) {
      fire('pointermove', 120 + i, 150, 0);
      await frames(1);
    }
    expect(count.n - before).toBe(0);
  });

  it('paints a drag once per frame', async () => {
    const { count, fire } = mount();
    await frames(3);
    const before = count.n;
    fire('pointerdown', 25, 25, 1);
    await frames(1);
    for (let i = 1; i <= 10; i++) {
      fire('pointermove', 25 + i * 5, 25, 1);
      await frames(1);
    }
    fire('pointerup', 75, 25, 0);
    await frames(2);
    // The press, ten moves and the release: one paint for each frame.
    expect(count.n - before).toBe(12);
  });
});
