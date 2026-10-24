/**
 * Panel stances, grades, emphasis, and tints, checked in a browser against the real stylesheets —
 * jsdom resolves no var() or color-mix(), so the unit tests can only read the
 * fallback chains as text. Computed styles only, no pixel baseline.
 */
import { expect, type Page, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readModuleCss } from '../../packages/ui/src/testing/readModuleCss';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

const rows = `<div class="list"><label class="row"><span class="rowLabel">Amount<em class="readout">0.40</em></span><input type="range"></label></div>`;
const panel = (attrs: string, title: string, inner = rows) =>
  `<div class="panel" ${attrs}><h2 class="panelTitle">${title}</h2>${inner}</div>`;
const tint = (step: string) => `data-tint="1" style="--wzl-tint: var(--wzl-swatch-${step})"`;

const BODY = [
  panel('data-k="none"', 'no stance'),
  panel(`data-k="clarify-tint" data-stance="clarify" ${tint('green')}`, 'clarify'),
  panel('data-k="clarify" data-stance="clarify"', 'clarify, no tint'),
  panel('data-k="danger" data-grade="danger" style="--wzl-grade: var(--wzl-danger)"', 'danger'),
  panel('data-k="debug" data-stance="debug"', 'debug'),
  panel('data-k="aside" data-stance="aside"', 'aside'),
  panel('data-k="preview" data-stance="preview"', 'preview'),
  panel('data-k="warn" data-grade="warn" style="--wzl-grade: var(--wzl-warning)"', 'warn'),
  panel('data-k="high" data-emphasis="high"', 'high emphasis'),
  panel('data-k="advanced" data-stance="advanced"', 'advanced'),
  panel(`data-k="outer" data-stance="clarify" ${tint('sky')}`, 'outer', panel('data-k="nested" data-stance="clarify" data-nested', 'nested')),
  `<div class="pin">${panel('data-k="pinned" data-stance="aside"', 'pinned')}</div>`,
  panel('data-k="host"', 'host', [
    `<div class="frame rule group" data-k="group"><h3 class="title"><hr><span>group</span><hr></h3>${rows}</div>`,
    `<div class="frame rule group" data-k="group-danger" data-grade="danger" style="--wzl-grade: var(--wzl-danger)"><h3 class="title"><hr><span>danger group</span><hr></h3>${rows}</div>`,
    `<div class="subpanel" data-k="sub-high" data-emphasis="high"><h4 class="subpanelTitle"><span>high emphasis</span><hr></h4>${rows}</div>`,
    `<div class="frame rule group" data-k="group-tint" ${tint('green')}><h3 class="title"><hr><span>tinted group</span><hr></h3>${rows}</div>`,
    `<div class="frame stereo" data-side="left" data-k="stereo-danger" data-grade="danger" style="--wzl-grade: var(--wzl-danger)"><div class="bar"><span class="label">stereo</span></div><div class="body">${rows}</div></div>`,
  ].join('')),
].join('');

async function mount(page: Page, mode: 'dark' | 'light') {
  await page.setContent(
    `<!doctype html><html data-wzl-theme="weasel" data-wzl-mode="${mode}" data-wzl-density="comfortable">
     <head><style>${read('packages/theme/src/generated/tokens.css')}</style>
     <style>${readModuleCss(resolve(root, 'packages/ui/src/components/Properties/Properties.module.css'))}</style>
     <style>${read('packages/ui/src/components/MotifFrame/MotifFrame.module.css')}</style>
     <style>${read('packages/ui/src/components/MotifFrame/motifs/rule.module.css')}</style>
     <style>${read('packages/ui/src/components/MotifFrame/motifs/stereo.module.css')}</style>
     <style>body { background: var(--wzl-surface); display: grid; grid-template-columns: repeat(3, 240px); gap: 12px; padding: 12px; margin: 0 }
       .pin { --wzl-stance-aside-border-style: dotted; }</style></head><body>${BODY}</body></html>`,
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
    const size = (expr: string) => {
      probe.style.fontSize = expr;
      return getComputedStyle(probe).fontSize;
    };
    const out: Record<string, Record<string, string>> = {};
    for (const el of document.querySelectorAll<HTMLElement>('[data-k]')) {
      const cs = getComputedStyle(el);
      const title = getComputedStyle(el.querySelector(':scope > .panelTitle, :scope > .title > span, :scope > .bar > .label, :scope > .subpanelTitle')!);
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
      greenFg: color('color-mix(in oklab, var(--wzl-swatch-green) 70%, var(--wzl-fg))'),
      danger: color('var(--wzl-danger)'),
      titleSize: size('var(--wzl-panel-title-size)'),
    };
    return out;
  });

