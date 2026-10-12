/**
 * Even-odd paths wherever the renderer writes the stencil for itself: a clip,
 * an aligned stroke's silhouette, and a vertex-colored fill. Such a path
 * tessellates to one fan per contour, so only a parity pass cuts its holes —
 * and a call-sequence test cannot tell a hole from a fill.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { pathFromD } from '@weasel-js/geom';
import { WeaselRenderer } from './WeaselRenderer';
import type { DrawCommand } from './DrawCommand';

const SIZE = 16;
const CLEAR = [0, 0, 0, 0];
const RED = [255, 0, 0, 255];

/** A square ring: the hole spans 4..12 on both axes. */
function ring(): DrawCommand & { kind: 'path' } {
  return {
    kind: 'path',
    path: { ...pathFromD('M0 0 L16 0 L16 16 L0 16 Z M4 4 L12 4 L12 12 L4 12 Z'), fillRule: 'evenodd' },
  };
}

let renderer: WeaselRenderer | undefined;

afterEach(() => {
  renderer?.dispose();
  renderer = undefined;
});

/** Render `commands` and return a reader for one CSS pixel, top-left origin. */
function paint(commands: DrawCommand[]): (x: number, y: number) => number[] {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const gl = canvas.getContext('webgl2', { stencil: true })!;
  renderer = new WeaselRenderer({ gl, width: SIZE, height: SIZE, dpr: 1 });
  renderer.render(commands);
  const px = new Uint8Array(SIZE * SIZE * 4);
  gl.readPixels(0, 0, SIZE, SIZE, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return (x, y) => {
    const i = ((SIZE - 1 - y) * SIZE + x) * 4;
    return Array.from(px.slice(i, i + 4));
  };
}

describe('an even-odd path with a hole, in a real context', () => {
  it('fills around the hole', () => {
    const at = paint([{ ...ring(), fill: { color: '#ff0000' } }]);
    expect(at(2, 8)).toEqual(RED);
    expect(at(8, 8)).toEqual(CLEAR);
  });

  it('clips its children out of the hole', () => {
    const at = paint([{
      kind: 'group',
      clip: ring().path,
      children: [{
        kind: 'path',
        path: { kind: 'rect', x: 0, y: 0, width: SIZE, height: SIZE },
        fill: { color: '#ff0000' },
      }],
    }]);
    expect(at(2, 8)).toEqual(RED);
    expect(at(8, 8)).toEqual(CLEAR);
  });

  it('leaves no clip behind for what is drawn after the group', () => {
    const at = paint([
      { kind: 'group', clip: ring().path, children: [{ ...ring(), fill: { color: '#ff0000' } }] },
      { ...ring(), fill: { color: '#ff0000' } },
      { kind: 'path', path: pathFromD('M6 6 L10 6 L8 10 Z'), fill: { color: '#ff0000' } },
    ]);
    expect(at(8, 7)).toEqual(RED);
    expect(at(5, 11)).toEqual(CLEAR);
  });

  it('keeps an inner stroke out of the hole', () => {
    const at = paint([{ ...ring(), stroke: { paint: { color: '#ff0000' }, width: 2, align: 'inner' } }]);
    expect(at(1, 8)).toEqual(RED);
    expect(at(3, 8)).toEqual(RED);
    expect(at(5, 8)).toEqual(CLEAR);
  });

  it('puts an outer stroke inside the hole', () => {
    const at = paint([{ ...ring(), stroke: { paint: { color: '#ff0000' }, width: 2, align: 'outer' } }]);
    expect(at(5, 8)).toEqual(RED);
    expect(at(3, 8)).toEqual(CLEAR);
  });

  it('fills around the hole with vertex colors', () => {
    const colors = Array.from({ length: 8 }, () => [1, 0, 0, 1]).flat();
    const at = paint([{ ...ring(), fill: { color: '#ffffff' }, vertexColors: colors }]);
    expect(at(2, 8)).toEqual(RED);
    expect(at(8, 8)).toEqual(CLEAR);
  });
});
