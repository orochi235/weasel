import { afterEach, expect, it } from 'vitest';
import { CANVAS_CONTEXT_ATTRIBUTES } from '../canvas/contextAttributes';
import { canvasGl, pixelAt, readCanvas } from './canvasPixels';

let canvas: HTMLCanvasElement;

afterEach(() => {
  canvasGl(canvas).getExtension('WEBGL_lose_context')?.loseContext();
  canvas.remove();
});

function fresh(width = 4, height = 4): HTMLCanvasElement {
  canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  document.body.appendChild(canvas);
  return canvas;
}

it('leaves a canvas it reads before the first paint with the context the renderer asks for', () => {
  readCanvas(fresh(), 0, 0, 1, 1);
  const attrs = canvas.getContext('webgl2', CANVAS_CONTEXT_ATTRIBUTES)!.getContextAttributes()!;
  expect(attrs.stencil).toBe(true);
  expect(attrs.preserveDrawingBuffer).toBe(true);
});

it('counts rows from the top', () => {
  const gl = canvasGl(fresh(2, 2));
  gl.enable(gl.SCISSOR_TEST);
  gl.scissor(0, 1, 2, 1); // GL's top row
  gl.clearColor(1, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  expect(pixelAt(canvas, 0, 0)).toEqual([255, 0, 0, 255]);
  expect(pixelAt(canvas, 0, 1)).toEqual([0, 0, 0, 0]);
  expect(Array.from(readCanvas(canvas, 1, 0, 1, 2))).toEqual([0, 0, 0, 0, 255, 0, 0, 255]);
});
