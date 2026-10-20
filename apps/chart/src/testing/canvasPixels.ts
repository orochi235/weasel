import { fitViewToBounds } from '@weasel-js/core';
import { CHART_PAGE } from '../chartDocument';

/** Client point of a world point: the page is fitted to the workspace with 24px of padding, at a zoom the fit
 *  rounds to a step. */
export function at(host: HTMLElement, x: number, y: number): { x: number; y: number } {
  const box = host.getBoundingClientRect();
  const view = fitViewToBounds({ x: 0, y: 0, ...CHART_PAGE }, box, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { padding: 24 });
  return { x: box.left + (x - view.x) * view.scale.x, y: box.top + (y - view.y) * view.scale.y };
}

/** The RGBA bytes the canvas drew inside a client rect, bottom row first. */
export function readClientPixels(canvas: HTMLCanvasElement, a: { x: number; y: number }, b: { x: number; y: number }): Uint8Array {
  const gl = canvas.getContext('webgl2')!;
  const box = canvas.getBoundingClientRect();
  const dpr = canvas.width / box.width;
  const x0 = Math.round((a.x - box.left) * dpr);
  const x1 = Math.round((b.x - box.left) * dpr);
  const y0 = Math.round((a.y - box.top) * dpr);
  const y1 = Math.round((b.y - box.top) * dpr);
  const px = new Uint8Array((x1 - x0) * (y1 - y0) * 4);
  gl.readPixels(x0, canvas.height - y1, x1 - x0, y1 - y0, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return px;
}

/** The color the canvas drew at one client point, as `#rrggbb`. */
export function colorAt(canvas: HTMLCanvasElement, p: { x: number; y: number }): string {
  const px = readClientPixels(canvas, p, { x: p.x + 1, y: p.y + 1 });
  return `#${[...px.slice(0, 3)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}
