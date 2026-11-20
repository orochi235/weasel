/**
 * The line pass at Earth's radius: a line 6.4e6 m out, the camera 10 m from it.
 * Packed against the eye it lands where the double-precision projection says
 * and stays there under a 1 mm camera move; packed against the world's origin,
 * the float32 view-projection's translation steps by about 0.4 m and the line
 * jumps by pixels.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  cameraFrame, cameraViewProjection, createCamera, createLinePass, packLines, projectPoint,
  type Camera3d, type Line3, type LinePass,
} from '@weasel-js/kernel3d';

const W = 160;
const H = 120;
const R = 6.4e6;
const MM = 0.001;

const passes: LinePass[] = [];
afterEach(() => {
  for (const p of passes) p.dispose();
  passes.length = 0;
});

/** A camera 10 m from a target `y` up, looking down -z. */
const cameraAt = (y: number): Camera3d => createCamera({ target: { x: 0, y, z: 0 }, distance: 10 });

/** A target height where a 1 mm rise moves the float32 copy of the absolute view-projection's translation a step:
 *  where an absolute draw jumps. */
function steppingHeight(): number {
  const f32 = (y: number) => Math.fround(cameraViewProjection(cameraAt(y), W / H)[13]);
  for (let y = R; ; y += MM) if (f32(y) !== f32(y + MM)) return y;
}

function draw(camera: Camera3d, lines: Line3[], relative: boolean): Uint8Array {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true, stencil: true })!;
  gl.viewport(0, 0, W, H);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const pass = createLinePass(gl);
  passes.push(pass);
  const size = { width: W, height: H };
  if (relative) {
    const frame = cameraFrame(camera, W / H);
    pass.draw(packLines(lines, frame.origin), frame.viewProjection, size);
  } else {
    pass.draw(packLines(lines), cameraViewProjection(camera, W / H), size);
  }
  const px = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return px;
}

/** Indices of the painted pixels, and their mean height in CSS pixels from the top. */
function inked(px: Uint8Array): { at: number[]; y: number } {
  const at: number[] = [];
  let sum = 0;
  for (let i = 0; i < W * H; i++) {
    if (px[i * 4 + 3] === 0) continue;
    at.push(i);
    sum += H - 1 - Math.floor(i / W) + 0.5;
  }
  return { at, y: at.length ? sum / at.length : NaN };
}

describe('the line pass far from the origin', () => {
  const y = steppingHeight();
  // 0.8 m below the target: 11.6 px, which leaves the shaft's edges 0.09 px from any pixel center.
  const lineY = y - 0.8;
  const lines: Line3[] = [{
    runs: [{ points: [{ x: -3, y: lineY, z: 0 }, { x: 3, y: lineY, z: 0 }] }], color: [1, 1, 1, 1], width: 4, head: null,
  }];
  const truth = (camera: Camera3d) => projectPoint({ x: 0, y: lineY, z: 0 }, { camera, width: W, height: H })!.y;
  /** The mean height of the rows whose centers fall inside a 4 px shaft centered at `t`. */
  const rowsAround = (t: number) => {
    const rows: number[] = [];
    for (let r = Math.ceil(t - 2.5); r + 0.5 <= t + 2; r++) if (r + 0.5 >= t - 2) rows.push(r + 0.5);
    return rows.reduce((a, b) => a + b, 0) / rows.length;
  };
  const before = cameraAt(y);
  const after = cameraAt(y + MM);

  it('draws a line packed against the eye where the doubles put it, and holds it under a 1 mm camera move', () => {
    const a = inked(draw(before, lines, true));
    const b = inked(draw(after, lines, true));
    expect(a.at.length).toBeGreaterThan(0);
    // Within 0.05 px: the shaft's ends shade a few pixels off its rows.
    expect(a.y).toBeCloseTo(rowsAround(truth(before)), 1);
    expect(b.at).toEqual(a.at);
  });

  it('jumps by pixels under the same move when packed against the world’s origin', () => {
    const a = inked(draw(before, lines, false));
    const b = inked(draw(after, lines, false));
    expect(Math.abs(b.y - a.y)).toBeGreaterThan(3);
  });
});
