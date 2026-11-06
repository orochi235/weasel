/**
 * A shape-following selection outline, read back as pixels: it hugs an
 * ellipse's curve and leaves the corners of its box empty, at the width it
 * asks for in screen pixels however far the view is zoomed.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { page } from 'vitest/browser';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { SceneCanvas, createScene, asNodeId, type RectPose, useSelection } from '@weasel-js/core';

const W = 340;
const H = 200;
const ID = asNodeId('n');
// An ellipse centered on (170, 100), 110 across and 60 high on each side.
const POSE: RectPose = { x: 60, y: 40, width: 220, height: 120 };

type Kind = 'ground' | 'body' | 'chrome';

async function shoot(el: HTMLElement): Promise<(x: number, y: number) => Kind> {
  const img = new Image();
  img.src = `data:image/png;base64,${await page.screenshot({ element: el, save: false })}`;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const dpr = img.naturalWidth / W;
  const { data, width } = ctx.getImageData(0, 0, c.width, c.height);
  return (x, y) => {
    const i = (Math.floor((y + 0.5) * dpr) * width + Math.floor((x + 0.5) * dpr)) * 4;
    if (data[i + 1] > 96) return 'chrome';
    return data[i] > 96 ? 'body' : 'ground';
  };
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
});

async function mount(zoom: number) {
  const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.add({ id: ID, kind: 'mark', layer: 'main', data: { shape: 'ellipse', fill: { paint: { kind: 'solid', color: '#ff0000' } } }, pose: POSE });
  function Stage() {
    const selection = useSelection({ scene, mode: 'single', initial: [ID] });
    return createElement(SceneCanvas<object, 'main', RectPose>, {
      scene,
      selection,
      features: ['outline'],
      width: W,
      height: H,
      // Zoomed about the ellipse's center.
      view: { x: 170 - 170 / zoom, y: 100 - 100 / zoom, scale: { x: zoom, y: zoom } },
      layers: {
        selectionOverlay: {
          handles: false,
          outline: { paint: { kind: 'solid', color: '#00ff00' }, width: 3, follow: 'shape' },
        },
      },
    } as never);
  }
  host = document.createElement('div');
  Object.assign(host.style, {
    position: 'fixed', left: '0px', top: '0px', width: `${W}px`, height: `${H}px`, background: '#000',
  });
  document.body.style.margin = '0';
  document.body.appendChild(host);
  root = createRoot(host);
  flushSync(() => root!.render(createElement(Stage)));
  let at = await shoot(host);
  for (let i = 0; i < 40 && at(170, 100 - 60 * zoom - 2) !== 'chrome'; i++) {
    await new Promise((r) => setTimeout(r, 50));
    at = await shoot(host);
  }
  return at;
}

describe("selection outline with follow: 'shape', in pixels", () => {
  it('traces the curve and leaves the box corners empty', async () => {
    const at = await mount(1);
    expect(at(170, 100)).toBe('body');
    // On the curve's extremes, just outside it.
    expect(at(170, 38)).toBe('chrome');
    expect(at(170, 161)).toBe('chrome');
    expect(at(58, 100)).toBe('chrome');
    expect(at(281, 100)).toBe('chrome');
    // A box outline would pass through here; the ellipse is far inside.
    expect(at(60, 40)).toBe('ground');
    expect(at(279, 159)).toBe('ground');
  });

  it('keeps its screen width when the view zooms', async () => {
    const at = await mount(0.5);
    // Top of the ellipse at y = 100 - 30 = 70: a 3px band above it, and no more.
    expect(at(170, 68)).toBe('chrome');
    expect(at(170, 64)).toBe('ground');
  });
});
