/**
 * The line pass under a perspective camera, read back pixel by pixel: a trim
 * leaves only its window, the head is wider than the shaft at the window's
 * front, and neither an end behind the eye nor a head longer than its segment
 * throws a triangle across the screen.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { lengthTable } from '@weasel-js/geom';
import { pointAtLength, type Vec3 } from '@weasel-js/geom/3d';
import { cameraEye, cameraViewProjection, createCamera, projectPoint, packLines, type Line3, createLinePass, type LinePass } from '@weasel-js/kernel3d';

const W = 160;
const H = 120;
const camera = createCamera({ target: { x: 0, y: 0, z: 0 }, distance: 6, yaw: 0.5, pitch: 0.45 });
const viewport = { camera, width: W, height: H };

const passes: LinePass[] = [];
afterEach(() => {
  for (const p of passes) p.dispose();
  passes.length = 0;
});

function draw(lines: Line3[]): Uint8Array {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true, stencil: true })!;
  gl.viewport(0, 0, W, H);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const pass = createLinePass(gl);
  passes.push(pass);
  pass.draw(packLines(lines), cameraViewProjection(camera, W / H), { width: W, height: H });
  const px = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return px;
}

type P = { x: number; y: number };
const screen = (p: Vec3): P => projectPoint(p, viewport)!;
/** Whether the pixel under CSS point `p` (top-left origin) was painted. */
const inked = (px: Uint8Array, p: P): boolean => {
  const x = Math.floor(p.x);
  const y = H - 1 - Math.floor(p.y);
  return x >= 0 && x < W && y >= 0 && y < H && px[(y * W + x) * 4 + 3] > 0;
};
const painted = (px: Uint8Array): P[] => {
  const out: P[] = [];
  for (let i = 0; i < W * H; i++) if (px[i * 4 + 3] > 0) out.push({ x: i % W + 0.5, y: H - 1 - Math.floor(i / W) + 0.5 });
  return out;
};
const unit = (a: P, b: P): P => {
  const l = Math.hypot(b.x - a.x, b.y - a.y);
  return { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
};
const offset = (p: P, d: P, along: number, across: number): P =>
  ({ x: p.x + d.x * along - d.y * across, y: p.y + d.y * along + d.x * across });

const BENT: Vec3[] = [{ x: -2, y: 0, z: 0 }, { x: 0, y: 0, z: 1.2 }, { x: 2, y: 0, z: 0 }];
const at = (points: Vec3[], f: number): Vec3 => {
  const t = lengthTable([{ points: points.flatMap((p) => [p.x, p.y, p.z]), closed: false }], 3);
  return pointAtLength(t, f * t.total).point;
};

describe('the line pass', () => {
  it('draws only the trimmed window, with the head at its front wider than the shaft', () => {
    const px = draw([{ runs: [{ points: BENT }], color: [1, 0.2, 0.1, 1], width: 4, trim: { start: 0.2, end: 0.8 } }]);
    expect(inked(px, screen(at(BENT, 0.5)))).toBe(true);
    expect(inked(px, screen(at(BENT, 0.3)))).toBe(true);
    expect(inked(px, screen(at(BENT, 0.08)))).toBe(false);
    expect(inked(px, screen(at(BENT, 0.95)))).toBe(false);

    const tip = screen(at(BENT, 0.8));
    const back = unit(tip, screen(at(BENT, 0.7)));
    // 10 px back from the tip the head is 10 * 7/16 = 4.4 px either side; the shaft is 2.
    expect(inked(px, offset(tip, back, 10, 3.2))).toBe(true);
    expect(inked(px, offset(tip, back, 10, -3.2))).toBe(true);
    const mid = screen(at(BENT, 0.3));
    const along = unit(mid, screen(at(BENT, 0.25)));
    expect(inked(px, offset(mid, along, 0, 3.2))).toBe(false);
    expect(inked(px, offset(mid, along, 0, 1))).toBe(true);
  });

  it('drops a segment with an end behind the eye rather than drawing it across the screen', () => {
    const eye = cameraEye(camera);
    const behind = { x: eye.x * 1.5, y: eye.y * 1.5, z: eye.z * 1.5 };
    const px = draw([{ runs: [{ points: [{ x: 0, y: 0, z: 0 }, behind] }], color: [1, 1, 1, 1], width: 6 }]);
    expect(painted(px)).toEqual([]);
  });

  it('sets a head longer than its segment back along that segment, inside the line’s own reach', () => {
    const points: Vec3[] = [{ x: -2, y: 0, z: 0.5 }, { x: 1.99, y: 0, z: -0.3 }, { x: 2, y: 0, z: -0.3 }];
    const px = draw([{ runs: [{ points }], color: [0.2, 0.6, 1, 1], width: 8 }]);
    const ends = points.map(screen);
    const reach = 40;
    const box = {
      x0: Math.min(...ends.map((p) => p.x)) - reach, x1: Math.max(...ends.map((p) => p.x)) + reach,
      y0: Math.min(...ends.map((p) => p.y)) - reach, y1: Math.max(...ends.map((p) => p.y)) + reach,
    };
    const stray = painted(px).filter((p) => p.x < box.x0 || p.x > box.x1 || p.y < box.y0 || p.y > box.y1);
    expect(stray).toEqual([]);
    // The head stands on the last segment's direction, 32 px of it back from the tip.
    const tip = ends[2];
    const back = unit(ends[2], ends[1]);
    expect(inked(px, offset(tip, back, 16, 0))).toBe(true);
    expect(inked(px, offset(tip, back, 16, 5))).toBe(true);
  });
});
