/**
 * Chart pages in a real browser: the strip's layout, adding a page and drawing on it, reordering the tabs, undo,
 * Page Down, and a save and reload, driven the way a user would.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { PAGES_DOC_KEY, fitViewToBounds, layoutPages, type PagesDoc } from '@weasel-js/core';
import { registerCanvasFont } from '@weasel-js/font';
import '@weasel-js/theme/tokens.css';
import { isDiagramBody } from '@weasel-js/diagram';
import { CHART_PAGE } from '../chartDocument';
import { CHART_SCENE_KEY } from '../chartPersistence';
import { chartPrefs } from '../prefs';
import { STENCIL_MIME } from '../stencilDrop';
import { mountChartApp, unmountChartApp } from '../testing/mountChartApp';
import { drag } from '../testing/pointer';
import { PAGE_FIT_PADDING } from './useChartPages';

registerCanvasFont('sans-serif');

beforeEach(async () => {
  await page.viewport(1280, 800);
  localStorage.clear();
});

afterEach(() => {
  unmountChartApp();
  localStorage.clear();
});

interface Saved { nodes: { kind: string; data: unknown; pose: { x: number } }[]; doc?: Record<string, unknown> }
const saved = (): Saved => JSON.parse(localStorage.getItem(CHART_SCENE_KEY) ?? '{"nodes":[]}') as Saved;
const pageIds = () => (saved().doc?.[PAGES_DOC_KEY] as PagesDoc | undefined)?.pages.map((p) => p.id);
const bodyX = () => saved().nodes.find(isDiagramBody)?.pose.x;
const tabs = () => [...document.querySelectorAll<HTMLElement>('[role="tab"]')];
const lit = () => tabs().findIndex((t) => t.getAttribute('aria-selected') === 'true');

/** Client point of a point on the `index`th of two chart-size pages, with the view fitted to that page. */
function onPage(host: HTMLElement, index: number, x: number, y: number): { x: number; y: number } {
  const box = host.getBoundingClientRect();
  const placed = layoutPages([{ id: 'a', ...CHART_PAGE }, { id: 'b', ...CHART_PAGE }])[index]!;
  const view = fitViewToBounds(placed, box, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { padding: PAGE_FIT_PADDING });
  return { x: box.left + (placed.x + x - view.x) * view.scale.x, y: box.top + (placed.y + y - view.y) * view.scale.y };
}

const middle = (el: Element) => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

describe('WeaselChart pages', () => {
  it('puts the page strip under the canvas, across the bottom of the window', async () => {
    const { host } = await mountChartApp();
    const strip = document.querySelector('.wc-pages')!.getBoundingClientRect();
    const box = host.getBoundingClientRect();
    expect(strip.top).toBeCloseTo(box.bottom, 0);
    expect(strip.bottom).toBeCloseTo(window.innerHeight, 0);
    expect(strip.left).toBeCloseTo(box.left, 0);
    expect(box.height).toBeGreaterThan(600);
    expect(tabs().map((t) => t.textContent)).toEqual(['Page 1']);
  });

  it('adds a page, draws on it, reorders the tabs, undoes, and keeps it all through a reload', async () => {
    const { host, canvas } = await mountChartApp();
    await userEvent.click(page.getByRole('button', { name: 'Add page' }));
    await expect.poll(() => tabs().length).toBe(2);
    await expect.poll(lit).toBe(1);

    await userEvent.click(page.getByRole('toolbar', { name: 'Flowchart' }).getByRole('button', { name: 'Process' }));
    await drag(canvas, onPage(host, 1, 100, 100), onPage(host, 1, 220, 160));
    await expect.poll(bodyX).toBeCloseTo(CHART_PAGE.width + 40 + 100, -1);

    await drag(tabs()[1]!, middle(tabs()[1]!), { x: tabs()[0]!.getBoundingClientRect().left + 2, y: middle(tabs()[0]!).y });
    await expect.poll(pageIds).toEqual(['page-2', 'page-1']);
    expect(bodyX()).toBeCloseTo(100, -1);

    await userEvent.click(page.getByRole('menuitem', { name: 'Edit' }));
    await userEvent.click(page.getByRole('menuitem', { name: /^Undo/ }));
    await expect.poll(pageIds).toEqual(['page-1', 'page-2']);
    expect(bodyX()).toBeCloseTo(CHART_PAGE.width + 40 + 100, -1);

    unmountChartApp();
    await mountChartApp();
    expect(tabs()).toHaveLength(2);
    await expect.poll(lit).toBe(0);
    expect(bodyX()).toBeCloseTo(CHART_PAGE.width + 40 + 100, -1);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true, cancelable: true }));
    await expect.poll(lit).toBe(1);
  });

  it('lays the snap grid from the corner of the page in view', async () => {
    chartPrefs().set('view.snapToGrid', true);
    const { host, canvas } = await mountChartApp();
    await userEvent.click(page.getByRole('button', { name: 'Add page' }));
    await expect.poll(lit).toBe(1);
    const dt = new DataTransfer();
    dt.setData(STENCIL_MIME, 'decision');
    const p = onPage(host, 1, 400, 300);
    for (const type of ['dragenter', 'dragover', 'drop']) {
      canvas.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt, clientX: p.x, clientY: p.y }));
    }
    await expect.poll(bodyX).toBeDefined();
    // Page 2 starts at x 1096, off the world's 12-unit lattice: on the page's own grid the Decision's origin,
    // 340 from the corner unsnapped, lands on 336, where a lattice from world 0 would put it at 344.
    expect(Math.round(bodyX()! - (CHART_PAGE.width + 40))).toBe(336);
  });
});
