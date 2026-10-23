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
import { chartPrefs } from './prefs';
import { STENCIL_MIME } from './stencilDrop';
import { at, readClientPixels } from './testing/canvasPixels';
import { mountChartApp as mountApp, unmountChartApp } from './testing/mountChartApp';
import { click, doubleClick, drag } from './testing/pointer';

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

interface SavedNode {
  id: string; kind: string; parent?: string | null; dependsOn?: string[]; data: Record<string, unknown>;
  pose?: { x: number; y: number; width: number; height: number };
}

/** The chart as the session store last saved it. */
function saved(): SavedNode[] {
  const raw = localStorage.getItem(CHART_SCENE_KEY);
  return raw ? (JSON.parse(raw) as { nodes: SavedNode[] }).nodes : [];
}
const bodies = () => saved().filter((n) => n.kind === 'group');
const poseOf = (id: string) => saved().find((n) => n.id === id)!.pose!;
const edges = () => saved().filter((n) => {
  const d = n.data.diagram as { from?: unknown } | undefined;
  return d !== undefined && 'from' in d;
});

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
    await click(canvas, at(host, 130, 115));
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
    await click(canvas, at(host, 300, 130));
    await new Promise((r) => requestAnimationFrame(r));
    // The bar sits in the segment's middle. A connector routed around shapes pins only the dragged segment: its two
    // ends, jogged off the ports, become the waypoints.
    await drag(canvas, at(host, 360, 130), at(host, 360, 200));
    await expect.poll(() => waypoints()?.length).toBe(2);
    const [b, c] = waypoints()!;
    expect(Math.abs(b!.y - 200)).toBeLessThan(2);
    expect(c!.y).toBe(b!.y);

    await userEvent.click(page.getByRole('menuitem', { name: 'Format' }));
    await userEvent.click(page.getByRole('menuitem', { name: /^Connector/ }));
    await userEvent.click(page.getByRole('menuitem', { name: /^Reset route/ }));
    await expect.poll(waypoints).toBeUndefined();

    await userEvent.click(page.getByRole('menuitem', { name: 'Edit' }));
    await userEvent.click(page.getByRole('menuitem', { name: /^Undo/ }));
    await expect.poll(() => waypoints()?.length).toBe(2);
  });

  it('routes a connector around a shape dragged across it, and undo puts both back', async () => {
    const { host, canvas } = await mountApp();
    await twoBodies(host, canvas);
    await drag(canvas, at(host, 300, 300), at(host, 420, 360));
    await expect.poll(() => bodies().length).toBe(3);
    await useTool('Connector');
    await drag(canvas, at(host, 220, 130), at(host, 500, 130));
    await expect.poll(() => edges().length).toBe(1);
    const route = () => (edges()[0]!.data.diagram as { route?: { x: number; y: number }[] }).route;
    await expect.poll(route).toEqual([]);

    await useTool('Select');
    await drag(canvas, at(host, 360, 330), at(host, 360, 130));
    await expect.poll(() => route()?.length ?? 0).toBeGreaterThan(0);
    // Every bend keeps clear of the shape now sitting on the old line, from (300, 100) to (420, 160).
    for (const p of route()!) expect(p.y < 100 || p.y > 160 || p.x < 300 || p.x > 420).toBe(true);

    await userEvent.click(page.getByRole('menuitem', { name: 'Edit' }));
    await userEvent.click(page.getByRole('menuitem', { name: /^Undo/ }));
    await expect.poll(route).toEqual([]);
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

  it('moves an edge label off a shape dropped on it, on release', async () => {
    const { host, canvas } = await mountApp();
    await twoBodies(host, canvas);
    await drag(canvas, at(host, 300, 300), at(host, 420, 360));
    await expect.poll(() => bodies().length).toBe(3);
    await useTool('Connector');
    await drag(canvas, at(host, 220, 130), at(host, 500, 130));
    await expect.poll(() => edges().length).toBe(1);
    const labelId = `${edges()[0]!.id}/label`;
    await useTool('Select');
    doubleClick(canvas, at(host, 360, 130));
    await expect.poll(editor).not.toBeNull();
    await userEvent.keyboard('label');
    editor()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await expect.poll(() => saved().find((n) => n.id === labelId)?.data.text).toBe('label');

    // Onto (330, 58)–(450, 118): over the label above the line, clear of the line's own clearance.
    await drag(canvas, at(host, 360, 330), at(host, 390, 88));
    const placed = () => (saved().find((n) => n.id === labelId)?.data.diagram as { label?: { placed?: unknown } }).label?.placed;
    await expect.poll(placed).toBeDefined();
    // The shape's lower interior, where the label stood, clear of its selection handles and its stroke.
    await expect.poll(() => darkPixels(canvas, at(host, 340, 100), at(host, 440, 116))).toBe(0);
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
      .nodes.find((n) => n.kind === 'group')!.pose;
    // A pointer event's client point is whole pixels, about a world unit at this zoom.
    expect(Math.abs(pose.x + pose.width / 2 - 400)).toBeLessThan(2);
    expect(Math.abs(pose.y + pose.height / 2 - 300)).toBeLessThan(2);
  });

  it('snaps a moved body to the grid once View › Snap to grid is on', async () => {
    chartPrefs().set('view.alignmentSnap', false);
    chartPrefs().set('view.spacingSnap', false);
    const { host, canvas } = await mountApp();
    await userEvent.click(page.getByRole('toolbar', { name: 'Shapes' }).getByRole('button', { name: 'Process' }));
    await drag(canvas, at(host, 100, 100), at(host, 220, 160));
    await expect.poll(() => bodies().length).toBe(1);
    const id = bodies()[0]!.id;

    await userEvent.click(page.getByRole('menuitem', { name: 'View' }));
    await userEvent.click(page.getByRole('menuitemcheckbox', { name: /^Snap to grid/ }));
    expect(chartPrefs().get('view.snapToGrid')).toBe(true);

    await useTool('Select');
    await drag(canvas, at(host, 160, 130), at(host, 177, 139));
    // Unsnapped, the origin would land near (117, 109).
    await expect.poll(() => poseOf(id).x).toBeCloseTo(120);
    expect(poseOf(id).y).toBeCloseTo(108);
  });

  it('drops a stencil with its origin on the grid under snap to grid', async () => {
    chartPrefs().set('view.snapToGrid', true);
    const { host, canvas } = await mountApp();
    const dt = new DataTransfer();
    dt.setData(STENCIL_MIME, 'decision');
    // A Decision is 120 by 80, so its origin would sit at (340, 260): the grid's (336, 264).
    const p = at(host, 400, 300);
    for (const type of ['dragenter', 'dragover', 'drop']) {
      canvas.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt, clientX: p.x, clientY: p.y }));
    }
    await expect.poll(() => bodies().length).toBe(1);
    const pose = bodies()[0]!.pose!;
    expect([pose.x, pose.y, pose.width, pose.height].map(Math.round)).toEqual([336, 264, 120, 80]);

    // The label rides the snap: it sits in its body as it does in one dropped with no snapping.
    chartPrefs().set('view.snapToGrid', false);
    chartPrefs().set('view.alignmentSnap', false);
    chartPrefs().set('view.spacingSnap', false);
    const q = at(host, 700, 500);
    for (const type of ['dragenter', 'dragover', 'drop']) {
      canvas.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt, clientX: q.x, clientY: q.y }));
    }
    await expect.poll(() => bodies().length).toBe(2);
    const labelOffset = (body: SavedNode) => {
      const label = saved().find((n) => n.parent === body.id)!.pose!;
      return [label.x - body.pose!.x, label.y - body.pose!.y].map((v) => Math.round(v * 100) / 100);
    };
    expect(labelOffset(bodies()[0]!)).toEqual(labelOffset(bodies()[1]!));
  });

  it('lines a dropped stencil up with its neighbor the way a move would, in one undo step', async () => {
    chartPrefs().set('view.spacingSnap', false);
    const { host, canvas } = await mountApp();
    const drop = (stencil: string, x: number, y: number) => {
      const dt = new DataTransfer();
      dt.setData(STENCIL_MIME, stencil);
      const p = at(host, x, y);
      for (const type of ['dragenter', 'dragover', 'drop']) {
        canvas.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt, clientX: p.x, clientY: p.y }));
      }
    };
    // A Decision spanning y 260..340.
    drop('decision', 400, 300);
    await expect.poll(() => bodies().length).toBe(1);
    // A Process centered at y 312 spans 282..342: its corner is out of reach of every line, its
    // bottom edge 2 from the Decision's. A move lines the bottoms up; a corner-only snap left it at 282.
    drop('process', 640, 312);
    await expect.poll(() => bodies().length).toBe(2);
    const decision = bodies().find((b) => b.pose!.height === 80)!.pose!;
    const process = bodies().find((b) => b.pose!.height === 60)!.pose!;
    expect(process.y + process.height).toBeCloseTo(decision.y + decision.height);

    await userEvent.click(page.getByRole('menuitem', { name: 'Edit' }));
    await userEvent.click(page.getByRole('menuitem', { name: /^Undo/ }));
    await expect.poll(() => bodies().length).toBe(1);
  });

  it('draws the grid on the page while View › Show grid is on', async () => {
    const { host, canvas } = await mountApp();
    const inkOnPage = () => offWhitePixels(canvas, at(host, 300, 300), at(host, 700, 600));
    // A strip of workspace just left of the page, inside the fit's 24px of padding.
    const workspace = () => readClientPixels(canvas, at(host, -15, 300), at(host, -3, 600));
    // Read before the first paint, the canvas is blank and the page reads as ink.
    await expect.poll(inkOnPage).toBe(0);
    const bare = workspace();
    await userEvent.click(page.getByRole('menuitem', { name: 'View' }));
    await userEvent.click(page.getByRole('menuitemcheckbox', { name: /^Show grid/ }));
    await expect.poll(inkOnPage).toBeGreaterThan(1000);
    expect(workspace()).toEqual(bare);
    await page.screenshot({ element: host, path: '__screenshots__/chart.browser.test.tsx/grid.png' });
  });
});

/** Pixels darker than 128 on every channel inside a client rect: label ink on a body's white fill. */
function darkPixels(canvas: HTMLCanvasElement, a: { x: number; y: number }, b: { x: number; y: number }): number {
  return countPixels(canvas, a, b, (r, g, bl) => r < 128 && g < 128 && bl < 128);
}

/** Pixels short of white inside a client rect: grid lines on the white page. */
function offWhitePixels(canvas: HTMLCanvasElement, a: { x: number; y: number }, b: { x: number; y: number }): number {
  return countPixels(canvas, a, b, (r, g, bl) => r < 252 || g < 252 || bl < 252);
}

function countPixels(
  canvas: HTMLCanvasElement, a: { x: number; y: number }, b: { x: number; y: number },
  test: (r: number, g: number, bl: number) => boolean,
): number {
  const px = readClientPixels(canvas, a, b);
  let n = 0;
  for (let i = 0; i < px.length; i += 4) if (test(px[i]!, px[i + 1]!, px[i + 2]!)) n++;
  return n;
}
