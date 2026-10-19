/**
 * Pipeline mode in a real browser: the Edit menu and the undo keys reach the pipeline doc through
 * the editor's own canvas.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { registerCanvasFont } from '@weasel-js/font';
import { isApplePlatform } from '@weasel-js/gestures';
import '@weasel-js/theme/tokens.css';
import { mountChartApp, unmountChartApp } from '../testing/mountChartApp';
import { PIPELINE_STORAGE_KEY } from './usePipelineDoc';

registerCanvasFont('sans-serif');

beforeEach(async () => {
  await page.viewport(1280, 800);
  localStorage.clear();
});

afterEach(() => {
  unmountChartApp();
  localStorage.clear();
});

/** The stage ids the pipeline doc last saved. */
function stages(): string[] {
  const raw = localStorage.getItem(PIPELINE_STORAGE_KEY);
  return raw ? (JSON.parse(raw) as { pipeline: { stages: { id: string }[] } }).pipeline.stages.map((s) => s.id) : [];
}

async function choose(menu: string, row: RegExp): Promise<void> {
  await userEvent.click(page.getByRole('menubar').getByRole('menuitem', { name: menu }));
  const item = [...document.querySelectorAll<HTMLElement>('[role="menu"] [role^="menuitem"]')]
    .find((el) => row.test(el.textContent ?? ''));
  await userEvent.click(item!);
}

describe('WeaselChart pipeline mode', () => {
  it('deletes the selected stage from Edit › Delete, and Mod+Z on the canvas brings it back', async () => {
    await mountChartApp();
    await choose('Mode', /^Pipeline/);
    await expect.element(page.getByRole('grid', { name: 'Stages' })).toBeVisible();
    await userEvent.click(page.getByRole('row', { name: 'Source' }));
    await userEvent.click(page.getByRole('row', { name: 'Blur' }));
    await expect.poll(stages).toEqual(['source', 'blur']);
    // A stage added from the palette is selected.
    await expect.element(page.getByText('Blur params')).toBeVisible();

    await choose('Edit', /^Delete/);
    await expect.poll(stages).toEqual(['source']);

    // A click on open canvas, below the stages, focuses it; real key presses, so the held modifier registers.
    const canvas = document.querySelector<HTMLCanvasElement>('.wc-host canvas')!;
    const { width, height } = canvas.getBoundingClientRect();
    await userEvent.click(canvas, { position: { x: width - 20, y: height - 20 } });
    await userEvent.keyboard(isApplePlatform() ? '{Meta>}z{/Meta}' : '{Control>}z{/Control}');
    await expect.poll(stages).toEqual(['source', 'blur']);
  });

  it('places stages added from the palette inside the view, clear of each other', async () => {
    await mountChartApp();
    await choose('Mode', /^Pipeline/);
    for (const name of ['Source', 'Blur', 'Composite']) await userEvent.click(page.getByRole('row', { name }));
    await expect.poll(stages).toHaveLength(3);
    const places = (JSON.parse(localStorage.getItem(PIPELINE_STORAGE_KEY)!) as { places: Record<string, { x: number; y: number }> }).places;
    const xs = ['source', 'blur', 'composite'].map((id) => places[id]!.x);
    expect(xs[0]).toBeGreaterThan(0);
    expect(xs[1]).toBeGreaterThan(xs[0]!);
    expect(xs[2]).toBeGreaterThan(xs[1]!);
    expect(Math.max(...xs)).toBeLessThan(document.querySelector('.wc-host')!.getBoundingClientRect().width);
  });
});