for (const mode of ['dark', 'light'] as const) {
  test.describe(`panel stances, ${mode}`, () => {
    test('an unstanced panel draws as it always has', async ({ page }) => {
      await mount(page, mode);
      const { none, ref } = await looks(page);
      expect(none).toMatchObject({ bg: ref.raised, borderWidth: '1px', borderStyle: 'solid', borderColor: ref.border, radius: '14px', titleSize: ref.titleSize, titleCase: 'none', readout: ref.accentFg });
    });

    test('each stance, grade, and emphasis draws its own look, and a stanced title takes the row-label recipe', async ({ page }) => {
      await mount(page, mode);
      const l = await looks(page);
      expect(l.clarify).toMatchObject({ borderWidth: '0px', radius: '8px', titleCase: 'uppercase' });
      expect(l.clarify.titleSize).not.toBe(l.none.titleSize);
      expect(l.aside.bg).toMatch(/[/,] 0\)$/); // fully transparent, however color-mix serializes it
      expect(l.debug.borderStyle).toBe('dashed');
      expect(l.debug.titleFont).toMatch(/mono/i);
      expect(l.danger.bg).not.toBe(l.ref.raised);
      expect(l.danger.titleColor).toBe(l.ref.danger);
      expect(l.warn.bg).not.toBe(l.ref.raised);
      expect(l.high.borderColor).toBe(l.ref.accentFg);
      expect(l.high.titleColor).toBe(l.ref.accentFg);
      expect(l.high.titleColor).not.toBe(l.none.titleColor);
      expect(l.advanced.titleColor).not.toBe(l.clarify.titleColor);
      expect(l.preview.pad).toBe('0px');
    });

    test('a named tint mixes into the surface and recolors the controls; a grade does not', async ({ page }) => {
      await mount(page, mode);
      const l = await looks(page);
      expect(l['clarify-tint'].bg).not.toBe(l.clarify.bg);
      // Readouts paint --wzl-accent-fg, which the rebind derives from the tint.
      expect(l['clarify-tint'].readout).toBe(l.ref.greenFg);
      expect(l.danger.readout).toBe(l.ref.accentFg);
    });

    test('a nested panel reads its stance’s nested slots, and takes no tint from its parent', async ({ page }) => {
      await mount(page, mode);
      const l = await looks(page);
      expect(l.nested.radius).toBe('6px');
      expect(l.outer.radius).toBe('8px');
      expect(l.nested.bg).not.toBe(l.outer.bg);
    });

    test('a group and a subpanel follow the same grades, emphasis, and tints', async ({ page }) => {
      await mount(page, mode);
      const l = await looks(page);
      expect(l['group-danger'].bg).not.toBe(l.group.bg);
      expect(l['group-danger'].titleColor).toBe(l.ref.danger);
      expect(l['sub-high'].titleColor).toBe(l.ref.accentFg);
      expect(l['group-tint'].readout).toBe(l.ref.greenFg);
    });

    test('every motif takes the same grade: a danger stereo frame shares the danger group’s border color', async ({ page }) => {
      await mount(page, mode);
      const l = await looks(page);
      expect(l['stereo-danger'].borderColor).toBe(l['group-danger'].borderColor);
      expect(l['stereo-danger'].borderWidth).toBe('2px');
    });

    test('a stance slot set on an ancestor reaches the panels beneath it', async ({ page }) => {
      await mount(page, mode);
      const l = await looks(page);
      expect(l.pinned.borderStyle).toBe('dotted');
      expect(l.aside.borderStyle).toBe('solid');
    });
  });
}
