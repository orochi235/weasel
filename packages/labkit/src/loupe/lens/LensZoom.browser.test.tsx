import '@weasel-js/theme/tokens.css';
import '@weasel-js/theme/fonts.css';
import 'windease/styles.css';
import '../../styles.less';
import './LensOverlay.browser.test.less';
import { cleanup, screen, waitFor } from '@testing-library/react';
import { createTransformOp, effectivePose, type RectPose, sceneToAdapter } from '@weasel-js/core';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { commands, page, userEvent } from 'vitest/browser';
import { defineInstrument } from '../../instrument/defineInstrument';
import { Lab } from '../../lab/Lab';
import { LensOverlay } from './LensOverlay';
import { addLensOps, createLensScene, setLensOps, settingsOf } from './lensScene';
import type { LensSource } from './lensSource';
import type { LensScene } from './lensTypes';

// Where the zoom lies on the rim, and whether a press on it reaches the slider or the body beneath it, are layout and
// hit-testing: a real browser's, with a real pointer.

let scene: LensScene<string>;

const Story = defineInstrument<Record<string, never>, Record<string, never>>({
  name: 'Story',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => <div className="lk-lens-test-floor" />,
});

const blank: LensSource<string> = {
  kind: 'live',
  produces: 'dom',
  label: () => 'Live',
  status: () => true,
  subscribe: () => () => {},
  attach: () => ({ update: () => {}, detach: () => {} }),
};

afterEach(async () => {
  await commands.pointer([{ up: true }]);
  cleanup();
});
beforeEach(async () => {
  await page.viewport(1000, 700);
  scene = createLensScene<string>();
  sceneToAdapter(scene).applyOps(
    addLensOps(scene, 'a', { body: { x: 560, y: 260 }, reticle: { x: 300, y: 260 } }),
    'add',
  );
});

const pose = (id: string): RectPose => effectivePose(scene, scene.get(id as never) as never);
const frame = () => new Promise((r) => requestAnimationFrame(r));
const mid = (el: Element) => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

async function mount(): Promise<HTMLElement> {
  renderWithIcons(
    <div className="lk-lens-test-host">
      <Lab
        instruments={[Story]}
        defaultInstrument="Story"
        labChrome={[
          {
            id: 'loupe',
            region: 'overlay',
            render: () => <LensOverlay scene={scene} sources={{ live: blank }} />,
          },
        ]}
      />
    </div>,
  );
  const zoom = await waitFor(() => {
    const el = document.querySelector<HTMLElement>('.lk-lens-zoom');
    if (!el?.querySelector('[data-slider-tick]')) throw new Error('the zoom has not mounted');
    return el;
  });
  await document.fonts.ready;
  for (let i = 0; i < 4; i++) await frame();
  return zoom;
}

const ticks = (zoom: HTMLElement) => [...zoom.querySelectorAll<HTMLElement>('[data-slider-tick]')];
/** The interior's box in client px. */
const body = () =>
  document.querySelector<HTMLElement>('.lk-lens-interior')!.getBoundingClientRect();

/** A drag with the browser's own pointer from `from` to `to`, in steps. */
async function drag(from: { x: number; y: number }, to: { x: number; y: number }) {
  const steps = Array.from({ length: 10 }, (_, i) => ({
    to: [from.x + ((to.x - from.x) * (i + 1)) / 10, from.y + ((to.y - from.y) * (i + 1)) / 10] as [
      number,
      number,
    ],
  }));
  await commands.pointer([{ to: [from.x, from.y] }, { down: true }, ...steps, { up: true }]);
}

test('stops at every power of two from 1× to 64×, labeled, on the bottom of the rim', async () => {
  const zoom = await mount();
  const labels = [...zoom.querySelectorAll('[data-slider-tick]')].length;
  expect(labels).toBe(7);
  expect(zoom.textContent).toContain('1×');
  expect(zoom.textContent).toContain('64×');
  const b = body();
  for (const t of ticks(zoom)) expect(mid(t).y).toBeGreaterThan(b.top + b.height / 2);
  const thumb = screen.getByRole('slider', { name: 'Zoom' });
  expect(thumb.getAttribute('aria-valuetext')).toBe('4×');
});

test('dragging the thumb sets the factor and resizes the reticle with it, as one undo entry', async () => {
  const zoom = await mount();
  const thumb = screen.getByRole('slider', { name: 'Zoom' });
  // Stops 1, 2, 4, 8, 16, …: the fifth is 16×.
  await drag(mid(thumb), mid(ticks(zoom)[4]!));
  await waitFor(() => expect(settingsOf(scene, 'a')?.factor).toBe(16));
  const lens = pose('a:body');
  expect(pose('a:reticle')).toMatchObject({ width: lens.width / 16, height: lens.height / 16 });
  scene.history.undo();
  expect(settingsOf(scene, 'a')?.factor).toBe(4);
  expect(pose('a:reticle').width).toBe(lens.width / 4);
});

test('a drag on the zoom hands focus back to the lenses, so the undo key answers at once', async () => {
  const zoom = await mount();
  const thumb = screen.getByRole('slider', { name: 'Zoom' });
  await drag(mid(thumb), mid(ticks(zoom)[4]!));
  await waitFor(() => expect(settingsOf(scene, 'a')?.factor).toBe(16));
  expect(document.activeElement).toBe(document.querySelector('.lk-lens-input'));
  await userEvent.keyboard('{ControlOrMeta>}z{/ControlOrMeta}');
  await waitFor(() => expect(settingsOf(scene, 'a')?.factor).toBe(4));
});

