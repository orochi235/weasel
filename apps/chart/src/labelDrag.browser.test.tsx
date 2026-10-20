/**
 * Edge label dragging in chart mode: a drag on a connector's label pins it along and beside the connector, a
 * click on it selects the connector, and Format › Connector › Reset label puts it back.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createScene, derivedDepOf, effectivePose, type RectPose } from '@weasel-js/core';
import { EDGE_DERIVE_PATH, LABEL_PLACEMENT, edgeLabelSpec } from '@weasel-js/diagram';
import { registerCanvasFont } from '@weasel-js/font';
import { isApplePlatform } from '@weasel-js/gestures';
import '@weasel-js/theme/tokens.css';
import { CHART_LAYERS, CHART_REGISTRY, chartDoc, type ChartData, type ChartLayer, type ChartPose } from './chartDocument';
import { CHART_SCENE_KEY, chartFromJson, chartToJson } from './chartPersistence';
import { at, readClientPixels } from './testing/canvasPixels';
import { mountChartApp, unmountChartApp } from './testing/mountChartApp';

registerCanvasFont('sans-serif');

const LABEL_ID = 'ab/label';

const box = (id: string, x: number, y: number) => ({
  id, kind: 'leaf', layer: 'shapes', pose: { x, y, width: 100, height: 60 }, data: { diagram: {} },
});

const connector = (id: string, from: string, to: string, color: string) => ({
  id, kind: 'leaf', layer: 'shapes', pose: { x: 0, y: 0, width: 0, height: 0 },
  data: { diagram: { from: {}, to: {}, router: 'straight' }, stroke: { paint: { color }, width: 3 } },
  dependsOn: [from, to], derivePath: EDGE_DERIVE_PATH,
});

const chartScene = (initial: unknown[]) => createScene<ChartData, ChartLayer, ChartPose>({
  systemLayers: CHART_LAYERS, registry: CHART_REGISTRY, doc: chartDoc(), initial: initial as never,
});

/** A red connector along y = 330 from box `a` to box `b`, labeled Yes above its middle. */
function seedChart(): void {
  const scene = chartScene([
    box('a', 200, 300), box('b', 600, 300), connector('ab', 'a', 'b', '#ff0000'),
    edgeLabelSpec('ab', 'Yes', { layer: 'shapes' }),
  ]);
  localStorage.setItem(CHART_SCENE_KEY, chartToJson(scene));
}

const savedText = () => localStorage.getItem(CHART_SCENE_KEY) ?? '{"nodes":[]}';
const savedNode = (id: string) =>
  (JSON.parse(savedText()) as { nodes: { id: string; data: Record<string, unknown>; pose?: RectPose }[] }).nodes
    .find((n) => n.id === id);
const savedLabel = () => (savedNode(LABEL_ID)?.data.diagram as { label?: Record<string, unknown> } | undefined)?.label;

const savedScene = () => chartScene(chartFromJson(savedText()).specs);

/** The label's pose, from the saved chart rebuilt into a scene. */
function labelPose(): RectPose {
  const scene = savedScene();
  return effectivePose(scene, scene.get(LABEL_ID as never)!) as RectPose;
}

const centerOf = (r: RectPose) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

/** The label's center in client pixels. */
function labelCenter(host: HTMLElement): { x: number; y: number } {
  const c = centerOf(labelPose());
  return at(host, c.x, c.y);
}

/**
 * Where a label `size` big stands at fraction `t` and `offset` along the straight connector `ab`, worked out here
 * from the connector's own route rather than by the kit's label code: its near side sits `offset` off the line, to
 * the left of travel.
 */
function expectedCenter(t: number, offset: number, size: RectPose): { x: number; y: number } {
  const path = derivedDepOf(savedScene(), 'ab' as never)!.path as { kind: string; coords: ArrayLike<number> };
  expect(path.kind).toBe('polygon');
  const c = path.coords;
  expect(c.length).toBe(4);
  const d = { x: c[2]! - c[0]!, y: c[3]! - c[1]! };
  const len = Math.hypot(d.x, d.y);
  const n = { x: d.y / len, y: -d.x / len };
  const reach = offset + Math.sign(offset) * (Math.abs(n.x) * size.width + Math.abs(n.y) * size.height) / 2;
  return { x: c[0]! + d.x * t + n.x * reach, y: c[1]! + d.y * t + n.y * reach };
}

/** Whether any pixel within 8 of a client point is the route handles' blue. */
function inked(canvas: HTMLCanvasElement, p: { x: number; y: number }): boolean {
  const px = readClientPixels(canvas, { x: p.x - 8, y: p.y - 8 }, { x: p.x + 8, y: p.y + 8 });
  for (let i = 0; i < px.length; i += 4) if (px[i]! < 110 && px[i + 2]! > 170) return true;
  return false;
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

function click(el: Element, p: { x: number; y: number }): void {
  pointer(el, 'pointerdown', p);
  pointer(el, 'pointerup', p);
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: p.x, clientY: p.y }));
}

const frames = async (n: number) => {
  for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r));
};

beforeEach(async () => {
  await page.viewport(1280, 800);
  localStorage.clear();
});

afterEach(() => {
  unmountChartApp();
  localStorage.clear();
});

describe('WeaselChart edge label dragging', () => {
  it('drags a connector label, keeps it on a reroute, and resets it', async () => {
    seedChart();
    const { host, canvas } = await mountChartApp();

    await drag(canvas, labelCenter(host), at(host, 450, 370));
    await expect.poll(() => savedLabel()?.dodge).toBe(false);
    const dragged = savedLabel()!;
    expect(dragged.at as number).toBeCloseTo(0.5, 1);
    expect(dragged.offset as number).toBeLessThan(0);
    const before = centerOf(labelPose());

    // Box b up by 70: the connector now climbs from a to b, its middle at (450, 295).
    await drag(canvas, at(host, 650, 330), at(host, 650, 260));
    await expect.poll(() => savedNode('b')!.pose!.y).toBeLessThan(260);
    await frames(2);
    expect(savedLabel()).toEqual(dragged);
    const moved = labelPose();
    const want = expectedCenter(dragged.at as number, dragged.offset as number, moved);
    expect(Math.hypot(centerOf(moved).x - want.x, centerOf(moved).y - want.y)).toBeLessThan(1.5);
    expect(Math.hypot(centerOf(moved).x - before.x, centerOf(moved).y - before.y)).toBeGreaterThan(10);

    const middle = at(host, 450, 295);
    click(canvas, at(host, 1000, 700));
    await frames(2);
    expect(inked(canvas, middle)).toBe(false);
    click(canvas, labelCenter(host));
    await expect.poll(() => inked(canvas, middle)).toBe(true);

    await userEvent.click(page.getByRole('menuitem', { name: 'Format' }));
    await userEvent.click(page.getByRole('menuitem', { name: /^Connector/ }));
    await userEvent.click(page.getByRole('menuitem', { name: /^Reset label/ }));
    await expect.poll(savedLabel).toEqual(LABEL_PLACEMENT);

    const { width, height } = canvas.getBoundingClientRect();
    await userEvent.click(canvas, { position: { x: width - 20, y: height - 20 } });
    await userEvent.keyboard(isApplePlatform() ? '{Meta>}z{/Meta}' : '{Control>}z{/Control}');
    await expect.poll(savedLabel).toEqual(dragged);
  });
});
