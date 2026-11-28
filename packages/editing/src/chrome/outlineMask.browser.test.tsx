/**
 * `outline.mask`, read back as pixels: a node painted in front of the
 * selected one covers its outline, and one painted behind it does not.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { page } from 'vitest/browser';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { SceneCanvas, createScene, asNodeId, type RectPose } from '@weasel-js/core';
import { useSelection } from '@weasel-js/editing';
import { outlinePreset } from '../presets/transform';

const W = 320;
const H = 200;
const ID = asNodeId('a');

type Kind = 'ground' | 'selected' | 'other' | 'chrome';

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
    if (data[i] > 96) return 'selected';
    return data[i + 2] > 96 ? 'other' : 'ground';
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

const solid = (color: string) => ({ shape: 'rect', fill: { paint: { kind: 'solid', color } } });

async function mount(mask: boolean) {
  const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  // Behind the selected node, across its left edge.
  scene.add({ id: asNodeId('behind'), kind: 'mark', layer: 'main', data: solid('#0000ff'), pose: { x: 20, y: 100, width: 80, height: 60 } });
  scene.add({ id: ID, kind: 'mark', layer: 'main', data: solid('#ff0000'), pose: { x: 60, y: 60, width: 160, height: 80 } });
  // In front of it, across its top-right corner.
  scene.add({ id: asNodeId('front'), kind: 'mark', layer: 'main', data: solid('#0000ff'), pose: { x: 180, y: 30, width: 80, height: 70 } });
  function Stage() {
    const selection = useSelection({ scene, mode: 'single', initial: [ID] });
    return createElement(SceneCanvas<object, 'main', RectPose>, {
      scene,
      selection,
      features: [outlinePreset],
      width: W,
      height: H,
      view: { x: 0, y: 0, scale: { x: 1, y: 1 } },
      layers: {
        selectionOverlay: {
          handles: false,
          outline: { paint: { kind: 'solid', color: '#00ff00' }, width: 3, follow: 'shape', mask },
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
  for (let i = 0; i < 40 && at(120, 58) !== 'chrome'; i++) {
    await new Promise((r) => setTimeout(r, 50));
    at = await shoot(host);
  }
  return at;
}

describe('selection outline with mask: true, in pixels', () => {
  it('hides under a node painted in front, and shows over one painted behind', async () => {
    const at = await mount(true);
    expect(at(120, 100)).toBe('selected');
    // The top edge, clear of everything.
    expect(at(120, 58)).toBe('chrome');
    // The top and right edges where `front` covers them.
    expect(at(200, 58)).toBe('other');
    expect(at(221, 80)).toBe('other');
    // The left edge across `behind`, which paints first.
    expect(at(58, 120)).toBe('chrome');
    // The right edge below `front`.
    expect(at(221, 120)).toBe('chrome');
  });

  it('without mask, paints over the node in front', async () => {
    const at = await mount(false);
    expect(at(200, 58)).toBe('chrome');
    expect(at(221, 80)).toBe('chrome');
  });
});
