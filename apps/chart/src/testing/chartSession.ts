/**
 * What every chart-mode browser test shares: the page it mounts on, the chart as the session store
 * saved it, and the gestures and pixel reads the tests drive the canvas with. The page and
 * `userEvent` come from the caller, so this file imports nothing from vitest/browser.
 */
import { afterEach, beforeEach, expect } from 'vitest';
import { DIAGRAM_THEMES, isDiagramBody } from '@weasel-js/diagram';
import { registerCanvasFont } from '@weasel-js/font';
import '@weasel-js/theme/tokens.css';
import { at, readClientPixels } from './canvasPixels';
import { unmountChartApp } from './mountChartApp';
import { savedContent } from './savedChart';
import { drag } from './pointer';

export const paper = DIAGRAM_THEMES.paper!;

interface Roles<L> {
  getByRole(role: 'toolbar' | 'button', options: { name: string | RegExp }): L;
}
/** vitest/browser's `page` and `userEvent`, with `L` its `Locator`. */
interface BrowserApi<L extends Roles<L>> {
  page: Roles<L> & { viewport(width: number, height: number): Promise<unknown> };
  userEvent: { click(target: L): Promise<unknown> };
}

/**
 * A 1280 by 800 page and a cleared store around every test of the file that calls it, and the
 * helpers that click through the caller's `page` and `userEvent`.
 */
export function chartSession<L extends Roles<L>>({ page, userEvent }: BrowserApi<L>) {
  registerCanvasFont('sans-serif');
  beforeEach(async () => {
    await page.viewport(1280, 800);
    localStorage.clear();
  });
  afterEach(() => {
    unmountChartApp();
    localStorage.clear();
  });

  const useTool = (name: string) => userEvent.click(page.getByRole('toolbar', { name: 'Tools' }).getByRole('button', { name: new RegExp(`^${name}`) }));

  /** Two Process bodies, 120 by 60: one from world (100, 100), one from (500, 100). */
  async function twoBodies(host: HTMLElement, canvas: HTMLCanvasElement): Promise<string[]> {
    await userEvent.click(page.getByRole('toolbar', { name: 'Flowchart' }).getByRole('button', { name: 'Process' }));
    await drag(canvas, at(host, 100, 100), at(host, 220, 160));
    await expect.poll(() => bodies().length).toBe(1);
    await drag(canvas, at(host, 500, 100), at(host, 620, 160));
    await expect.poll(() => bodies().length).toBe(2);
    return bodies().map((b) => b.id);
  }

  return { useTool, twoBodies };
}

export interface SavedNode {
  id: string; kind: string; parent?: string | null; dependsOn?: string[]; data: Record<string, unknown>;
  pose?: { x: number; y: number; width: number; height: number };
}

/** The chart as the session store last saved it. */
export const saved = (): SavedNode[] => savedContent<SavedNode>();
export const bodies = () => saved().filter(isDiagramBody);
export const poseOf = (id: string) => saved().find((n) => n.id === id)!.pose!;
export const edges = () => saved().filter((n) => {
  const d = n.data.diagram as { from?: unknown } | undefined;
  return d !== undefined && 'from' in d;
});

export const key = (k: string): void => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  window.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true, cancelable: true }));
};

export const editor = (): HTMLElement | null => document.querySelector('.wc-host [contenteditable="true"]');


/** Pixels darker than 128 on every channel inside a client rect: label ink on a body's white fill. */
export function darkPixels(canvas: HTMLCanvasElement, a: { x: number; y: number }, b: { x: number; y: number }): number {
  return countPixels(canvas, a, b, (r, g, bl) => r < 128 && g < 128 && bl < 128);
}

/** Pixels short of white inside a client rect: grid lines on the white page. */
export function offWhitePixels(canvas: HTMLCanvasElement, a: { x: number; y: number }, b: { x: number; y: number }): number {
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
