/**
 * A range's thumb sits on the vertical center of its track, measured in pixels.
 * `getComputedStyle(el, '::-webkit-slider-thumb')` answers with the input's own
 * values in Chromium, so nothing short of the framebuffer can see a thumb pseudo.
 *
 * Each case is shot three times: thumb and track painted opaque, thumb hidden,
 * both hidden. The first pair differs exactly where the thumb is, the second
 * where the track is, and the centroid of each difference down one column is
 * that part's center. Opaque paint keeps a translucent thumb from weighting the
 * rows it shares with the track.
 */
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import less from 'less';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');
// CSS-module sources are mounted raw, so their classes are prefixed to keep
// `.range`, `.track` and `.thumb` from colliding across files.
const moduleCss = (p: string, prefix: string) =>
  read(p).replace(/\.(range|alpha|slider|track|thumb|fill)\b/g, `.${prefix}-$1`);

const PAINT = `
  input[type=range], [data-t] { opacity: 1 !important; }
  input[type=range]::-webkit-slider-runnable-track { background: #0a0 !important; }
  input[type=range]::-moz-range-track { background: #0a0 !important; }
  input[type=range][data-self-track] { background: #0a0 !important; }
  [data-t=track] { background: #0a0 !important; border-color: #0a0 !important; }
  [data-t=track] > :not([data-t=thumb]) { opacity: 0 !important; }`;
const THUMB_ON = `
  input[type=range]::-webkit-slider-thumb { background: #f0f !important; opacity: 1 !important; }
  input[type=range]::-moz-range-thumb { background: #f0f !important; opacity: 1 !important; }
  [data-t=thumb] { background: #f0f !important; border-color: #f0f !important; box-shadow: none !important; }`;
const THUMB_OFF = `
  input[type=range]::-webkit-slider-thumb { opacity: 0 !important; }
  input[type=range]::-moz-range-thumb { opacity: 0 !important; }
  [data-t=thumb] { opacity: 0 !important; }`;
const TRACK_OFF = `
  input[type=range] { background: transparent !important; }
  input[type=range]::-webkit-slider-runnable-track { background: transparent !important; }
  input[type=range]::-moz-range-track { background: transparent !important; }
  [data-t=track] { background: transparent !important; border-color: transparent !important; }
  [data-t=track] > :not([data-t=thumb]) { opacity: 0 !important; }`;

// RAC's SliderThumb writes this inline and leaves the cross axis to CSS.
const RAC_THUMB = 'position:absolute;left:40%;transform:translate(-50%,-50%)';

const tokens = (track: number, thumb: number) =>
  `--wzl-slider-track-h:${track}px;--wzl-slider-thumb-size:${thumb}px`;

/** [label, markup]; every case holds exactly one range. */
function cases(): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  // Even and odd gaps between track and thumb; an odd one needs a half-pixel offset.
  for (const [t, th] of [[4, 8], [3, 8], [5, 8], [6, 14]]) {
    const v = tokens(t, th);
    out.push([`skin ${t}/${th}`, `<div style="${v}"><input type="range" class="u-range" value="37"></div>`]);
    out.push([
      `skin, element is the track ${t}/${th}`,
      `<div style="${v};--wzl-range-box-h:var(--wzl-slider-track-h);--wzl-range-bg:#888;--wzl-range-track-bg:transparent">` +
        `<input type="range" class="u-range" data-self-track value="63"></div>`,
    ]);
    out.push([`labkit bare input ${t}/${th}`, `<div class="lk-root" style="${v}"><input type="range" value="41"></div>`]);
  }
  for (const box of ['border-box', 'content-box']) {
    out.push([
      `RangeSlider ${box}`,
      `<div class="${box}"><div class="r-slider"><div class="r-track" data-t="track">` +
        `<div class="r-fill" style="left:0;right:60%"></div>` +
        `<div class="r-thumb" data-t="thumb" style="${RAC_THUMB}"></div></div></div></div>`,
    ]);
  }
  return out;
}

async function mount(page: Page) {
  const { css: labkit } = await less.render(read('packages/labkit/src/theme/base.less'), {
    filename: resolve(root, 'packages/labkit/src/theme/base.less'),
  });
  const body = cases()
    .map(([label, html]) => `<section data-case="${label}">${html}</section>`)
    .join('');
  await page.setContent(
    `<!doctype html><html data-wzl-theme="weasel" data-wzl-mode="light" data-wzl-density="comfortable"><head>
     <style>${read('packages/theme/src/generated/tokens.css')}</style>
     <style>${moduleCss('packages/ui/src/components/range.module.css', 'u')}</style>
     <style>${moduleCss('packages/ui/src/components/RangeSlider/RangeSlider.module.css', 'r')}</style>
     <style>${labkit}</style>
     <style>body { margin: 0; padding: 8px; width: 260px; background: #fff; } section { padding: 12px 10px; } .border-box * { box-sizing: border-box; }</style>
     <style id="probe"></style></head><body>${body}</body></html>`,
  );
}

