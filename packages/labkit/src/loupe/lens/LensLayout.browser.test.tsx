import '@weasel-js/theme/tokens.css';
import 'windease/styles.css';
import '../../styles.less';
import './LensOverlay.browser.test.less';
import { cleanup, waitFor } from '@testing-library/react';
import { sceneToAdapter } from '@weasel-js/core';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { defineInstrument } from '../../instrument/defineInstrument';
import { Lab } from '../../lab/Lab';
import { LensOverlay } from './LensOverlay';
import { HANDLE_SLOP } from './lensHitBoxes';
import { addLensOps, createLensScene, setLensOps } from './lensScene';
import type { LensSource } from './lensSource';
import type { LensScene } from './lensTypes';

// Whether a round lens shows anything outside its rim, and where its chrome
// sits, are layout and compositing: a real browser's, read off a screenshot.

let scene: LensScene<string>;

const Story = defineInstrument<Record<string, never>, Record<string, never>>({
  name: 'Story',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => <div className="lk-lens-test-floor" />,
});

/** Fills each cell with solid red, so any of it showing is easy to find. */
const red: LensSource<string> = {
  kind: 'live',
  produces: 'dom',
  label: () => 'Live',
  status: () => true,
  subscribe: () => () => {},
  attach: (slot) => {
    const fill = document.createElement('div');
    fill.className = 'lk-lens-test-red';
    slot.append(fill);
    return { update: () => {}, detach: () => fill.remove() };
  },
};

afterEach(() => cleanup());
beforeEach(async () => {
  await page.viewport(1000, 700);
  scene = createLensScene<string>();
  sceneToAdapter(scene).applyOps(
    addLensOps(scene, 'a', { body: { x: 560, y: 240 }, reticle: { x: 300, y: 260 } }),
    'add',
  );
});

async function mount(readouts?: () => ReactNode): Promise<HTMLElement> {
  renderWithIcons(
    <div className="lk-lens-test-host">
      <Lab
        instruments={[Story]}
        defaultInstrument="Story"
        labChrome={[
          {
            id: 'loupe',
            region: 'overlay',
            render: () => (
              <LensOverlay
                scene={scene}
                sources={{ live: red }}
                {...(readouts ? { renderReadouts: readouts } : {})}
              />
            ),
          },
        ]}
      />
    </div>,
  );
  return waitFor(() => {
    const interior = document.querySelector<HTMLElement>('.lk-lens-interior');
    if (!interior?.querySelector('.lk-lens-test-red')) throw new Error('the lens has not mounted');
    return interior;
  });
}

async function decodePng(base64: string): Promise<ImageData> {
  const img = new Image();
  img.src = `data:image/png;base64,${base64}`;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, c.width, c.height);
}

const isRed = (img: ImageData, x: number, y: number) => {
  const i = (Math.round(y) * img.width + Math.round(x)) * 4;
  return img.data[i]! > 200 && img.data[i + 1]! < 60 && img.data[i + 2]! < 60;
};

test('clips a round lens’s interior to its circle', async () => {
  const interior = await mount();
  const img = await decodePng(await page.screenshot({ element: interior, save: false }));
  const s = img.width / interior.getBoundingClientRect().width;
  // Just inside the corner of the rim's bounding box, which lies outside the circle.
  expect(isRed(img, 4 * s, 4 * s)).toBe(false);
  expect(isRed(img, img.width / 2, img.height / 2)).toBe(true);
});

test('keeps the chrome within the body’s width, below the reach of its handles', async () => {
  // A comparison shows every toggle the chrome has.
  sceneToAdapter(scene).applyOps(setLensOps(scene, 'a', { compare: 'b', view: 'split' }), 'split');
  const interior = await mount();
  const chrome = interior.querySelector<HTMLElement>('.lk-lens-chrome')!;
  await waitFor(() => expect(chrome.querySelectorAll('button')).toHaveLength(8));
  const body = interior.getBoundingClientRect();
  const strip = chrome.getBoundingClientRect();
  expect(strip.left).toBeGreaterThanOrEqual(body.left - 0.5);
  expect(strip.right).toBeLessThanOrEqual(body.right + 0.5);
  expect(strip.top).toBeCloseTo(body.bottom + HANDLE_SLOP, 0);
  for (const button of chrome.querySelectorAll('button')) {
    const r = button.getBoundingClientRect();
    expect(r.left).toBeGreaterThanOrEqual(body.left - 0.5);
    expect(r.right).toBeLessThanOrEqual(body.right + 0.5);
  }
});

test('keeps a readout inside a round lens’s circle, however long its text', async () => {
  sceneToAdapter(scene).applyOps(setLensOps(scene, 'a', { readouts: ['contrast'] }), 'readout');
  const interior = await mount(() => (
    <span>12.34:1 · AA pass · AAA pass · large text · and more besides</span>
  ));
  const readout = await waitFor(() => {
    const el = interior.querySelector<HTMLElement>('.lk-lens-readouts');
    if (!el?.textContent) throw new Error('no readout');
    return el;
  });
  const body = interior.getBoundingClientRect();
  const r = readout.getBoundingClientRect();
  const cx = body.left + body.width / 2;
  const cy = body.top + body.height / 2;
  for (const [x, y] of [
    [r.left, r.top],
    [r.right, r.top],
    [r.left, r.bottom],
    [r.right, r.bottom],
  ] as const) {
    expect(Math.hypot(x - cx, y - cy)).toBeLessThanOrEqual(body.width / 2 + 0.5);
  }
});
