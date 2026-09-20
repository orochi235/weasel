/**
 * Panel label typography, checked in a browser against the real stylesheets.
 * jsdom cannot do this: the CSS-module proxy answers to any class without
 * reading a rule, and nothing there resolves `var()`. Geometry only — no pixel
 * baseline, so no GPU/CI drift to manage.
 */
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import less from 'less';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

const OVERRIDE =
  '.ovr { --wzl-params-label-case: none; --wzl-params-label-tracking: var(--wzl-tracking-none);' +
  ' --wzl-params-label-align: end; --wzl-params-label-width: 9rem; }';

const ROWS = `
  <label class="row" data-k="slider-stacked"><span class="rowLabel">Opacity<em class="readout">0.62</em></span><input type="range"></label>
  <label class="row rowInline" data-k="inline"><span class="rowLabel">Blend</span><select><option>Multiply</option></select></label>
  <label class="row rowInline" data-k="slider-inline"><span class="rowLabel">Depth</span><input type="range"></label>
  <label class="row rowCheckbox" data-k="checkbox"><span class="rowLabel">Visible</span><input type="checkbox"></label>`;

async function mount(page: import('@playwright/test').Page, css: string, body: string) {
  await page.setContent(
    `<!doctype html><html data-wzl-theme="weasel" data-wzl-mode="dark" data-wzl-density="comfortable">
     <head><style>${read('packages/theme/src/generated/tokens.css')}</style><style>${css}</style><style>${OVERRIDE}</style>
     <style>body { width: 420px; }</style></head><body>${body}</body></html>`,
  );
}

/** Label geometry relative to its row, and where the text sits inside the label. */
const measure = (page: import('@playwright/test').Page, scope: string) =>
  page.evaluate((scope) => {
    return [...document.querySelectorAll(`${scope} [data-k]`)].map((row) => {
      const label = row.querySelector('.rowLabel, .lk-pair-label') as HTMLElement;
      const text = [...label.childNodes].find((n) => n.nodeType === 3 && n.textContent!.trim())!;
      const range = document.createRange();
      range.selectNodeContents(text);
      const R = row.getBoundingClientRect();
      const L = label.getBoundingClientRect();
      const T = range.getBoundingClientRect();
      const cs = getComputedStyle(label);
      return {
        k: (row as HTMLElement).dataset.k!,
        transform: cs.textTransform,
        labelLeft: Math.round(L.left - R.left),
        width: Math.round(L.width),
        textRightGap: Math.round(L.right - T.right),
      };
    });
  }, scope);

test.describe('params labels', () => {
  test('an inline slider row keeps its label on the leading edge', async ({ page }) => {
    await mount(page, read('packages/ui/src/components/Properties/Properties.module.css'), `<div class="panel">${ROWS}</div>`);
    const rows = await measure(page, '.panel');
    // A stacked-row rule once packed an inline slider row's label against its track.
    expect(rows.find((r) => r.k === 'slider-inline')!.labelLeft).toBe(0);
    for (const r of rows) expect(r.labelLeft, r.k).toBe(0);
  });

  test('labels default to uppercase', async ({ page }) => {
    await mount(page, read('packages/ui/src/components/Properties/Properties.module.css'), `<div class="panel">${ROWS}</div>`);
    for (const r of await measure(page, '.panel')) expect(r.transform, r.k).toBe('uppercase');
  });

  test('one declaration on an ancestor sets case, width and alignment beneath it', async ({ page }) => {
    await mount(
      page,
      read('packages/ui/src/components/Properties/Properties.module.css'),
      `<div class="ovr"><div class="panel">${ROWS}</div></div>`,
    );
    const rows = await measure(page, '.ovr');
    for (const r of rows) expect(r.transform, r.k).toBe('none');
    for (const k of ['inline', 'slider-inline', 'checkbox']) {
      const r = rows.find((x) => x.k === k)!;
      expect(r.width, k).toBe(144);
      expect(r.textRightGap, k).toBe(0);
    }
  });

  test('the override crosses into labkit, whose labels live outside the CSS module', async ({ page }) => {
    const { css } = await less.render(read('packages/labkit/src/controls/ControlPanel.less'));
    const pair = `<div class="lk-control-panel">
      <span class="lk-pair-cell" data-k="pair"><span class="lk-pair-label">Wrap</span><input type="number" value="80"></span>
    </div>`;
    await mount(page, css, `<div class="def">${pair}</div><div class="ovr">${pair}</div>`);
    const [def] = await measure(page, '.def');
    const [ovr] = await measure(page, '.ovr');
    expect(def.transform).toBe('uppercase');
    expect(ovr).toMatchObject({ transform: 'none', width: 144, textRightGap: 0 });
  });
});
