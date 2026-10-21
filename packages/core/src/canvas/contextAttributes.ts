/**
 * What a canvas's WebGL2 context is opened with. A context keeps the attributes of whoever opened it
 * first, and the renderer refuses one without a stencil buffer, so anything that may open a weasel
 * canvas before its first paint (a pixel reader in a test, a tenant sharing the buffer) asks for these.
 */
export const CANVAS_CONTEXT_ATTRIBUTES: Readonly<WebGLContextAttributes> = Object.freeze({
  preserveDrawingBuffer: true,
  stencil: true,
});