/** Screenshots the page with `css` applied and keeps the pixels in the page as `key`. */
async function shoot(page: Page, key: string, css: string): Promise<void> {
  await page.evaluate((c) => { document.getElementById('probe')!.textContent = c; }, css);
  const png = (await page.screenshot({ fullPage: true })).toString('base64');
  await page.evaluate(async ({ key, png }) => {
    const img = new Image();
    img.src = `data:image/png;base64,${png}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.drawImage(img, 0, 0);
    ((window as unknown as { shots: Record<string, ImageData> }).shots ??= {})[key] = g.getImageData(0, 0, c.width, c.height);
  }, { key, png });
}

/** Per-row difference between two shots down column x, over rows [y0, y1). */
const diffColumn = (page: Page, a: string, b: string, x: number, y0: number, y1: number) =>
  page.evaluate(({ a, b, x, y0, y1 }) => {
    const shots = (window as unknown as { shots: Record<string, ImageData> }).shots;
    const [p, q] = [shots[a], shots[b]];
    const out: number[] = [];
    for (let y = y0; y < y1; y++) {
      const i = (y * p.width + x) * 4;
      out.push(Math.max(Math.abs(p.data[i] - q.data[i]), Math.abs(p.data[i + 1] - q.data[i + 1]), Math.abs(p.data[i + 2] - q.data[i + 2])));
    }
    return out;
  }, { a, b, x, y0, y1 });

/** Centroid, in device px from y0, of a difference column. */
function centroid(col: number[], what: string): number {
  const sum = col.reduce((s, v) => s + v, 0);
  expect(sum, `nothing drawn for ${what}`).toBeGreaterThan(0);
  return col.reduce((s, v, y) => s + v * (y + 0.5), 0) / sum;
}

async function offsets(page: Page, dpr: number) {
  await mount(page);
  // Thumb x for a native range comes from its value; a DOM thumb has a box.
  const geo = await page.evaluate(() =>
    [...document.querySelectorAll('section')].map((s) => {
      const el = (s.querySelector('[data-t=track]') ?? s.querySelector('input'))!;
      const r = el.getBoundingClientRect();
      const thumbEl = s.querySelector('[data-t=thumb]');
      let thumbX: number;
      if (thumbEl) {
        const t = thumbEl.getBoundingClientRect();
        thumbX = t.x + t.width / 2;
      } else {
        const input = el as HTMLInputElement;
        const size = parseFloat(getComputedStyle(input).getPropertyValue('--wzl-slider-thumb-size'));
        const f = (input.valueAsNumber - Number(input.min || 0)) / (Number(input.max || 100) - Number(input.min || 0));
        thumbX = r.x + f * (r.width - size) + size / 2;
      }
      return { label: s.dataset.case!, top: s.getBoundingClientRect().top, bottom: s.getBoundingClientRect().bottom, trackX: r.x + r.width * 0.9, thumbX };
    }),
  );
  await shoot(page, 'both', PAINT + THUMB_ON);
  await shoot(page, 'track', PAINT + THUMB_OFF);
  await shoot(page, 'none', TRACK_OFF + THUMB_OFF);
  const out: Array<{ label: string; offset: number }> = [];
  for (const g of geo) {
    const y0 = Math.round(g.top * dpr);
    const y1 = Math.round(g.bottom * dpr);
    const thumb = centroid(await diffColumn(page, 'both', 'track', Math.round(g.thumbX * dpr), y0, y1), `${g.label} thumb`);
    const track = centroid(await diffColumn(page, 'track', 'none', Math.round(g.trackX * dpr), y0, y1), `${g.label} track`);
    out.push({ label: g.label, offset: (thumb - track) / dpr });
  }
  return out;
}

for (const dpr of [1, 2]) {
  test.describe(`range thumb centering at ${dpr}x`, () => {
    test.use({ deviceScaleFactor: dpr });

    test('every thumb is centered on its track', async ({ page }) => {
      const measured = await offsets(page, dpr);
      expect(measured.length).toBe(cases().length);
      // 0.25, not 0.5: Chromium rounds a thumb margin to a whole CSS pixel, and
      // the half-pixel miss that leaves on an odd gap sits exactly at 0.5.
      for (const { label, offset } of measured) expect(Math.abs(offset), `${label}: thumb center ${offset.toFixed(3)}px from track center`).toBeLessThan(0.25);
    });
  });
}
