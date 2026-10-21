import '@weasel-js/theme/tokens.css';
import 'windease/styles.css';
import '../../styles.less';
import './LensOverlay.browser.test.less';
import { cleanup, screen, waitFor } from '@testing-library/react';
import { effectivePose, type RectPose, sceneToAdapter } from '@weasel-js/core';
import { canvasGl, readCanvas } from '@weasel-js/core/testing/canvasPixels';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { useEffect } from 'react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { commands, page, userEvent } from 'vitest/browser';
import { defineInstrument } from '../../instrument/defineInstrument';
import { Lab } from '../../lab/Lab';
import { toDeviceRect } from '../../surface/deviceRect';
import {
  useSurface,
  useSurfaceCanvas,
  useSurfaceTile,
  useTileId,
} from '../../surface/useSurfaceTile';
import { LensOverlay, type LensOverlayProps } from './LensOverlay';
import { addLensOps, createLensScene, lensesOf } from './lensScene';
import { BODY_SIZE, type LensScene } from './lensTypes';

// The lens canvas covers the whole lab body, but takes input only on its hit
// boxes: its input element is `pointer-events: none`. Whether a press beside
// a lens reaches the story, and whether a drag that starts on a hit box
// finishes once the dispatcher has captured the pointer on that input element,
// are hit-testing and pointer capture — a real browser's, with a real pointer.

let clicks = 0;
let wheels: number[] = [];
let scene: LensScene<string>;

/** Stands in for an annotation mark: paints its tile red in the `over` buffer,
 *  once per frame that dirties it, as a co-tenant of that buffer does. */