test('the arrow keys on a focused zoom thumb leave focus on it', async () => {
  await mount();
  const thumb = screen.getByRole('slider', { name: 'Zoom' });
  thumb.focus();
  await userEvent.keyboard('{ArrowRight}');
  await waitFor(() => expect(settingsOf(scene, 'a')?.factor).toBe(8));
  expect(document.activeElement).toBe(thumb);
});

test('a press on the zoom moves and selects nothing, and a press beside it still moves the body', async () => {
  const zoom = await mount();
  const before = pose('a:body');
  const thumb = screen.getByRole('slider', { name: 'Zoom' });
  const at = mid(thumb);
  expect(thumb.contains(document.elementFromPoint(at.x, at.y))).toBe(true);
  await drag(at, { x: at.x, y: at.y - 30 });
  for (let i = 0; i < 4; i++) await frame();
  expect(pose('a:body')).toEqual(before);
  expect(scene.getSelection()).toEqual([]);
  // The band between two ticks takes its press too.
  const [t0, t1] = ticks(zoom);
  const between = { x: (mid(t0!).x + mid(t1!).x) / 2, y: (mid(t0!).y + mid(t1!).y) / 2 };
  await commands.pointer([{ to: [between.x, between.y] }, { down: true }, { up: true }]);
  expect(pose('a:body')).toEqual(before);
  expect(scene.getSelection()).toEqual([]);
  // Up in the body, clear of the zoom, the body's move answers as before.
  const b = body();
  await drag(
    { x: b.left + b.width / 2, y: b.top + 30 },
    { x: b.left + b.width / 2 + 40, y: b.top + 30 },
  );
  await waitFor(() => expect(pose('a:body').x).toBe(before.x + 40));
});

/** How far each tick's center lies off the ellipse of the given radii about the body's center, at most. */
function offEllipse(zoom: HTMLElement, rx: number, ry: number): number {
  const b = body();
  const cx = b.left + b.width / 2;
  const cy = b.top + b.height / 2;
  return Math.max(
    ...ticks(zoom).map((t) => {
      const p = mid(t);
      return Math.abs(Math.hypot((p.x - cx) / rx, (p.y - cy) / ry) - 1) * Math.min(rx, ry);
    }),
  );
}

test('a round body’s zoom lies on an arc inside its rim', async () => {
  const zoom = await mount();
  const root = zoom.querySelector<HTMLElement>('[data-shape]')!;
  expect(root.dataset.shape).toBe('arc');
  const b = body();
  const ys = ticks(zoom).map((t) => mid(t).y);
  // An arc: the middle stop sits lowest, the ends highest.
  expect(Math.max(...ys)).toBe(ys[3]);
  const r = Math.hypot(mid(ticks(zoom)[3]!).y - (b.top + b.height / 2), 0);
  expect(r).toBeLessThan(b.width / 2);
  expect(offEllipse(zoom, r, r)).toBeLessThan(1);
});

test('a body stretched into an ellipse gets an elliptical track', async () => {
  const from = pose('a:body');
  const to = { ...from, x: from.x - 60, width: from.width + 120 };
  sceneToAdapter(scene).applyOps(
    [createTransformOp({ id: 'a:body' as never, from, to, label: 'stretch' })],
    'stretch',
  );
  const zoom = await mount();
  const root = zoom.querySelector<HTMLElement>('[data-shape]')!;
  expect(root.dataset.shape).toBe('ellipse');
  const b = body();
  const inset = b.height / 2 - (mid(ticks(zoom)[3]!).y - (b.top + b.height / 2));
  expect(offEllipse(zoom, b.width / 2 - inset, b.height / 2 - inset)).toBeLessThan(1);
});

test('a square body’s zoom runs straight along its bottom edge', async () => {
  sceneToAdapter(scene).applyOps(setLensOps(scene, 'a', { shape: 'square' }), 'square');
  const zoom = await mount();
  expect(zoom.querySelector<HTMLElement>('[data-shape]')?.dataset.shape).toBe('line');
  const b = body();
  const ys = ticks(zoom).map((t) => mid(t).y);
  for (const y of ys) expect(y).toBeCloseTo(ys[0]!, 0);
  expect(ys[0]!).toBeGreaterThan(b.top + b.height * 0.75);
  expect(ys[0]!).toBeLessThan(b.bottom);
  const xs = ticks(zoom).map((t) => mid(t).x);
  expect(xs[0]!).toBeGreaterThan(b.left);
  expect(xs.at(-1)!).toBeLessThan(b.right);
});

test.each(['round', 'square'] as const)(
  'a %s body’s zoom labels stand apart at the default size',
  async (shape) => {
    if (shape !== 'round') sceneToAdapter(scene).applyOps(setLensOps(scene, 'a', { shape }), shape);
    const zoom = await mount();
    const rects = [...zoom.querySelectorAll('[data-slider-stop-label]')].map((e) =>
      e.getBoundingClientRect(),
    );
    const gaps = rects.slice(1).map((r, i) => {
      const p = rects[i]!;
      return Math.max(r.left - p.right, p.left - r.right, r.top - p.bottom, p.top - r.bottom);
    });
    for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(4);
  },
);
