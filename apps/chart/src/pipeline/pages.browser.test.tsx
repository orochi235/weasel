/**
 * Pipeline mode's Page menu in a real browser: Add Page and Delete Page edit `doc.pages`, the editor
 * paints the pages and splits a wire between them, and each command is one undo step.
 */
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { layoutPages } from '@weasel-js/core';
import { canvasGl } from '@weasel-js/core/testing/canvasPixels';
import type { DiagramViewApi, DiagramViewProps } from '@weasel-js/diagram';
import { LOOK_THEME, type EffectDoc } from '@weasel-js/diagram/effect';
import { registerCanvasFont } from '@weasel-js/font';
import '@weasel-js/theme/tokens.css';
import { CHART_PAGE } from '../chartDocument';
import { choose } from '../testing/choose';
import { mountChartApp, unmountChartApp } from '../testing/mountChartApp';
import { PIPELINE_STORAGE_KEY } from './usePipelineDoc';

registerCanvasFont('sans-serif');

const live: { api: DiagramViewApi | null } = { api: null };

// EffectEditor keeps its DiagramViewApi private, so the test reads it through a spy wrapper.
vi.mock('../../../../packages/diagram/src/DiagramView', async (original) => {
  const real = await original<typeof import('../../../../packages/diagram/src/DiagramView')>();
  const Spy = forwardRef<DiagramViewApi, DiagramViewProps>(function Spy(props, ref) {
    const inner = useRef<DiagramViewApi | null>(null);
    useImperativeHandle(ref, () => inner.current!);
    return <real.DiagramView {...props} ref={(api) => { inner.current = api; live.api = api; }} />;
  });
  return { ...real, DiagramView: Spy };
});

beforeEach(async () => {
  await page.viewport(1280, 800);
  localStorage.clear();
});

afterEach(() => {
  unmountChartApp();
  live.api = null;
  localStorage.clear();
});

const saved = (): EffectDoc => JSON.parse(localStorage.getItem(PIPELINE_STORAGE_KEY) ?? '{}') as EffectDoc;
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/** The canvas pixel, RGBA, under the world point `x`, `y`, in the view the editor holds now. */
async function pixelAtWorld(x: number, y: number): Promise<number[]> {
  const canvas = document.querySelector<HTMLCanvasElement>('.wc-host canvas')!;
  const r = canvas.getBoundingClientRect();
  const v = live.api!.visible()!;
  const dpr = canvas.width / r.width;
  const px = Math.round(((x - v.x) / v.width) * r.width * dpr);
  const py = Math.round(((y - v.y) / v.height) * r.height * dpr);
  await frame();
  const out = new Uint8Array(4);
  const gl = canvasGl(canvas);
  gl.readPixels(px, canvas.height - 1 - py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
  return [...out];
}

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const near = (a: number[], b: number[]) => a.slice(0, 3).every((v, i) => Math.abs(v - b[i]!) <= 6);

const img = (id: string) => ({ id, title: id, inputs: [{ id: 'image', type: 'image' }], outputs: [{ id: 'out', type: 'image' }] });
const SIZE = { width: CHART_PAGE.width, height: CHART_PAGE.height };
const second = layoutPages([{ id: 'page-1', ...SIZE }, { id: 'page-2', ...SIZE }])[1]!;
const TWO_STAGES: EffectDoc = {
  pipeline: {
    stages: [img('a'), img('b')],
    wires: [{ id: 'w1', from: { stage: 'a', port: 'out' }, to: { stage: 'b', port: 'image' } }],
  },
  places: { a: { x: 100, y: 100 }, b: { x: second.x + 100, y: second.y + 100 } },
};

describe('WeaselChart pipeline pages', () => {
  it('adds pages from Page › Add Page and paints them', async () => {
    localStorage.setItem(PIPELINE_STORAGE_KEY, JSON.stringify(TWO_STAGES));
    await mountChartApp();
    await choose('Mode', /^Pipeline/);
    const middle = [second.x + SIZE.width / 2, second.y + 4] as const;
    await expect.poll(() => live.api?.visible() != null).toBe(true);
    expect(near(await pixelAtWorld(...middle), hex(LOOK_THEME.page))).toBe(false);
    await choose('Page', /^Add Page/);
    await choose('Page', /^Add Page/);
    await expect.poll(() => saved().pages).toEqual([{ id: 'page-1', ...SIZE }, { id: 'page-2', ...SIZE }]);
    await expect.poll(async () => near(await pixelAtWorld(...middle), hex(LOOK_THEME.page))).toBe(true);
  });

  it('splits a wire between the pages, deletes the last page keeping every stage, and undoes it', async () => {
    localStorage.setItem(PIPELINE_STORAGE_KEY, JSON.stringify(TWO_STAGES));
    await mountChartApp();
    await choose('Mode', /^Pipeline/);
    await choose('Page', /^Add Page/);
    await choose('Page', /^Add Page/);
    const tags = () => ['w1/offpage-from', 'w1/offpage-to'].map((id) => live.api?.rectOf(id) != null);
    await expect.poll(tags).toEqual([true, true]);

    await choose('Page', /^Delete Page/);
    await expect.poll(() => saved().pages?.length).toBe(1);
    expect(saved().pipeline.stages.map((s) => s.id)).toEqual(['a', 'b']);

    await choose('Edit', /^Undo/);
    await expect.poll(() => saved().pages?.length).toBe(2);
  });
});