function Mark() {
  const attach = useSurfaceTile('mark');
  const id = useTileId('mark');
  const surface = useSurface();
  const canvas = useSurfaceCanvas('over');
  useEffect(
    () =>
      surface.registerPainter(id, (rect, frame) => {
        if (!canvas) return;
        const gl = canvasGl(canvas);
        const v = toDeviceRect(rect, frame.size.height, frame.dpr);
        const px = (n: number) => Math.round(n * frame.dpr);
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(px(v.x), px(v.y), px(v.w), px(v.h));
        gl.clearColor(1, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.disable(gl.SCISSOR_TEST);
      }),
    [surface, id, canvas],
  );
  return <div className="lk-lens-test-mark" ref={attach} />;
}

const Story = defineInstrument<Record<string, never>, Record<string, never>>({
  name: 'Story',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => (
    <div className="lk-lens-test-floor" onWheel={(e) => wheels.push(e.deltaY)}>
      <button type="button" className="lk-lens-test-under" onClick={() => clicks++}>
        Under
      </button>
      <Mark />
    </div>
  ),
});

const BODY_AT = { x: 560, y: 260 };
const RETICLE_AT = { x: 300, y: 260 };

afterEach(async () => {
  await commands.pointer([{ up: true }]);
  cleanup();
});
beforeEach(async () => {
  await page.viewport(1000, 700);
  clicks = 0;
  wheels = [];
  scene = createLensScene<string>();
  sceneToAdapter(scene).applyOps(
    addLensOps(scene, 'a', { body: BODY_AT, reticle: RETICLE_AT }),
    'add',
  );
});

const pose = (id: string): RectPose => effectivePose(scene, scene.get(id as never) as never);

/** A lab-body point in client px. */
function client(p: { x: number; y: number }): [number, number] {
  const body = (document.querySelector('.lk-lab__body') as HTMLElement).getBoundingClientRect();
  return [body.left + p.x, body.top + p.y];
}

async function mount(props: Partial<LensOverlayProps<string>> = {}): Promise<HTMLElement> {
  renderWithIcons(
    <div className="lk-lens-test-host">
      <Lab
        instruments={[Story]}
        defaultInstrument="Story"
        labChrome={[
          {
            id: 'loupe',
            region: 'overlay',
            render: () => <LensOverlay scene={scene} {...props} />,
          },
        ]}
      />
    </div>,
  );
  await screen.findByRole('button', { name: 'Under' });
  return waitFor(() => {
    const hits = document.querySelectorAll('.lk-lens-hit');
    if (hits.length !== 2) throw new Error('the hit boxes have not mounted');
    return document.querySelector('.lk-lens-input') as HTMLElement;
  });
}

/** A press and release with the browser's own pointer. */
async function click(p: { x: number; y: number }): Promise<void> {
  await commands.pointer([{ to: client(p) }, { down: true }, { up: true }]);
}

/** Whether any top-buffer pixel along a short horizontal run, at viewport
 *  px, has been painted. */
function topPaintedNear(x: number, y: number): boolean {
  const canvas = document.querySelector('.lk-lab__surface--top') as HTMLCanvasElement;
  const box = canvas.getBoundingClientRect();
  const dpr = canvas.width / box.width;
  const gx = Math.round((x - 4 - box.left) * dpr);
  const gy = Math.round((y - box.top) * dpr);
  const px = readCanvas(canvas, gx, gy, Math.round(8 * dpr), 1);
  for (let i = 3; i < px.length; i += 4) if ((px[i] ?? 0) > 0) return true;
  return false;
}

/** The RGBA of one over-buffer pixel at a viewport point. */
function overPixelAt(x: number, y: number): number[] {
  const canvas = document.querySelector('.lk-lab__layer--over canvas') as HTMLCanvasElement;
  const box = canvas.getBoundingClientRect();
  const dpr = canvas.width / box.width;
  return Array.from(
    readCanvas(canvas, Math.round((x - box.left) * dpr), Math.round((y - box.top) * dpr), 1, 1),
  );
}

test('lets a press that misses every lens reach the story underneath', async () => {
  const input = await mount();
  const under = screen.getByRole('button', { name: 'Under' }).getBoundingClientRect();
  // The lens layer is over the button, and still the button is what is hit.
  expect(input.getBoundingClientRect().width).toBeGreaterThan(under.right);
  await userEvent.click(screen.getByRole('button', { name: 'Under' }));
  expect(clicks).toBe(1);
});

test('drags a body with core’s move, leaving the pinned reticle where it was', async () => {
  await mount();
  const before = pose('a:body');
  const reticleBefore = pose('a:reticle');
  const [x, y] = client(BODY_AT);
  const steps = Array.from({ length: 8 }, (_, i) => ({
    to: [x + (40 * (i + 1)) / 8, y] as [number, number],
  }));
  await commands.pointer([{ to: [x, y] }, { down: true }, ...steps, { up: true }]);
  await waitFor(() => expect(pose('a:body').x).toBe(before.x + 40));
  expect(pose('a:body').y).toBe(before.y);
  expect(pose('a:reticle')).toEqual(reticleBefore);
});

test('undoes the drag with the lens focused', async () => {
  const input = await mount();
  const before = pose('a:body');
  const [x, y] = client(BODY_AT);
  await commands.pointer([
    { to: [x, y] },
    { down: true },
    { to: [x + 20, y] },
    { to: [x + 40, y] },
    { up: true },
  ]);
  await waitFor(() => expect(pose('a:body').x).toBe(before.x + 40));
  // The press on a hit box focused the input element around it.
  expect(document.activeElement).toBe(input);
  await userEvent.keyboard('{Meta>}z{/Meta}');
  await waitFor(() => expect(pose('a:body')).toEqual(before));
});

test('deletes the whole lens when only its reticle is selected', async () => {
  await mount();
  await click(RETICLE_AT);
  await waitFor(() => expect(scene.getSelection()).toEqual(['a:reticle']));
  await userEvent.keyboard('{Backspace}');
  await waitFor(() => expect(lensesOf(scene)).toEqual([]));
  expect(scene.nodes.size).toBe(0);
});

test('reports the lens a press focuses, and renders an interior over each body', async () => {
  const focused: (string | null)[] = [];
  await mount({
    onFocusLens: (id) => focused.push(id),
    children: (lens) => <span data-testid={`inside-${lens.lensId}`} />,
  });
  const interior = screen.getByTestId('inside-a').parentElement as HTMLElement;
  expect(interior.classList.contains('lk-lens-interior')).toBe(true);
  const r = interior.getBoundingClientRect();
  const [cx, cy] = client(BODY_AT);
  expect(r.left + r.width / 2).toBeCloseTo(cx, 0);
  expect(r.top + r.height / 2).toBeCloseTo(cy, 0);
  expect(r.width).toBeCloseTo(BODY_SIZE, 0);

  await click(RETICLE_AT);
  await waitFor(() => expect(focused.at(-1)).toBe('a'));
});

test('keeps painting lenses, in a buffer of their own, while a trial is expanded', {
  timeout: 30_000,
}, async () => {
  await mount();
  const rim = (): [number, number] => client({ x: BODY_AT.x + BODY_SIZE / 2, y: BODY_AT.y });
  await waitFor(() => expect(topPaintedNear(...rim())).toBe(true), { timeout: 5000 });

  await userEvent.click(screen.getByRole('button', { name: 'Expand trial' }));
  const box = document.querySelector('.lk-lightbox') as HTMLElement;
  expect(box.matches(':popover-open')).toBe(true);
  // Lifted with the over layer, the lens layer covers the window, and the
  // lens stays where it is in lab-body px against it.
  const layer = document.querySelector('.lk-lens-layer') as HTMLElement;
  await waitFor(() =>
    expect(layer.getBoundingClientRect().width).toBeCloseTo(window.innerWidth, 0),
  );
  // The buffer follows on the surface's next frame, and resizing it clears
  // it: a read before then would find the picture painted before the expand.
  const canvas = document.querySelector('.lk-lab__surface--top') as HTMLCanvasElement;
  await waitFor(() =>
    expect(canvas.width).toBe(Math.round(window.innerWidth * window.devicePixelRatio)),
  );
  const at = (): [number, number] => {
    const l = layer.getBoundingClientRect();
    return [l.left + BODY_AT.x + BODY_SIZE / 2, l.top + BODY_AT.y];
  };
  await waitFor(() => expect(topPaintedNear(...at())).toBe(true), { timeout: 5000 });
  await userEvent.keyboard('{Escape}');
});

test('leaves a co-tenant’s mark in the over buffer while a lens is dragged', async () => {
  await mount();
  const mark = (
    document.querySelector('.lk-lens-test-mark') as HTMLElement
  ).getBoundingClientRect();
  const mx = mark.left + mark.width / 2;
  const my = mark.top + mark.height / 2;
  await waitFor(() => expect(overPixelAt(mx, my)).toEqual([255, 0, 0, 255]));
  const before = pose('a:body');
  const [x, y] = client(BODY_AT);
  await commands.pointer([
    { to: [x, y] },
    { down: true },
    { to: [x + 20, y] },
    { to: [x + 40, y] },
    { up: true },
  ]);
  await waitFor(() => expect(pose('a:body').x).toBe(before.x + 40));
  // Several frames for the lens to repaint into whatever buffer it owns.
  for (let i = 0; i < 4; i++) await new Promise((r) => requestAnimationFrame(r));
  expect(overPixelAt(mx, my)).toEqual([255, 0, 0, 255]);
});

test('resizes a selected round body from a corner handle with core’s transform', async () => {
  await mount();
  await click(BODY_AT);
  await waitFor(() => expect(scene.getSelection()).toEqual(['a:body']));
  const before = pose('a:body');
  // The bounding box's bottom-right corner, outside the round body itself.
  const [x, y] = client({ x: before.x + before.width, y: before.y + before.height });
  await commands.pointer([
    { to: [x, y] },
    { down: true },
    { to: [x + 15, y + 15] },
    { to: [x + 30, y + 30] },
    { up: true },
  ]);
  await waitFor(() => expect(pose('a:body').width).toBeGreaterThan(BODY_SIZE + 10));
});

test('hands a wheel over a lens to whatever is beneath it', async () => {
  await mount();
  const [x, y] = client(BODY_AT);
  const floor = (
    document.querySelector('.lk-lens-test-floor') as HTMLElement
  ).getBoundingClientRect();
  // The premise: the floor spans the point under the lens's center.
  expect(x).toBeLessThan(floor.right);
  expect(y).toBeLessThan(floor.bottom);
  expect((document.elementFromPoint(x, y) as HTMLElement).classList.contains('lk-lens-hit')).toBe(
    true,
  );
  await commands.pointer([{ to: [x, y] }, { wheel: [0, 120] }]);
  await waitFor(() => expect(wheels).toEqual([120]));
});
