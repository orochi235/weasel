/** A texture source the browser decodes. */
export type ImageTexSource = ImageBitmap | ImageData | HTMLCanvasElement | HTMLImageElement;

/**
 * Send `source` to the bound texture with premultiplied texels: the one
 * convention for an image texture. What samples one divides the alpha back out
 * before any color math (`STRAIGHT_RGB_GLSL`).
 *
 * The flag is put back because it would premultiply every later typed-array
 * upload too: the ramp atlas, a glyph page.
 */
export function uploadPremultiplied(gl: WebGL2RenderingContext, source: ImageTexSource): void {
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
}
