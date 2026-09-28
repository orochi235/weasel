/**
 * A lazily registered atlas against real WebGL2 and the real Inter files: a
 * scene with no text never fetches it, and one with text fetches it, paints no
 * glyphs until it lands, and paints them on the redraw the landing asks for.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { registerFont, subscribeGlyphReady } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { createScene } from 'core/scene/scene';
import type { RectPose } from 'features/groups/composePose';
import { renderSceneToPixels, type RasterImage } from './renderSceneToPixels';
import type { DrawCommand } from '../renderer/DrawCommand';
import metricsUrl from '../../../../assets/fonts/inter/inter.json?url';
import atlasUrl from '../../../../assets/fonts/inter/inter.png?url';

type Kind = 'box' | 'label';

const drawOne = (node: { data: Kind }, p: RectPose): DrawCommand[] => node.data === 'box'
  ? [{
    kind: 'path',
    path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
    fill: { fill: 'solid', color: '#ff0000' },
  }]
  : [{
    kind: 'text', x: p.x, y: p.y, align: 'left',
    style: { fontFamily: 'lazy-inter', fontSize: 32 },
    runs: [{
      text: 'Hi', fontFamily: 'lazy-inter', fontSize: 32, fontWeight: 400, fontStyle: 'normal',
      fill: { fill: 'solid', color: '#ffffff' }, letterSpacing: 0,
      underline: false, strikethrough: false, overline: false, baselineShift: 0,
    }],
  } as DrawCommand];

function render(kinds: Kind[]): RasterImage {
  const scene = createScene<Kind, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  for (const data of kinds) {
    scene.add({ kind: 'leaf', layer: 'main', pose: { x: 4, y: 4, width: 20, height: 20 }, data });
  }
  return renderSceneToPixels({
    scene,
    drawOne: drawOne as never,
    sourceRect: { x: 0, y: 0, width: 64, height: 48 },
    scale: { x: 1, y: 1 },
    background: '#000000',
  });
}

/** Pixels where white glyph ink landed — any channel lit on all three. */
function inkPixels(img: RasterImage): number {
  let n = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i] > 128 && img.data[i + 1] > 128 && img.data[i + 2] > 128) n++;
  }
  return n;
}

let requested: string[] = [];
const realFetch = window.fetch;

beforeEach(() => {
  _resetFontRegistryForTests();
  requested = [];
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    requested.push(String(input));
    return realFetch(input, init);
  }) as typeof fetch;
});

afterEach(() => {
  window.fetch = realFetch;
  _resetFontRegistryForTests();
});

describe('lazy font atlas', () => {
  it('a scene with no text never requests the atlas', async () => {
    void registerFont('lazy-inter', {}, metricsUrl, atlasUrl, { lazy: true });
    render(['box']);
    await new Promise((r) => setTimeout(r, 50));
    expect(requested).toEqual([]);
  });

  it('a scene with text requests it, and the redraw it asks for paints the glyphs', async () => {
    const landed = registerFont('lazy-inter', {}, metricsUrl, atlasUrl, { lazy: true });
    let redraws = 0;
    const unsubscribe = subscribeGlyphReady(() => { redraws++; });

    const before = render(['label']);
    expect(requested).toEqual([metricsUrl, atlasUrl]);
    expect(inkPixels(before)).toBe(0);

    await landed;
    expect(redraws).toBeGreaterThan(0);
    expect(inkPixels(render(['label']))).toBeGreaterThan(20);
    expect(requested).toHaveLength(2);
    unsubscribe();
  });
});
