/** Format › Theme in a real browser: the page and a shape repaint in the theme's colors, and one undo puts them back. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { DIAGRAM_THEMES, isDiagramBody } from '@weasel-js/diagram';
import { registerCanvasFont } from '@weasel-js/font';
import '@weasel-js/theme/tokens.css';
import { CHART_SCENE_KEY } from '../chartPersistence';
import { STENCIL_MIME } from '../stencilDrop';
import { at, colorAt, readClientPixels } from '../testing/canvasPixels';
import { mountChartApp, unmountChartApp } from '../testing/mountChartApp';
import { doubleClick } from '../testing/pointer';

registerCanvasFont('sans-serif');

beforeEach(async () => {
  await page.viewport(1280, 800);
  localStorage.clear();
});

afterEach(() => {
  unmountChartApp();
  localStorage.clear();
});

const { paper, blueprint } = DIAGRAM_THEMES as Record<string, (typeof DIAGRAM_THEMES)[string]>;

const savedNodes = (): { data: unknown }[] => (JSON.parse(localStorage.getItem(CHART_SCENE_KEY) ?? '{"nodes":[]}') as { nodes: { data: unknown }[] }).nodes;

/** Drops a Process stencil centered on world (400, 300), as a drag from the Shapes panel does. */
async function dropProcess(canvas: HTMLCanvasElement, host: HTMLElement): Promise<void> {
  const dt = new DataTransfer();
  dt.setData(STENCIL_MIME, 'process');
  const p = at(host, 400, 300);
  for (const type of ['dragenter', 'dragover', 'drop']) {
    canvas.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt, clientX: p.x, clientY: p.y }));
  }
  await expect.poll(() => savedNodes().some(isDiagramBody)).toBe(true);
}

/** Clicks through menu rows by name; a theme's row is a checkbox item, held while its theme is on. */
async function menu(...path: (string | RegExp)[]): Promise<void> {
  for (const name of path) {
    await userEvent.click(page.getByRole('menuitem', { name }).or(page.getByRole('menuitemcheckbox', { name })).first());
  }
}

describe('Format › Theme', () => {
  it('repaints the page and a shape in the theme, and one undo puts both back', async () => {
    const { host, canvas } = await mountChartApp();
    await dropProcess(canvas, host);
    // Inside the page, clear of the shape; and the shape's middle, clear of its outline and its (empty) text.
    const ground = at(host, 150, 650);
    const shape = at(host, 380, 290);
    await expect.poll(() => colorAt(canvas, ground)).toBe(paper!.page);
    await expect.poll(() => colorAt(canvas, shape)).toBe(paper!.roles.default!.fill);

    await menu('Format', /^Theme/, /^Blueprint/);
    await expect.poll(() => colorAt(canvas, ground)).toBe(blueprint!.page);
    await expect.poll(() => colorAt(canvas, shape)).toBe(blueprint!.roles.default!.fill);

    await menu('Edit', /^Undo/);
    await expect.poll(() => colorAt(canvas, ground)).toBe(paper!.page);
    await expect.poll(() => colorAt(canvas, shape)).toBe(paper!.roles.default!.fill);
  });
});

describe('Format › Theme › Edit Theme…', () => {
  it('repaints a shape while its role color is dragged, and one undo restores the pixels and the theme', async () => {
    const { host, canvas } = await mountChartApp();
    await dropProcess(canvas, host);
    const shape = at(host, 380, 290);
    await expect.poll(() => colorAt(canvas, shape)).toBe(paper!.roles.default!.fill);

    await menu('Format', /^Theme/, /^Edit Theme/);
    const input = page.getByLabelText('Default fill', { exact: true }).element() as HTMLInputElement;
    // A picker drag: a run of input events, a frame or more apart, then the picker closing.
    for (const hex of ['#400000', '#800000', '#c00000']) {
      input.value = hex;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await expect.poll(() => colorAt(canvas, shape)).toBe(hex);
    }
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await expect.poll(() => localStorage.getItem(CHART_SCENE_KEY) ?? '').toContain('Paper (edited)');

    await menu('Edit', /^Undo/);
    await expect.poll(() => colorAt(canvas, shape)).toBe(paper!.roles.default!.fill);
    await expect.poll(() => localStorage.getItem(CHART_SCENE_KEY) ?? '').not.toContain('Paper (edited)');
    // The undo before the drag takes back the shape, so the drag was one entry.
    await menu('Edit', /^Undo/);
    await expect.poll(() => savedNodes().some(isDiagramBody)).toBe(false);
  });
});

type Box = { x: number; y: number; width: number; height: number };

/** The saved body and its text row. */
function savedBody(): { body: Box; row: { pose: Box; data: { text?: string } } } {
  const nodes = (JSON.parse(localStorage.getItem(CHART_SCENE_KEY)!) as {
    nodes: { id: string; kind: string; parent?: string | null; pose: Box; data: { text?: string } }[];
  }).nodes;
  const body = nodes.find(isDiagramBody)!;
  return { body: body.pose, row: nodes.find((n) => n.parent === body.id)! };
}

/** Pixels darker than 128 on every channel between two world points: text ink on the white page or fill. */
function ink(host: HTMLElement, canvas: HTMLCanvasElement, x0: number, y0: number, x1: number, y1: number): number {
  const px = readClientPixels(canvas, at(host, x0, y0), at(host, x1, y1));
  let n = 0;
  for (let i = 0; i < px.length; i += 4) if (px[i]! < 128 && px[i + 1]! < 128 && px[i + 2]! < 128) n++;
  return n;
}

describe('the theme Size field', () => {
  it('grows a shape with its text, so the text stays inside it', async () => {
    const { host, canvas } = await mountChartApp();
    await dropProcess(canvas, host);
    doubleClick(canvas, at(host, 400, 300));
    const editor = () => document.querySelector<HTMLElement>('.wc-host [contenteditable="true"]');
    await expect.poll(editor).not.toBeNull();
    await userEvent.keyboard('MMMMMM');
    editor()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await expect.poll(() => savedBody().row.data.text).toBe('MMMMMM');
    const small = savedBody().body;

    await menu('Format', /^Theme/, /^Edit Theme/);
    await userEvent.fill(page.getByRole('spinbutton', { name: 'Size', exact: true }), '64');
    await userEvent.keyboard('{Tab}');
    await expect.poll(() => (localStorage.getItem(CHART_SCENE_KEY) ?? '').includes('"fontSize":64')).toBe(true);

    const { body, row } = savedBody();
    const [r, bottom] = [body.x + body.width, body.y + body.height];
    // Text drawn past where the small body ended: the scene saves before the canvas repaints, and the
    // frame before shows the small body, whose outline crosses the top strip below.
    await expect.poll(() => ink(host, canvas, small.x + small.width + 8, body.y, r - 12, bottom)).toBeGreaterThan(50);
    // None in the strips between the outline and its rows' padding, where text cut off at the row's
    // edge would sit. The strips start clear of the outline and the selection.
    expect(ink(host, canvas, body.x + 7, body.y + 7, body.x + 10, bottom - 7)).toBe(0);
    expect(ink(host, canvas, r - 10, body.y + 7, r - 7, bottom - 7)).toBe(0);
    expect(ink(host, canvas, body.x + 7, body.y + 7, r - 7, body.y + 10)).toBe(0);
    expect(ink(host, canvas, body.x + 7, bottom - 10, r - 7, bottom - 7)).toBe(0);
    expect(body.height).toBeGreaterThan(small.height);
    expect(row.pose.y + row.pose.height).toBeLessThanOrEqual(body.y + body.height);
  });
});
