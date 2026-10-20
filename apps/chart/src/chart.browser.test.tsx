/**
 * Chart mode in a real browser: stencils, the connector, ports, delete and undo, edge labels,
 * and body text, driven through the canvas the way a user would.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { DIAGRAM_THEMES, themeEdgeStroke } from '@weasel-js/diagram';
import { registerCanvasFont } from '@weasel-js/font';
import '@weasel-js/theme/tokens.css';
import { CHART_SCENE_KEY } from './chartPersistence';
import { STENCIL_MIME } from './stencilDrop';
import { at, readClientPixels } from './testing/canvasPixels';
import { mountChartApp as mountApp, unmountChartApp } from './testing/mountChartApp';

const paper = DIAGRAM_THEMES.paper!;

registerCanvasFont('sans-serif');

beforeEach(async () => {
  await page.viewport(1280, 800);
  localStorage.clear();
});

afterEach(() => {
  unmountChartApp();
  localStorage.clear();
});

interface SavedNode { id: string; kind: string; parent?: string | null; dependsOn?: string[]; data: Record<string, unknown> }

/** The chart as the session store last saved it. */
function saved(): SavedNode[] {
  const raw = localStorage.getItem(CHART_SCENE_KEY);
  return raw ? (JSON.parse(raw) as { nodes: SavedNode[] }).nodes : [];
}
const bodies = () => saved().filter((n) => n.kind === 'container');
const edges = () => saved().filter((n) => {
  const d = n.data.diagram as { from?: unknown } | undefined;
  return d !== undefined && 'from' in d;
});

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

function click(el: Element, p: { x: number; y: number }): void {
  pointer(el, 'pointerdown', p);
  pointer(el, 'pointerup', p);
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: p.x, clientY: p.y }));
}

function doubleClick(el: Element, p: { x: number; y: number }): void {
  click(el, p);
  click(el, p);
  el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: p.x, clientY: p.y, detail: 2 }));
}

const key = (k: string): void => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  window.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true, cancelable: true }));
};

const useTool = (name: string) => userEvent.click(page.getByRole('toolbar', { name: 'Tools' }).getByRole('button', { name: new RegExp(`^${name}`) }));
const editor = (): HTMLElement | null => document.querySelector('.wc-host [contenteditable="true"]');

/** Two Process bodies, 120 by 60: one from world (100, 100), one from (500, 100). */
async function twoBodies(host: HTMLElement, canvas: HTMLCanvasElement): Promise<string[]> {
  await userEvent.click(page.getByRole('toolbar', { name: 'Shapes' }).getByRole('button', { name: 'Process' }));
  await drag(canvas, at(host, 100, 100), at(host, 220, 160));
  await expect.poll(() => bodies().length).toBe(1);
  await drag(canvas, at(host, 500, 100), at(host, 620, 160));
  await expect.poll(() => bodies().length).toBe(2);
  return bodies().map((b) => b.id);
}

