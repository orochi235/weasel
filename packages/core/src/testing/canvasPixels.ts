import { CANVAS_CONTEXT_ATTRIBUTES } from '../canvas/contextAttributes';

/**
 * Reading back what a weasel canvas painted, from a browser test. A read can come before the app's first
 * paint, and the context it opens then is the one the renderer gets, so every read goes through `canvasGl`.
 */

/** The canvas's WebGL2 context, opened with the renderer's attributes if nothing has opened it yet. */
export function canvasGl(canvas: HTMLCanvasElement): WebGL2RenderingContext {
  const gl = canvas.getContext('webgl2', CANVAS_CONTEXT_ATTRIBUTES);
  if (!gl) throw new Error('canvasGl: the canvas has no WebGL2 context, or holds another kind');
  return gl;
}

/** RGBA bytes of a device-pixel rect whose corner `(x, y)` counts from the top-left; bottom row first. */
export function readCanvas(canvas: HTMLCanvasElement, x: number, y: number, width: number, height: number): Uint8Array {
  const gl = canvasGl(canvas);
  const out = new Uint8Array(width * height * 4);
  gl.readPixels(x, canvas.height - y - height, width, height, gl.RGBA, gl.UNSIGNED_BYTE, out);
  return out;
}

/** RGBA at one device pixel, counted from the top-left. */
export function pixelAt(canvas: HTMLCanvasElement, x: number, y: number): number[] {
  return Array.from(readCanvas(canvas, x, y, 1, 1));
}
