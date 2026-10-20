/** Format › Theme in a real browser: the page and a shape repaint in the theme's colors, and one undo puts them back. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { DIAGRAM_THEMES } from '@weasel-js/diagram';
import { registerCanvasFont } from '@weasel-js/font';
import '@weasel-js/theme/tokens.css';
import { CHART_SCENE_KEY } from '../chartPersistence';
import { STENCIL_MIME } from '../stencilDrop';
import { at, colorAt } from '../testing/canvasPixels';
import { mountChartApp, unmountChartApp } from '../testing/mountChartApp';

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

/** Drops a Process stencil centered on world (400, 300), as a drag from the Shapes panel does. */
async function dropProcess(canvas: HTMLCanvasElement, host: HTMLElement): Promise<void> {
  const dt = new DataTransfer();
  dt.setData(STENCIL_MIME, 'process');
  const p = at(host, 400, 300);
  for (const type of ['dragenter', 'dragover', 'drop']) {
    canvas.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt, clientX: p.x, clientY: p.y }));
  }
  await expect.poll(() => (localStorage.getItem(CHART_SCENE_KEY) ?? '').includes('"container"')).toBe(true);
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
    await expect.poll(() => (localStorage.getItem(CHART_SCENE_KEY) ?? '').includes('"container"')).toBe(false);
  });
});