describe('WeaselChart chart mode', () => {
  it('draws bodies, joins them with the connector, deletes one with its edge, and undoes it', async () => {
    const { host, canvas } = await mountApp();
    const [first] = await twoBodies(host, canvas);

    await useTool('Connector');
    await drag(canvas, at(host, 150, 140), at(host, 560, 140));
    await expect.poll(() => edges().length).toBe(1);
    expect(edges()[0]!.data.diagram).toMatchObject({ from: {}, to: {} });
    // The paper theme's ink for a white page, not the kit's dark-ground defaults.
    expect(edges()[0]!.data.stroke).toEqual(themeEdgeStroke(paper));
    expect(bodies()[0]!.data.fill).toEqual({ paint: { color: paper.roles.default!.fill } });

    await useTool('Select');
    click(canvas, at(host, 130, 115));
    key('Delete');
    await expect.poll(() => bodies().map((b) => b.id)).not.toContain(first);
    expect(edges()).toHaveLength(0);

    await userEvent.click(page.getByRole('menuitem', { name: 'Edit' }));
    await userEvent.click(page.getByRole('menuitem', { name: /^Undo/ }));
    await expect.poll(() => bodies().length).toBe(2);
    expect(edges()).toHaveLength(1);
  });

  it('starts a connect from a port with the connector tool, and glues the edge to that port', async () => {
    const { host, canvas } = await mountApp();
    await twoBodies(host, canvas);
    await useTool('Connector');
    // The first body's east port, the middle of its right edge, onto the second body's west port.
    await drag(canvas, at(host, 220, 130), at(host, 500, 130));
    await expect.poll(() => edges().length).toBe(1);
    const { from, to } = edges()[0]!.data.diagram as { from: { port?: string }; to: { port?: string } };
    expect(from.port).toBeDefined();
    expect(to.port).toBeDefined();
  });

  it('slides a connector\'s segment by its bar, resets the route from the Format menu, and undoes the reset', async () => {
    const { host, canvas } = await mountApp();
    await twoBodies(host, canvas);
    await useTool('Connector');
    // East port to west port: one straight segment along y = 130.
    await drag(canvas, at(host, 220, 130), at(host, 500, 130));
    await expect.poll(() => edges().length).toBe(1);
    const waypoints = () => (edges()[0]!.data.diagram as { waypoints?: { x: number; y: number }[] }).waypoints;
    expect(waypoints()).toBeUndefined();

    await useTool('Select');
    click(canvas, at(host, 300, 130));
    await new Promise((r) => requestAnimationFrame(r));
    // The bar sits in the segment's middle; both ends touch a port, so each keeps a jog.
    await drag(canvas, at(host, 360, 130), at(host, 360, 200));
    await expect.poll(() => waypoints()?.length).toBe(4);
    const [a, b, c, d] = waypoints()!;
    expect([a!.y, d!.y]).toEqual([130, 130]);
    expect(Math.abs(b!.y - 200)).toBeLessThan(2);
    expect(c!.y).toBe(b!.y);

    await userEvent.click(page.getByRole('menuitem', { name: 'Format' }));
    await userEvent.click(page.getByRole('menuitem', { name: /^Connector/ }));
    await userEvent.click(page.getByRole('menuitem', { name: /^Reset route/ }));
    await expect.poll(waypoints).toBeUndefined();

    await userEvent.click(page.getByRole('menuitem', { name: 'Edit' }));
    await userEvent.click(page.getByRole('menuitem', { name: /^Undo/ }));
    await expect.poll(() => waypoints()?.length).toBe(4);
  });

  it('adds and edits an edge label on a double-click of the edge', async () => {
    const { host, canvas } = await mountApp();
    await twoBodies(host, canvas);
    await useTool('Connector');
    await drag(canvas, at(host, 150, 130), at(host, 560, 130));
    await expect.poll(() => edges().length).toBe(1);
    const edgeId = edges()[0]!.id;

    await useTool('Select');
    doubleClick(canvas, at(host, 360, 130));
    await expect.poll(editor).not.toBeNull();
    await userEvent.keyboard('yes');
    editor()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await expect.poll(editor).toBeNull();
    await expect.poll(() => saved().find((n) => n.id === `${edgeId}/label`)?.data.text).toBe('yes');
    expect(saved().find((n) => n.id === `${edgeId}/label`)!.data.fill).toEqual({ paint: { color: paper.label.fill } });
  });

  it("types into a body's label and paints its text", async () => {
    const { host, canvas } = await mountApp();
    const [first] = await twoBodies(host, canvas);
    await useTool('Select');
    // The body's middle, clear of its stroke and of the selection handles on its edges.
    const inkInBody = () => darkPixels(canvas, at(host, 110, 115), at(host, 210, 145));
    const blank = inkInBody();
    doubleClick(canvas, at(host, 160, 130));
    await expect.poll(editor).not.toBeNull();
    await userEvent.keyboard('MMMM');
    editor()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await expect.poll(editor).toBeNull();
    await expect.poll(() => saved().find((n) => n.parent === first)?.data.text).toBe('MMMM');
    await expect.poll(inkInBody).toBeGreaterThan(blank + 20);
  });

  it('drops a stencil dragged from the Shapes panel centered on the drop point', async () => {
    const { host, canvas } = await mountApp();
    const dt = new DataTransfer();
    dt.setData(STENCIL_MIME, 'decision');
    const p = at(host, 400, 300);
    for (const type of ['dragenter', 'dragover', 'drop']) {
      canvas.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt, clientX: p.x, clientY: p.y }));
    }
    await expect.poll(() => bodies().length).toBe(1);
    const pose = (JSON.parse(localStorage.getItem(CHART_SCENE_KEY)!) as { nodes: { kind: string; pose: { x: number; y: number; width: number; height: number } }[] })
      .nodes.find((n) => n.kind === 'container')!.pose;
    // A pointer event's client point is whole pixels, about a world unit at this zoom.
    expect(Math.abs(pose.x + pose.width / 2 - 400)).toBeLessThan(2);
    expect(Math.abs(pose.y + pose.height / 2 - 300)).toBeLessThan(2);
  });
});

/** Pixels darker than 128 on every channel inside a client rect: label ink on a body's white fill. */
function darkPixels(canvas: HTMLCanvasElement, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const px = readClientPixels(canvas, a, b);
  let n = 0;
  for (let i = 0; i < px.length; i += 4) if (px[i]! < 128 && px[i + 1]! < 128 && px[i + 2]! < 128) n++;
  return n;
}
