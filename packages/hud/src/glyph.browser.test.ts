/**
 * A glyph drawn by `glyphCommands` against real WebGL2: what reaches the framebuffer. The unit
 * tests read the command tree; a transform or clip the renderer reads differently looks the same
 * there.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { WeaselRenderer, type DrawCommand } from '@weasel-js/core/renderer';
import { glyphCommands } from './glyph';

const SIZE = 40;
let renderer: WeaselRenderer | undefined;
afterEach(() => { renderer?.dispose(); renderer = undefined; });

function paint(commands: DrawCommand[]): (x: number, y: number) => number {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const gl = canvas.getContext('webgl2', { stencil: true })!;
  renderer = new WeaselRenderer({ gl, width: SIZE, height: SIZE, dpr: 1 });
  renderer.render(commands);
  const px = new Uint8Array(SIZE * SIZE * 4);
  gl.readPixels(0, 0, SIZE, SIZE, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return (x, y) => px[((SIZE - 1 - y) * SIZE + x) * 4 + 3]!;
}

const glyph = (body: string) => ({ body, group: '', tags: [] });

describe('glyphCommands, in a real context', () => {
  it('fills a currentColor shape where the scaled viewBox puts it, and nowhere else', () => {
    const at = paint(glyphCommands(glyph('<circle cx="10" cy="10" r="5" fill="currentColor" stroke="none"/>'),
      { x: 0, y: 0, size: SIZE, color: '#ff0000' }));
    expect(at(20, 20)).toBe(255);
    expect(at(3, 3)).toBe(0);
  });

  it('clips a stroke to a nested svg and turns it with a rotate', () => {
    const body = '<g transform="rotate(90 10 10)"><svg x="0" y="0" width="10" height="20" viewBox="0 0 10 20">'
      + '<path d="M0 10 H20" stroke-width="4" stroke-linecap="butt"/></svg></g>';
    const at = paint(glyphCommands(glyph(body), { x: 0, y: 0, size: SIZE, color: '#ff0000' }));
    // The horizontal stroke, turned upright, runs down x = 20; the clip keeps its left half, which
    // the rotation carries to the top.
    expect(at(20, 8)).toBe(255);
    expect(at(20, 32)).toBe(0);
    expect(at(8, 20)).toBe(0);
  });
});
