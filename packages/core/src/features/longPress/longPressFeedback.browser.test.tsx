/**
 * The default long-press ring, as pixels: a synthetic touch held on a real
 * `<SceneCanvas>` paints accent around the press point partway through the
 * hold — and paints nothing when no binding would fire on the press.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { page } from 'vitest/browser';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { SceneCanvas } from '../../canvas/SceneCanvas';
import { createScene } from 'core/scene/scene';
import type { SurfaceContribution } from '../../canvas/surfaceContribution';
import { FALLBACK_ACCENT } from '../../canvas/accentColor';

const W = 320;
const H = 240;
const PRESS = { x: 160, y: 120 };
const RADIUS = 22;
/** Long enough that the press cannot fire, and the ring go, before the capture lands. */
const DURATION = 5000;
const EDGE = 6;

const bound: SurfaceContribution = {
  id: 'bound',
  eligibility: { always: true },
  actions: [{ id: 'test.hold', label: 'hold', invoker: { timing: 'immediate', run: () => {} } }],
  bindings: [{ spec: { kind: 'longPress' }, actionId: 'test.hold' }],
};

let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => {
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
});

async function holdAndCapture(ambient: SurfaceContribution[], holdMs: number) {
  host = document.createElement('div');
  host.style.width = `${W}px`;
  host.style.height = `${H}px`;
  document.body.appendChild(host);
  root = createRoot(host);
  const scene = createScene<unknown, 'main', unknown>({ systemLayers: [{ id: 'main' }] });
  flushSync(() => root!.render(createElement(SceneCanvas, {
    scene, layers: {}, width: W, height: H, ambient, longPress: { duration: DURATION },
  } as never)));
  await new Promise((r) => setTimeout(r, 100));
  const canvas = host.querySelector('canvas')!;
  const rect = canvas.getBoundingClientRect();
  canvas.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true, pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1,
    clientX: rect.left + PRESS.x, clientY: rect.top + PRESS.y,
  }));
  await new Promise((r) => setTimeout(r, holdMs));
  const base64 = await page.screenshot({ element: canvas, save: false });
  const img = new Image();
  img.src = `data:image/png;base64,${base64}`;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  return { data: ctx.getImageData(0, 0, c.width, c.height), dpr: img.naturalWidth / W };
}

/** Accent-colored pixels inside the ring's annulus, and away from it. */
function accentPixels(img: ImageData, dpr: number): { ring: number; elsewhere: number } {
  const hex = FALLBACK_ACCENT.slice(1);
  const [ar, ag, ab] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  let ring = 0;
  let elsewhere = 0;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      const d = Math.abs(img.data[i] - ar) + Math.abs(img.data[i + 1] - ag) + Math.abs(img.data[i + 2] - ab);
      if (d > 60) continue;
      const r = Math.hypot(x / dpr - PRESS.x, y / dpr - PRESS.y);
      if (Math.abs(r - RADIUS) <= 4) ring++;
      // The canvas's own focus ring runs along its edge; that is not the ring.
      else if (x / dpr > EDGE && y / dpr > EDGE && x / dpr < W - EDGE && y / dpr < H - EDGE) elsewhere++;
    }
  }
  return { ring, elsewhere };
}

describe('long-press feedback ring', () => {
  it('paints an accent ring around a touch held mid-progress', async () => {
    const { data, dpr } = await holdAndCapture([bound], 1000);
    const px = accentPixels(data, dpr);
    expect(px.ring).toBeGreaterThan(40);
    expect(px.elsewhere).toBe(0);
  });

  it('paints nothing when no binding would fire on the press', async () => {
    const { data, dpr } = await holdAndCapture([], 1000);
    expect(accentPixels(data, dpr).ring).toBe(0);
  });
});
