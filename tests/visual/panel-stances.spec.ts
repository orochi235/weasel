/**
 * Panel stances and tones, checked in a browser against the real stylesheets —
 * jsdom resolves no var() or color-mix(), so the unit tests can only read the
 * fallback chains as text. Computed styles only, no pixel baseline.
 */
import { expect, type Page, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

const rows = `<div class="list"><label class="row"><span class="rowLabel">Amount<em class="readout">0.40</em></span><input type="range"></label></div>`;
const panel = (attrs: string, title: string, inner = rows) =>
  `<div class="panel" ${attrs}><h2 class="panelTitle">${title}</h2>${inner}</div>`;
const tone = (step: string) => `data-tone="1" style="--wzl-panel-tone: var(--wzl-swatch-${step})"`;

const BODY = [
  panel('data-k="none"', 'no stance'),
  panel(`data-k="scope-tone" data-stance="scope" ${tone('green')}`, 'scope'),
  panel('data-k="scope" data-stance="scope"', 'scope, no tone'),
  panel('data-k="danger" data-stance="danger"', 'danger'),
  panel('data-k="debug" data-stance="debug"', 'debug'),
  panel('data-k="aside" data-stance="aside"', 'aside'),
  panel('data-k="preview" data-stance="preview"', 'preview'),
  panel('data-k="notice" data-stance="notice"', 'notice'),
  panel('data-k="important" data-stance="important"', 'important'),
  panel('data-k="advanced" data-stance="advanced"', 'advanced'),
  panel(`data-k="outer" data-stance="scope" ${tone('sky')}`, 'outer', panel('data-k="nested" data-stance="scope" data-nested', 'nested')),
  `<div class="pin">${panel('data-k="pinned" data-stance="aside"', 'pinned')}</div>`,
].join('');

async function mount(page: Page, mode: 'dark' | 'light') {
  await page.setContent(
    `<!doctype html><html data-wzl-theme="weasel" data-wzl-mode="${mode}" data-wzl-density="comfortable">
     <head><style>${read('packages/theme/src/generated/tokens.css')}</style>
     <style>${read('packages/ui/src/components/Properties/Properties.module.css')}</style>
     <style>body { background: var(--wzl-surface); display: grid; grid-template-columns: repeat(3, 240px); gap: 12px; padding: 12px; margin: 0 }
       .pin { --wzl-panel-aside-border-style: dotted; }</style></head><body>${BODY}</body></html>`,
  );
}

/** Computed looks for each `[data-k]` panel, plus a probe resolving a color expression in page context. */
const looks = (page: Page) =>
  page.evaluate(() => {
    const probe = document.createElement('i');
    document.body.append(probe);
    const color = (expr: string) => {
      probe.style.color = expr;
      return getComputedStyle(probe).color;
    };
    const out: Record<string, Record<string, string>> = {};
    for (const el of document.querySelectorAll<HTMLElement>('[data-k]')) {
      const cs = getComputedStyle(el);
      const title = getComputedStyle(el.querySelector(':scope > .panelTitle')!);
      const readout = getComputedStyle(el.querySelector('.readout')!);
      out[el.dataset.k!] = {
        bg: cs.backgroundColor,
        borderWidth: cs.borderTopWidth,
        borderStyle: cs.borderTopStyle,
        borderColor: cs.borderTopColor,
        radius: cs.borderTopLeftRadius,
        pad: cs.paddingTop,
        titleSize: title.fontSize,
        titleCase: title.textTransform,
        titleFont: title.fontFamily,
        titleColor: title.color,
        readout: readout.color,
      };
    }
    out.ref = {
      raised: color('var(--wzl-surface-raised)'),
      border: color('var(--wzl-border)'),
      accent: color('var(--wzl-accent)'),
      accentFg: color('var(--wzl-accent-fg)'),
      green: color('var(--wzl-swatch-green)'),
      danger: color('var(--wzl-danger)'),
    };
    return out;
  });

for (const mode of ['dark', 'light'] as const) {
  test.describe(`panel stances, ${mode}`, () => {
    test('an unstanced panel draws as it always has', async ({ page }) => {
      await mount(page, mode);
      const { none, ref } = await looks(page);
      expect(none).toMatchObject({ bg: ref.raised, borderWidth: '1px', borderStyle: 'solid', borderColor: ref.border, radius: '14px', titleSize: '16px', titleCase: 'none', readout: ref.accent });
    });

    test('each stance draws its own look, and a stanced title takes the row-label recipe', async ({ page }) => {
      await mount(page, mode);
      const l = await looks(page);
      expect(l.scope).toMatchObject({ borderWidth: '0px', radius: '8px', titleCase: 'uppercase' });
      expect(l.scope.titleSize).not.toBe(l.none.titleSize);
      expect(l.aside.bg).toMatch(/[/,] 0\)$/); // fully transparent, however color-mix serializes it
      expect(l.debug.borderStyle).toBe('dashed');
      expect(l.debug.titleFont).toMatch(/mono/i);
      expect(l.danger.bg).not.toBe(l.ref.raised);
      expect(l.danger.titleColor).toBe(l.ref.danger);
      expect(l.notice.bg).not.toBe(l.ref.raised);
      expect(l.important.borderColor).toBe(l.ref.accentFg);
      expect(l.important.titleColor).toBe(l.ref.accentFg);
      expect(l.important.titleColor).not.toBe(l.none.titleColor);
      expect(l.advanced.titleColor).not.toBe(l.scope.titleColor);
      expect(l.preview.pad).toBe('0px');
    });

    test('a named tone mixes into the surface and recolors the controls; a stance’s own tone does not', async ({ page }) => {
      await mount(page, mode);
      const l = await looks(page);
      expect(l['scope-tone'].bg).not.toBe(l.scope.bg);
      expect(l['scope-tone'].readout).toBe(l.ref.green);
      expect(l.danger.readout).toBe(l.ref.accent);
    });

    test('a nested panel reads its stance’s nested slots, and takes no tone from its parent', async ({ page }) => {
      await mount(page, mode);
      const l = await looks(page);
      expect(l.nested.radius).toBe('6px');
      expect(l.outer.radius).toBe('8px');
      expect(l.nested.bg).not.toBe(l.outer.bg);
    });

    test('a stance slot set on an ancestor reaches the panels beneath it', async ({ page }) => {
      await mount(page, mode);
      const l = await looks(page);
      expect(l.pinned.borderStyle).toBe('dotted');
      expect(l.aside.borderStyle).toBe('solid');
    });

    test(`screenshot, ${mode}`, async ({ page }) => {
      await page.setViewportSize({ width: 780, height: 900 });
      await mount(page, mode);
      await page.screenshot({ path: resolve(root, `test-results/panel-stances-${mode}.png`), fullPage: true });
    });
  });
}
