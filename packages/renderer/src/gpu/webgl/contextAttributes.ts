/** What the renderer opens a canvas's WebGL2 context with: a stencil, which every path fill needs, and a
 *  preserved buffer, so the canvas reads back after its frame was shown. Core's
 *  `CANVAS_CONTEXT_ATTRIBUTES` asks for the same, and a test holds the two equal. */
export const RENDERER_CONTEXT_ATTRIBUTES: Readonly<WebGLContextAttributes> = Object.freeze({
  preserveDrawingBuffer: true,
  stencil: true,
});
