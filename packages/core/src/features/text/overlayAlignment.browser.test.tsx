/**
 * The edit overlay against the canvas it stands in for, compared as pixels:
 * the same text node is painted by the GL renderer and set by the overlay, and
 * the two inks' intensity-weighted centroids must land in the same place.
 *
 * `scripts/measure-overlay-alignment.config.ts` runs the full matrix — every
 * family, size and script across Chromium, WebKit and Firefox at DPR 1 and 2 —
 * and writes one TSV per browser to `node_modules/.cache/overlay-alignment/`.
 */
import { describe, it, expect, beforeAll, afterAll, inject } from 'vitest';
import { page, commands, userEvent } from 'vitest/browser';
import { createElement, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { registerFont, registerCanvasFont, registerFontOutlines } from '@weasel-js/font';
import type { TextStyle } from '@weasel-js/text';
import { createScene } from 'core/scene/scene';
import type { RectPose } from 'features/groups/composePose';
import { renderSceneToPixels, type RasterImage } from '../../canvas/renderSceneToPixels';
import { useTextEdit, type TextEditScreenPose } from './useTextEdit';
import { overlayReady } from './test-utils/overlayReady';
import metricsUrl from '../../../../../assets/fonts/inter/inter.json?url';
import atlasUrl from '../../../../../assets/fonts/inter/inter.png?url';
import ttfUrl from '../../../../../assets/fonts/inter/inter.ttf?url';

const W = 360;
const H = 160;
/** One glyph, so the centroid measures placement alone; cases with `text` measure advances. */
const TEXT = 'H';

interface Ink { cx: number; cy: number; mass: number; right: number; spans: Array<[number, number]> }

/** Share of the ink `right` leaves beyond it: deep enough in the last glyph to be subpixel-smooth. */
const TAIL = 0.03;

/** Ink a column needs, in fully lit pixels, to count toward a span. */
const SPAN_INK = 0.5;

/**
 * Intensity-weighted centroid of light ink on black and its mass, plus where
 * the line's ink ends: the column all but {@link TAIL} of the ink lies left
 * of, interpolated within the column. `spans` are the runs of inked columns,
 * one per glyph where glyphs do not touch. CSS px.
 */
function inkOf(img: RasterImage, dpr: number): Ink {
  let mass = 0, sx = 0, sy = 0;
  const cols = new Float64Array(img.width);
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      const v = (img.data[i] + img.data[i + 1] + img.data[i + 2]) / (3 * 255);
      mass += v; sx += v * (x + 0.5); sy += v * (y + 0.5);
      cols[x] += v;
    }
  }
  let right = img.width;
  for (let x = 0, acc = 0; x < img.width; x++) {
    const goal = mass * (1 - TAIL);
    if (acc + cols[x] >= goal) { right = x + (goal - acc) / cols[x]; break; }
    acc += cols[x];
  }
  const spans: Array<[number, number]> = [];
  for (let x = 0; x < img.width; x++) {
    if (cols[x] < SPAN_INK) continue;
    const last = spans[spans.length - 1];
    if (last && last[1] === x / dpr) last[1] = (x + 1) / dpr;
    else spans.push([x / dpr, (x + 1) / dpr]);
  }
  return { cx: sx / mass / dpr, cy: sy / mass / dpr, mass, right: right / dpr, spans };
}

