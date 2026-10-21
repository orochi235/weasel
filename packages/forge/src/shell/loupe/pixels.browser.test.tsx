import './loupe.css';
import './pixels.browser.test.css';
import type { LensSourceRequest } from '@weasel-js/labkit/loupe';
import { afterEach, expect, it } from 'vitest';
import type { CapturePayload } from '../../vite/capture/payload';
import type { ForgeComparison } from './conditions';
import { createPixelsSource } from './pixelsSource';

// Drawing a capture into the lens is canvas pixels: a real browser's. The capture itself is not taken here: the
// browser project has no dev server with Playwright behind it, so `fetch` answers with a PNG this test paints, and the
// real capture path rests on the endpoint's own run (Task 8, Step 5).

const SIDE = 40;
const LINE_X = 20;

/** A white square with a black 1 px vertical hairline at x = 20, as a PNG. */
async function hairline(): Promise<Blob> {
  const canvas = new OffscreenCanvas(SIDE, SIDE);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, SIDE, SIDE);
  ctx.fillStyle = '#000';
  ctx.fillRect(LINE_X, 0, 1, SIDE);
  return canvas.convertToBlob({ type: 'image/png' });
}

afterEach(() => {
  document.body.replaceChildren();
});

it('enlarges real pixels nearest-neighbor: a 1px hairline at 8× is an 8px band with hard edges', async () => {
  const png = await hairline();
  const host = document.createElement('div');
  host.dataset.fgHost = 'trial-a';
  host.className = 'fg-pixels-test-host';
  const slot = document.createElement('div');
  slot.className = 'fg-pixels-test-slot';
  document.body.append(host, slot);
  host.getBoundingClientRect();

  const payload: CapturePayload = {
    story: 'ui-a--b',
    isolate: false,
    config: {},
    state: null,
    globals: {},
    overrides: {},
    playhead: null,
    box: { width: SIDE, height: SIDE },
    layout: 'padded',
    dpr: 1,
    scroll: { left: 0, top: 0 },
    lab: { globals: {}, mode: 'light' },
    colorScheme: 'light',
  };
  const fetch = (async (_url: string, init?: RequestInit) =>
    init?.method === 'POST'
      ? new Response(png, { headers: { 'Content-Type': 'image/png' } })
      : Response.json({ available: true })) as typeof globalThis.fetch;
  const source = createPixelsSource({ base: '/', payloadFor: () => payload, fetch, revision: () => 0, subscribeRevision: () => () => {} });

  const rect = host.getBoundingClientRect();
  const request: LensSourceRequest<ForgeComparison> = {
    lensId: 'lens-0',
    // The middle of the hairline's column, halfway down.
    reticle: { x: rect.left + LINE_X + 0.5, y: rect.top + SIDE / 2 },
    factor: 8,
    size: { width: 160, height: 160 },
    conditions: null,
    dpr: 1,
  };
  const handle = source.attach(slot, request);
  const canvas = slot.querySelector('canvas')!;
  await expect.poll(() => canvas.hasAttribute('data-shown')).toBe(true);

  const scale = canvas.width / 160;
  const row = canvas.getContext('2d')!.getImageData(0, Math.floor(canvas.height / 2), canvas.width, 1).data;
  const reds = Array.from({ length: canvas.width }, (_, x) => row[x * 4]!);
  // Hard edges: every pixel is the line's black or the ground's white, nothing blended between.
  expect(new Set(reds)).toEqual(new Set([0, 255]));
  const dark = reds.flatMap((r, x) => (r === 0 ? [x] : []));
  expect(dark).toHaveLength(8 * scale);
  // One band, centered on the reticle.
  expect(dark.at(-1)! - dark[0]! + 1).toBe(8 * scale);
  expect(dark[0]).toBe(canvas.width / 2 - 4 * scale);
  handle.detach();
});
