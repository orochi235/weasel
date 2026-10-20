import { expect, it } from 'vitest';
import { readClientPixels } from './canvasPixels';

// The app's renderer opens the canvas's context on its first paint, which can come after a test's first read.
it('leaves a canvas it reads before the app paints with the stencil buffer the renderer needs', () => {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  readClientPixels(canvas, { x: 0, y: 0 }, { x: 1, y: 1 });
  expect(canvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true })!.getContextAttributes()!.stencil).toBe(true);
  canvas.remove();
});
