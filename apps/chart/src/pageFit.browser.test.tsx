/**
 * Until the view is moved, chart mode keeps the page fitted to the workspace, and a workspace that resizes shows the
 * page refitted in the frame it resized in, never the old fit for a frame.
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
  it('refits the page in the frame the workspace shrinks in', async () => {
    seedChart();
    const { host, canvas } = await mountChartApp();
    expect(colorAt(canvas, at(host, 450, 330))).toBe('#ff0000');
    const before = host.getBoundingClientRect().height;

    // Shrinks the workspace from the top, as the toolbar wrapping to a second row does.
    const shown = new Promise<string>((resolve) => {
      const observer = new ResizeObserver(() => {
        if (host.getBoundingClientRect().height === before) return;
        observer.disconnect();
        resolve(colorAt(canvas, at(host, 450, 330)));
      });
      observer.observe(host);
    });
    const spacer = document.createElement('div');
    spacer.style.height = '48px';
    spacer.style.flexShrink = '0';
    host.parentElement!.insertBefore(spacer, host);
    expect(await shown).toBe('#ff0000');
    spacer.remove();
  });
});
