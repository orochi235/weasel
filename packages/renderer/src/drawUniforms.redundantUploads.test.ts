import { describe, it, expect, beforeEach } from 'vitest';
import { PATH_M as M, PATH_L as L, PATH_Z as Z } from '@weasel-js/geom';
import type { RectPath, PolygonPath } from '@weasel-js/geom';
import { makeGLRecorder } from './testing/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import type { DrawCommand } from './DrawCommand';

/**
 * `u_proj`, `u_model`, `u_colorMatrix` and `u_colorBias` are re-sent for every
 * draw command unless something remembers what the program already holds. GL
 * keeps uniform state per program object, so those repeats are pure cost — and
 * they were the majority of a frame at a few thousand commands.
 *
 * The cache lives on the per-frame `DrawContext`, so it cannot outlive a frame.
 * These tests pin both halves: repeats are dropped, and a value that genuinely
 * changes mid-frame is still uploaded. The second half is the one that matters
 * — a skipped upload there paints with the previous group's color matrix.
 */
describe('WeaselRenderer.render — redundant uniform uploads', () => {
  let recorder: ReturnType<typeof makeGLRecorder>;
  let r: WeaselRenderer;

  beforeEach(() => {
    recorder = makeGLRecorder();
    r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
    recorder.reset();
  });

  const rect = (x: number): DrawCommand => ({
    kind: 'path',
    path: { kind: 'rect', x, y: 0, width: 10, height: 10 } as RectPath,
    fill: { paint: { color: '#ff0000' } },
  });

  const countOf = (name: string): number =>
    recorder.calls.filter((c) => c.name === name).length;

  it('uploads the color matrix once for a frame of many identical-state draws', () => {
    r.render([rect(0), rect(20), rect(40), rect(60), rect(80)]);
    // The five rects merge into one batched draw.
    expect(countOf('drawElements')).toBe(1);
    expect(countOf('uniformMatrix4fv')).toBe(1);
  });

  it('uploads the projection once no matter how many commands', () => {
    r.render([rect(0), rect(20), rect(40), rect(60), rect(80)]);
    // u_proj + u_model, once each — not once per command.
    expect(countOf('uniformMatrix3fv')).toBeLessThanOrEqual(2);
  });

  it('re-uploads when a group changes the color matrix mid-frame', () => {
    // Identity for the first rect, a real matrix for the second.
    const tinted = new Array(20).fill(0);
    tinted[0] = 0.5; tinted[6] = 0.5; tinted[12] = 0.5; tinted[18] = 1;
    // Images, whose color only the shader can map: a solid's is mapped on the
    // CPU and never moves the uniform.
    const image = { width: 16, height: 16, close: () => {} } as unknown as ImageBitmap;
    const img = (x: number): DrawCommand => ({ kind: 'image', image, x, y: 0, w: 16, h: 16 });
    r.render([
      img(0),
      { kind: 'group', colorMatrix: tinted, children: [img(20)] } as unknown as DrawCommand,
      img(40),
    ]);
    // Identity, then the tint, then back to identity on the way out.
    expect(countOf('uniformMatrix4fv')).toBeGreaterThanOrEqual(3);
  });

  it('re-uploads the model matrix when a group transform changes mid-frame', () => {
    // A mesh past the batch's vertex cap, so it takes its own draw: staged
    // geometry is transformed CPU-side and would never re-upload a model.
    const ring = (x: number): DrawCommand => {
      const n = 400;
      const commands = new Uint8Array(n + 1);
      const coords = new Float32Array(n * 2);
      commands[0] = M;
      for (let k = 1; k < n; k++) commands[k] = L;
      commands[n] = Z;
      for (let k = 0; k < n; k++) {
        coords[k * 2] = x + 10 * Math.cos((k * 2 * Math.PI) / n);
        coords[k * 2 + 1] = 10 * Math.sin((k * 2 * Math.PI) / n);
      }
      return {
        kind: 'path',
        path: { kind: 'polygon', commands, coords } as PolygonPath,
        fill: { paint: { color: '#ff0000' } },
      };
    };
    const shifted = new Float32Array([1, 0, 0, 0, 1, 0, 30, 40, 1]);
    r.render([
      ring(0),
      { kind: 'group', transform: shifted, children: [ring(20)] } as unknown as DrawCommand,
      ring(40),
    ]);
    // proj once, then model for identity → shifted → identity.
    expect(countOf('uniformMatrix3fv')).toBeGreaterThanOrEqual(4);
  });

  it('starts each frame with a cold cache', () => {
    r.render([rect(0), rect(20)]);
    const first = countOf('uniformMatrix4fv');
    recorder.reset();
    r.render([rect(0), rect(20)]);
    expect(countOf('uniformMatrix4fv')).toBe(first);
  });
});