async function decodePng(base64: string): Promise<RasterImage> {
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

interface Case {
  family: string; fontSize: number; script?: 'super' | 'sub'; x: number; y: number; text?: string;
  /** Justified and wrapped at the 200px box, over this many lines. */
  justifyLines?: number;
  smallCaps?: boolean;
}

function styleOf(c: Case): TextStyle {
  return {
    fontFamily: c.family, fontSize: c.fontSize, lineHeight: 1.2,
    ...(c.script ? { script: c.script } : {}),
    ...(c.justifyLines ? { align: 'justify' as const, wrap: true } : {}),
    ...(c.smallCaps ? { fontVariantCaps: 'small-caps' as const } : {}),
  };
}

const boxHeight = (c: Case): number => c.fontSize * 1.2 * (c.justifyLines ?? 1);

const WHITE = { fill: 'solid' as const, color: '#ffffff' };

function renderCanvas(c: Case, dpr: number): RasterImage {
  const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.add({
    kind: 'leaf', layer: 'main',
    pose: { x: c.x, y: c.y, width: 200, height: boxHeight(c) },
    data: { text: c.text ?? TEXT, style: styleOf(c), fill: WHITE },
  });
  return renderSceneToPixels({
    scene,
    sourceRect: { x: 0, y: 0, width: W, height: H },
    scale: { x: dpr, y: dpr },
    background: '#000000',
  });
}

/** Render until two passes agree: atlases and outlines land asynchronously. */
async function settledCanvas(c: Case, dpr: number): Promise<RasterImage> {
  let prev = -1;
  for (let i = 0; i < 40; i++) {
    const img = renderCanvas(c, dpr);
    const m = inkOf(img, dpr).mass;
    if (m > 0 && Math.abs(m - prev) < 1e-6) return img;
    prev = m;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`canvas never settled for ${JSON.stringify(c)}`);
}

let host: HTMLDivElement;
let root: Root;

function Editor({ c }: { c: Case }) {
  const edit = useTextEdit({
    container: host,
    getText: () => c.text ?? TEXT,
    getStyle: () => ({ ...styleOf(c), caretColor: 'transparent' }),
    getPaint: () => ({ fill: WHITE }),
    getScreenPose: (): TextEditScreenPose => ({
      x: c.x, y: c.y, width: 200, height: boxHeight(c), fontSize: c.fontSize, zoom: 1,
    }),
    setText: () => {},
  });
  const { startEdit } = edit;
  const caret = (c.text ?? TEXT).length;
  useEffect(() => { startEdit('n', { caret }); }, [startEdit, caret]);
  return null;
}

async function renderOverlay(c: Case): Promise<RasterImage> {
  flushSync(() => root.render(createElement(Editor, { key: JSON.stringify(c), c })));
  await overlayReady(host);
  // Unsaved, it answers with the base64 PNG.
  return decodePng(await page.screenshot({ element: host, save: false }));
}

beforeAll(async () => {
  host = document.createElement('div');
  Object.assign(host.style, {
    position: 'fixed', left: '0px', top: '0px', width: `${W}px`, height: `${H}px`,
    background: '#000', overflow: 'hidden',
  });
  document.body.style.margin = '0';
  document.body.appendChild(host);
  root = createRoot(document.createElement('div'));

  // No FontFace of its own: the overlay must get the face from the registration.
  await registerFont('Inter', {}, metricsUrl, atlasUrl);
  await registerFont('sans-serif', {}, metricsUrl, atlasUrl);
  registerFontOutlines('Inter', {}, ttfUrl);
  registerFontOutlines('sans-serif', {}, ttfUrl);
  registerCanvasFont('Georgia');
  registerCanvasFont('Arial');
});

afterAll(() => {
  root.unmount();
  host.remove();
});

function browserName(): string {
  const ua = navigator.userAgent;
  return ua.includes('Firefox') ? 'firefox' : ua.includes('Chrome') ? 'chromium' : 'webkit';
}

/** Overlay ink minus canvas ink, in CSS px: centroid, and where the ink ends. */
async function offset(c: Case): Promise<{
  dx: number; dy: number; dRight: number; spans: [Array<[number, number]>, Array<[number, number]>];
}> {
  const dpr = window.devicePixelRatio;
  const a = inkOf(await settledCanvas(c, dpr), dpr);
  const b = inkOf(await renderOverlay(c), dpr);
  return { dx: b.cx - a.cx, dy: b.cy - a.cy, dRight: b.right - a.right, spans: [a.spans, b.spans] };
}

declare module 'vitest' {
  export interface ProvidedContext { overlayAlignmentMatrix?: boolean }
}

describe('edit overlay alignment', () => {
  // The atlas, outline and canvas-font tiers, each with and without a script;
  // then whole words, whose ends land together only if advances and kerning
  // agree; then `sans-serif`, which the canvas draws in Inter and the overlay
  // must too.
  const CASES: Case[] = [
    { family: 'Inter', fontSize: 16, x: 20, y: 20 },
    { family: 'Inter', fontSize: 24, script: 'super', x: 20, y: 20 },
    { family: 'Inter', fontSize: 24, script: 'sub', x: 20, y: 20 },
    // Stems under a pixel wide, where the atlas once thresholded one away.
    { family: 'Inter', fontSize: 12, script: 'super', x: 20, y: 20 },
    { family: 'Inter', fontSize: 72, x: 20, y: 20 },
    { family: 'Georgia', fontSize: 40, script: 'sub', x: 20, y: 20 },
    { family: 'Arial', fontSize: 40, x: 20, y: 20 },
    { family: 'Inter', fontSize: 72, x: 20, y: 20, text: 'Hxgd' },
    { family: 'Inter', fontSize: 72, x: 20, y: 20, text: 'AVATAR' },
    { family: 'sans-serif', fontSize: 72, x: 20, y: 20, text: 'Hxgd' },
    { family: 'sans-serif', fontSize: 16, x: 20, y: 20 },
    // Justified: the wrapped lines reach the box's right edge, so `dRight`
    // checks the spread and the centroid checks where the gaps opened.
    { family: 'Inter', fontSize: 24, x: 20, y: 20, text: 'Hxgd Hxgd Hxgd Hxgd', justifyLines: 2 },
    // Small caps, sized by the face's own heights on the canvas, which no
    // browser synthesis matches — the overlay has to set the same size.
    { family: 'Inter', fontSize: 72, x: 20, y: 20, text: 'Hgd', smallCaps: true },
    { family: 'Inter', fontSize: 24, x: 20, y: 20, text: 'Small Caps', smallCaps: true },
    { family: 'Arial', fontSize: 40, x: 20, y: 20, text: 'Hgd', smallCaps: true },
  ];

  for (const c of CASES) {
    const label = `${c.text ? `"${c.text}" ` : ''}${c.family} ${c.fontSize}px${c.script ? ` ${c.script}` : ''}`
      + (c.justifyLines ? ' justified' : '') + (c.smallCaps ? ' small caps' : '');
    it(`${label} lands on the canvas glyphs`, async () => {
      const d = await offset(c);
      const at = `dx ${d.dx.toFixed(2)} dy ${d.dy.toFixed(2)} dRight ${d.dRight.toFixed(2)}`;
      if (c.smallCaps) {
        // Mixed sizes make the centroid a weight test, not a placement one:
        // the browser inks a small glyph heavier against a large one than the
        // canvas does. So each glyph's own extent is compared instead.
        const [canvas, overlay] = d.spans;
        const spans = `canvas ${JSON.stringify(canvas)} overlay ${JSON.stringify(overlay)}`;
        expect(overlay.length, spans).toBe(canvas.length);
        overlay.forEach(([x0, x1], i) => {
          expect(Math.abs(x0 - canvas[i][0]), spans).toBeLessThanOrEqual(1);
          expect(Math.abs(x1 - canvas[i][1]), spans).toBeLessThanOrEqual(1);
        });
      } else {
        expect(Math.abs(d.dx), at).toBeLessThan(0.75);
      }
      expect(Math.abs(d.dy), at).toBeLessThan(0.75);
      expect(Math.abs(d.dRight), at).toBeLessThan(0.75);
    });
  }

  it('types into small caps in the right pieces, and commits the source text, not the capitals', async () => {
    let committed: string | null = null;
    function PlainEditor() {
      const edit = useTextEdit({
        container: host,
        getText: () => 'Hgd',
        getStyle: () => ({ fontFamily: 'Inter', fontSize: 24, fontVariantCaps: 'small-caps' }),
        getScreenPose: (): TextEditScreenPose => ({ x: 20, y: 20, width: 200, height: 30, fontSize: 24, zoom: 1 }),
        setText: (_id, text) => { committed = text; },
      });
      const { startEdit } = edit;
      useEffect(() => { startEdit('n', { caret: 3 }); }, [startEdit]);
      return null;
    }
    flushSync(() => root.render(createElement(PlainEditor)));
    await new Promise((r) => requestAnimationFrame(r));
    await userEvent.keyboard('xY');
    const overlay = host.querySelector<HTMLElement>('[contenteditable]')!;
    const pieces = [...overlay.querySelectorAll('[data-small-caps]')].map((p) => p.textContent);
    expect(pieces).toEqual(['gdx']);
    overlay.blur();
    expect(committed).toBe('HgdxY');
  });

  it.runIf(inject('overlayAlignmentMatrix'))('measures the full matrix', async () => {
    const rows = ['browser\tdpr\ttext\tfamily\tsize\tscript\tx,y\tdx\tdy\tdRight'];
    for (const text of [TEXT, 'Hxgd']) {
      for (const family of ['Inter', 'Georgia', 'Arial', 'sans-serif']) {
        for (const fontSize of [12, 16, 24, 40, 72]) {
          for (const script of text === TEXT ? [undefined, 'super', 'sub'] as const : [undefined]) {
            for (const [x, y] of [[20, 20], [20.5, 20.4]] as const) {
              const { dx, dy, dRight } = await offset({ family, fontSize, script, x, y, text });
              rows.push([browserName(), window.devicePixelRatio, text, family, fontSize, script ?? '-', `${x},${y}`,
                dx.toFixed(2).padStart(6), dy.toFixed(2).padStart(6), dRight.toFixed(2).padStart(6)].join('\t'));
            }
          }
        }
      }
    }
    await commands.writeFile(
      `node_modules/.cache/overlay-alignment/${browserName()}-dpr${window.devicePixelRatio}.tsv`,
      `${rows.join('\n')}\n`,
    );
  }, 600_000);
});
