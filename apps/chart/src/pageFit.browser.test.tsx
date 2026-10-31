/**
 * Until the view is moved, chart mode keeps the page fitted to the workspace: a workspace that resizes shows the page
 * refitted from the first frame its canvas has the new size, never the new size at the old fit.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { createScene } from '@weasel-js/core';
import '@weasel-js/theme/tokens.css';
import { CHART_LAYERS, CHART_REGISTRY, chartDoc, type ChartData, type ChartLayer, type ChartPose } from './chartDocument';
import { CHART_SCENE_KEY, chartToJson } from './chartPersistence';
import { at, colorAt } from './testing/canvasPixels';
import { mountChartApp, unmountChartApp } from './testing/mountChartApp';

/** A red box at (450, 330), 40 square. */
function seedChart(): void {
  const scene = createScene<ChartData, ChartLayer, ChartPose>({
    systemLayers: CHART_LAYERS, registry: CHART_REGISTRY, doc: chartDoc(),
    initial: [{
      id: 'a', kind: 'mark', layer: 'shapes', pose: { x: 430, y: 310, width: 40, height: 40 },
      data: { diagram: {}, fill: { paint: { color: '#ff0000' } } },
    }] as never,
  });
  localStorage.setItem(CHART_SCENE_KEY, chartToJson(scene));
}

beforeEach(async () => {
  await page.viewport(1280, 800);
  localStorage.clear();
});

afterEach(() => {
  unmountChartApp();
  localStorage.clear();
});

describe('WeaselChart page fit', () => {
  it('refits the page with the canvas when the workspace shrinks', async () => {
    seedChart();
    const { host, canvas } = await mountChartApp();
    expect(colorAt(canvas, at(host, 450, 330))).toBe('#ff0000');

    // Shrinks the workspace from the top, as the toolbar wrapping to a second row does.
    const spacer = document.createElement('div');
    spacer.style.height = '48px';
    spacer.style.flexShrink = '0';
    host.parentElement!.insertBefore(spacer, host);
    const frames: { resized: boolean; color: string }[] = [];
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => requestAnimationFrame(r));
      frames.push({
        resized: Math.abs(canvas.getBoundingClientRect().height - host.getBoundingClientRect().height) < 0.5,
        color: colorAt(canvas, at(host, 450, 330)),
      });
    }
    expect(frames.slice(0, 2).some((f) => f.resized)).toBe(true);
    expect(frames.filter((f) => f.resized).map((f) => f.color)).toEqual(frames.filter((f) => f.resized).map(() => '#ff0000'));
    spacer.remove();
  });
});
