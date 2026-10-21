/**
 * Off-page markers in the chart, driven the way a user would: a connector drawn from a shape on one page to a shape
 * on the next draws nothing across the gap, ends at two tags, and a double-click on a tag goes to the other page and
 * selects the shape there.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { PAGES_DOC_KEY, fitViewToBounds, layoutPages } from '@weasel-js/core';
import { registerCanvasFont } from '@weasel-js/font';
import '@weasel-js/theme/tokens.css';
import { CHART_SCENE_KEY } from '../chartPersistence';
import { readClientPixels } from '../testing/canvasPixels';
import { mountChartApp, unmountChartApp } from '../testing/mountChartApp';
import { PAGE_FIT_PADDING } from './useChartPages';

registerCanvasFont('sans-serif');

/** Two tall, narrow pages, so both and the gap between them fit the window with the first page fitted: page 1 spans
 *  world x 0..150, page 2 x 190..340. */
const PAGES = [{ id: 'page-1', width: 150, height: 600 }, { id: 'page-2', width: 150, height: 600 }];

beforeEach(async () => {
  await page.viewport(1280, 800);
  localStorage.clear();
  localStorage.setItem(CHART_SCENE_KEY, JSON.stringify({ version: 1, nodes: [], doc: { [PAGES_DOC_KEY]: { pages: PAGES } } }));
});

afterEach(() => {
  unmountChartApp();
  localStorage.clear();
});

interface SavedNode { id: string; kind: string; data: Record<string, unknown> }
const saved = (): SavedNode[] => (JSON.parse(localStorage.getItem(CHART_SCENE_KEY) ?? '{"nodes":[]}') as { nodes: SavedNode[] }).nodes;
const bodies = () => saved().filter((n) => n.kind === 'container');
const edges = () => saved().filter((n) => 'from' in ((n.data.diagram as object | undefined) ?? {}));
const editor = (): HTMLElement | null => document.querySelector('.wc-host [contenteditable="true"]');

/** Client point of a world point, with page `fitted` fitted to the workspace. */
function at(host: HTMLElement, x: number, y: number, fitted = 0): { x: number; y: number } {
  const box = host.getBoundingClientRect();
  const placed = layoutPages(PAGES)[fitted]!;
  const view = fitViewToBounds(placed, box, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { padding: PAGE_FIT_PADDING });
  return { x: box.left + (x - view.x) * view.scale.x, y: box.top + (y - view.y) * view.scale.y };
}

function pointer(el: Element, type: string, p: { x: number; y: number }, buttons = 1): void {
  el.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
    button: 0, buttons: type === 'pointerup' ? 0 : buttons, clientX: p.x, clientY: p.y,
  }));
}

async function drag(el: Element, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  pointer(el, 'pointermove', from, 0);
  pointer(el, 'pointerdown', from);
  for (let i = 1; i <= 8; i++) {
    pointer(el, 'pointermove', { x: from.x + ((to.x - from.x) * i) / 8, y: from.y + ((to.y - from.y) * i) / 8 });
    await new Promise((r) => requestAnimationFrame(r));
  }
  pointer(el, 'pointerup', to);
}

function doubleClick(el: Element, p: { x: number; y: number }): void {
  for (let i = 1; i <= 2; i++) {
    pointer(el, 'pointerdown', p);
    pointer(el, 'pointerup', p);
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: p.x, clientY: p.y, detail: i }));
  }
  el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: p.x, clientY: p.y, detail: 2 }));
}

const useTool = (name: string) => userEvent.click(page.getByRole('toolbar', { name: 'Tools' }).getByRole('button', { name: new RegExp(`^${name}`) }));

/** Whether every pixel the canvas drew in a client rect is the same color. */
function blank(canvas: HTMLCanvasElement, a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  const px = readClientPixels(canvas, a, b);
  for (let i = 4; i < px.length; i++) if (px[i] !== px[i % 4]) return false;
  return true;
}

describe('WeaselChart off-page markers', () => {
  it('cuts a connector between pages at the gap, tags both ends, and follows a tag to the other page', async () => {
    const { host, canvas } = await mountChartApp();
    expect(at(host, 340, 0).x).toBeLessThan(host.getBoundingClientRect().right);

    await userEvent.click(page.getByRole('toolbar', { name: 'Shapes' }).getByRole('button', { name: 'Process' }));
    await drag(canvas, at(host, 20, 100), at(host, 120, 150));
    await expect.poll(() => bodies().length).toBe(1);
    await drag(canvas, at(host, 210, 400), at(host, 310, 450));
    await expect.poll(() => bodies().length).toBe(2);

    await useTool('Connector');
    await drag(canvas, at(host, 70, 125), at(host, 260, 425));
    await expect.poll(() => edges().length).toBe(1);
    const edge = edges()[0]!;
    expect((edge.data.diagram as { offPage?: unknown }).offPage).toEqual({ ref: 'A', from: 'page-1', to: 'page-2' });
    const tag = (end: string) => saved().find((n) => n.id === `${edge.id}/offpage-${end}`)?.data.text;
    expect(tag('from')).toBe('Page 2 · A');
    expect(tag('to')).toBe('Page 1 · A');

    await new Promise((r) => requestAnimationFrame(r));
    // The gap down the whole run between the two shapes: nothing drawn across it.
    expect(blank(canvas, at(host, 165, 100), at(host, 175, 450))).toBe(true);
    // The first shape's stub leaves its south port at (70, 150): drawn.
    expect(blank(canvas, at(host, 66, 154), at(host, 74, 166))).toBe(false);

    await useTool('Select');
    // Where the second shape's top edge lands once page 2 is fitted; page 1 is fitted now, and blank there.
    const topEdge = () => blank(canvas, at(host, 230, 395, 1), at(host, 290, 405, 1));
    expect(topEdge()).toBe(true);
    // The start stub ends 24 below its port, and its tag hangs 2 below that, centered on x = 70.
    doubleClick(canvas, at(host, 70, 184));
    await expect.poll(topEdge).toBe(false);
    expect(editor()).toBeNull();
    // The shape at the far end is the one selected.
    const [first, second] = bodies().map((b) => b.id);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }));
    await expect.poll(() => bodies().map((b) => b.id)).toEqual([first]);
    expect(second).toBeDefined();
  });
});
