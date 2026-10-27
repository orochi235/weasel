/**
 * Selection chrome on a skewed node, read back as pixels: the outline and
 * the resize handles land on the shape the renderer drew, not on the box the
 * pose stores. A command-list test cannot say this, because it never sees
 * where the node itself was painted.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { page } from 'vitest/browser';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { DrawCommand } from '@weasel-js/renderer';
import { SceneCanvas } from '../../canvas/SceneCanvas';
import { createScene } from '../../core/scene/scene';
import { asNodeId, type Node, type RectPose } from '../../core/scene/types';
import { useSelection } from '../../core/selection/useSelection';

const W = 340;
const H = 200;
const ID = asNodeId('n');
// Center (160, 100); the skew moves a row by half its distance below the
// center, so the top edge sits 20px left of the stored box and the bottom
// edge 20px right. Drawn corners: (60,60) (220,60) (260,140) (100,140).
const POSE: RectPose = { x: 80, y: 60, width: 160, height: 80, transform: [1, 0, 0.5, 1] };
const DRAWN = { tl: [60, 60], tr: [220, 60], br: [260, 140], bl: [100, 140] } as const;
const STORED = { tl: [80, 60], tr: [240, 60], br: [240, 140], bl: [80, 140] } as const;

type Kind = 'ground' | 'body' | 'chrome';

interface Shot { at(x: number, y: number): Kind }

async function shoot(host: HTMLElement): Promise<Shot> {
  const img = new Image();
  img.src = `data:image/png;base64,${await page.screenshot({ element: host, save: false })}`;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const dpr = img.naturalWidth / W;
  const { data, width } = ctx.getImageData(0, 0, c.width, c.height);
  return {
    at(x, y) {
      const i = (Math.floor((y + 0.5) * dpr) * width + Math.floor((x + 0.5) * dpr)) * 4;
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      // By green, which the red body has none of at any coverage: a
      // half-covered pixel on its slanted edge is dim red, not chrome.
      if (g > 96) return 'chrome';
      return r > 96 && b < 64 ? 'body' : 'ground';
    },
  };
}

function Stage() {
  const scene = sceneRef!;
  const selection = useSelection({ scene, mode: 'single', initial: [ID] });
  return createElement(SceneCanvas<object, 'main', RectPose>, {
    scene,
    selection,
    features: ['outline', 'resize'],
    width: W,
    height: H,
    layers: {
      scene: {
        drawOne: (_n: Node<object, 'main', RectPose>, p: RectPose): DrawCommand[] => [{
          kind: 'path',
          path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
          fill: { paint: { kind: 'solid', color: '#ff0000' } },
        }],
      },
    },
  });
}

let sceneRef: ReturnType<typeof createScene<object, 'main', RectPose>> | null = null;
let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
  sceneRef = null;
});

async function mount(): Promise<Shot> {
  sceneRef = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  sceneRef.add({ id: ID, kind: 'mark', layer: 'main', data: {}, pose: POSE });
  host = document.createElement('div');
  Object.assign(host.style, {
    position: 'fixed', left: '0px', top: '0px', width: `${W}px`, height: `${H}px`, background: '#000',
  });
  document.body.style.margin = '0';
  document.body.appendChild(host);
  root = createRoot(host);
  flushSync(() => root!.render(createElement(Stage)));
  // The selection seeds in an effect and the chrome paints a frame after it.
  let shot = await shoot(host);
  for (let i = 0; i < 40 && shot.at(DRAWN.tl[0] - 3, DRAWN.tl[1] - 3) === 'ground'
    && shot.at(STORED.tl[0] - 3, STORED.tl[1] - 3) === 'ground'; i++) {
    await new Promise((r) => setTimeout(r, 50));
    shot = await shoot(host);
  }
  return shot;
}

/** The first chrome pixel scanning row `y` from `from` toward `to`; `to` when there is none. */
function firstChrome(shot: Shot, y: number, from: number, to: number): number {
  const step = Math.sign(to - from);
  for (let x = from; x !== to; x += step) {
    if (shot.at(x, y) === 'chrome') return x;
  }
  return to;
}

describe('selection chrome on a skewed node, in pixels', () => {
  it('draws the node skewed, so the rest of this file measures something', async () => {
    const shot = await mount();
    // Inside the drawn shape and outside the stored box, then the reverse.
    expect(shot.at(70, 66)).toBe('body');
    expect(shot.at(250, 134)).toBe('body');
    expect(shot.at(235, 68)).not.toBe('body');
    expect(shot.at(85, 132)).not.toBe('body');
  });

  it('outlines the drawn edges', async () => {
    const shot = await mount();
    // Row 80: the drawn left edge is at x = 70, the stored one at 80.
    const left = firstChrome(shot, 80, 30, 160);
    expect(left).toBeGreaterThanOrEqual(65);
    expect(left).toBeLessThanOrEqual(70);
    // Row 120: the drawn right edge is at x = 250, the stored one at 240.
    const right = firstChrome(shot, 120, 310, 160);
    expect(right).toBeGreaterThanOrEqual(249);
    expect(right).toBeLessThanOrEqual(254);
    // And nothing is outlined along the stored box's edges, inside the body.
    expect(shot.at(79, 80)).toBe('body');
    expect(shot.at(240, 120)).toBe('body');
  });

  it('centers a handle on each drawn corner and none on a stored one', async () => {
    const shot = await mount();
    // The pixel between two and three pixels out along the diagonal: past
    // the outline, and inside a handle's fill rather than on its dark rim.
    const out = { tl: [-3, -3], tr: [2, -3], br: [2, 2], bl: [-3, 2] } as const;
    for (const k of ['tl', 'tr', 'br', 'bl'] as const) {
      expect(shot.at(DRAWN[k][0] + out[k][0], DRAWN[k][1] + out[k][1]), `drawn ${k}`).toBe('chrome');
      expect(shot.at(STORED[k][0] + out[k][0], STORED[k][1] + out[k][1]), `stored ${k}`).not.toBe('chrome');
    }
    // The top-left handle's span on a row above the outline is centered on
    // the corner's x.
    const y = DRAWN.tl[1] - 3;
    const a = firstChrome(shot, y, 30, 160);
    const b = firstChrome(shot, y, DRAWN.tl[0] + 14, 30);
    expect((a + b + 1) / 2).toBeGreaterThanOrEqual(DRAWN.tl[0] - 1.5);
    expect((a + b + 1) / 2).toBeLessThanOrEqual(DRAWN.tl[0] + 1.5);
  });
});
