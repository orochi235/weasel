/**
 * Line jumps in chart mode: Format › Connector › Line jumps makes the connector drawn on top bow over the one it
 * crosses, so its ink leaves its own line at the crossing.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createScene } from '@weasel-js/core';
import { EDGE_DERIVE_PATH, HOPS_DOC_KEY } from '@weasel-js/diagram';
import { registerCanvasFont } from '@weasel-js/font';
import '@weasel-js/theme/tokens.css';
import { CHART_LAYERS, CHART_REGISTRY, chartDoc, type ChartData, type ChartLayer, type ChartPose } from './chartDocument';
import { CHART_SCENE_KEY, chartToJson } from './chartPersistence';
import { at, readClientPixels } from './testing/canvasPixels';
import { mountChartApp, unmountChartApp } from './testing/mountChartApp';

registerCanvasFont('sans-serif');

const box = (id: string, x: number, y: number) => ({
  id, kind: 'mark', layer: 'shapes', pose: { x, y, width: 100, height: 60 }, data: { diagram: {} },
});

const connector = (id: string, from: string, to: string, color: string) => ({
  id, kind: 'mark', layer: 'shapes', pose: { x: 0, y: 0, width: 0, height: 0 },
  data: { diagram: { from: {}, to: {}, router: 'straight' }, stroke: { paint: { color }, width: 3 } },
  dependsOn: [from, to], derivePath: EDGE_DERIVE_PATH,
});

/** A blue connector down x = 450 from y = 160 to 500, and a red one drawn over it along y = 330 from x = 300 to 600. */
function seedChart(): void {
  const scene = createScene<ChartData, ChartLayer, ChartPose>({
    systemLayers: CHART_LAYERS, registry: CHART_REGISTRY, doc: chartDoc(),
    initial: [
      box('a', 200, 300), box('b', 600, 300), box('c', 400, 100), box('d', 400, 500),
      connector('cd', 'c', 'd', '#0000ff'), connector('ab', 'a', 'b', '#ff0000'),
    ] as never,
  });
  localStorage.setItem(CHART_SCENE_KEY, chartToJson(scene));
}

/** Whether any pixel within a pixel of a client point is red: the upper connector's ink. */
function red(canvas: HTMLCanvasElement, p: { x: number; y: number }): boolean {
  const px = readClientPixels(canvas, { x: p.x - 1, y: p.y - 1 }, { x: p.x + 2, y: p.y + 2 });
  for (let i = 0; i < px.length; i += 4) if (px[i]! > 180 && px[i + 1]! < 120 && px[i + 2]! < 120) return true;
  return false;
}

const saved = () => JSON.parse(localStorage.getItem(CHART_SCENE_KEY) ?? '{}') as { doc?: Record<string, unknown> };

beforeEach(async () => {
  await page.viewport(1280, 800);
  localStorage.clear();
});

afterEach(() => {
  unmountChartApp();
  localStorage.clear();
});

describe('WeaselChart line jumps', () => {
  it('bows the upper connector over the crossing once Line jumps is on', async () => {
    seedChart();
    const { host, canvas } = await mountChartApp();
    const crossing = at(host, 450, 330);
    const apex = at(host, 450, 325);
    // The fitted frame lands after mount on its own schedule, so the pixels are polled.
    await expect.poll(() => [red(canvas, crossing), red(canvas, apex)]).toEqual([true, false]);

    await userEvent.click(page.getByRole('menuitem', { name: 'Format' }));
    await userEvent.click(page.getByRole('menuitem', { name: /^Connector/ }));
    await userEvent.click(page.getByRole('menuitemcheckbox', { name: /^Line jumps/ }));
    await expect.poll(() => saved().doc?.[HOPS_DOC_KEY]).toEqual({ size: 5 });
    await expect.poll(() => [red(canvas, crossing), red(canvas, apex)]).toEqual([false, true]);
  });
});
